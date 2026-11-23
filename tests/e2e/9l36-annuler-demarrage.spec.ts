import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9L36-ANNULER-DEMARRAGE-10S/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-375.png`),
    fullPage: true,
  });
}

/**
 * 9L36-ANNULER-DEMARRAGE-10S — « Annuler le démarrage » (M9, décision
 * d'Alexis du 23/11/2026, point 8 ; D282). Trois scénarios, 375 px.
 *
 * ATTENTE RÉELLE, jamais une horloge de navigateur avancée (même doctrine
 * que `9l06-compteur-minute-commencee.spec.ts`) : la fenêtre de dix secondes
 * est jugée par le SERVEUR, contre `now()` de PostgreSQL — avancer l'horloge
 * du navigateur ne la ferait pas bouger.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

type Scene = {
  readonly clientId: string;
  readonly siteId: string;
  readonly interventionId: string;
};

async function creerScene(
  client: PrismaClient,
  prefixe: string,
  societeId: string,
  agenceId: string,
  technicienId: string,
): Promise<Scene> {
  const clientId = uuidv7();
  await client.client.create({
    data: {
      id: clientId,
      societe_id: societeId,
      raison_sociale: `zz${prefixe} client annuler démarrage`,
      actif: true,
    },
  });
  const siteId = uuidv7();
  await client.site.create({
    data: {
      id: siteId,
      societe_id: societeId,
      client_id: clientId,
      agence_id: agenceId,
      libelle: `zz${prefixe} site annuler démarrage`,
      adresse: { rue: "1 rue de l'épreuve" },
      commune: "Nouméa",
    },
  });
  const interventionId = uuidv7();
  await client.intervention.create({
    data: {
      id: interventionId,
      societe_id: societeId,
      agence_id: agenceId,
      client_id: clientId,
      site_id: siteId,
      technicien_id: technicienId,
      type: "curatif",
      priorite: "p3",
      statut: "affectee",
      date_planifiee: null,
      duree_estimee_min: 60,
      mode_valorisation: "temps_passe",
      devise_code: "XPF",
      description: `zz${prefixe}-annuler-demarrage`,
    },
  });
  return { clientId, siteId, interventionId };
}

async function nettoyer(client: PrismaClient, scene: Scene): Promise<void> {
  await client.$executeRawUnsafe(
    `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
    scene.interventionId,
  );
  await client.intervention.deleteMany({ where: { id: scene.interventionId } });
  await client.site.deleteMany({ where: { id: scene.siteId } });
  await client.client.deleteMany({ where: { id: scene.clientId } });
}

async function connecterLeTechnicien(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

const BOUTON_ANNULER = fr["terrain.compteur.annuler_demarrage.bouton"];

test("EN LIGNE — démarrer puis annuler DANS LA FENÊTRE : retour à affectée, aucun temps compté", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const client = admin();
  let scene: Scene | null = null;
  try {
    const reperes = await reperesDeLaScene();
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    scene = await creerScene(
      client,
      "9L36A",
      reperes.societeId,
      agence.id,
      reperes.technicienDucos,
    );

    await page.setViewportSize({ width: 375, height: 900 });
    await connecterLeTechnicien(page);
    await page.goto(`/terrain/${scene.interventionId}`);
    // AVANT (affectée, écran déjà existant, aucun bouton d'annulation).
    await capturer(page, "avant-affectee");

    await page
      .getByRole("button", { name: fr["terrain.compteur.demarrer"] })
      .click();
    await expect(
      page.getByRole("button", { name: fr["terrain.compteur.pause"] }),
    ).toBeVisible();
    const boutonAnnuler = page.getByRole("button", { name: BOUTON_ANNULER });
    await expect(boutonAnnuler).toBeVisible();
    // APRÈS (le bouton neuf, dans la fenêtre de dix secondes).
    await capturer(page, "apres-bouton-annuler-visible");

    await boutonAnnuler.click();

    // RETOUR À « DÉMARRER » (affectée) — jamais « Mettre en pause ».
    await expect(
      page.getByRole("button", { name: fr["terrain.compteur.demarrer"] }),
    ).toBeVisible();
    await expect(boutonAnnuler).toHaveCount(0);
    await capturer(page, "apres-annule-retour-affectee");

    const verif = admin();
    try {
      const ligne = await verif.intervention.findUniqueOrThrow({
        where: { id: scene.interventionId },
        select: { statut: true, temps_mesure_min: true },
      });
      expect(ligne.statut).toBe("affectee");
      expect(ligne.temps_mesure_min).toBeNull();
      const segments = await verif.segmentTravail.count({
        where: { intervention_id: scene.interventionId },
      });
      expect(segments).toBe(0);
    } finally {
      await verif.$disconnect();
    }
  } finally {
    if (scene !== null) {
      await nettoyer(client, scene);
    }
    await client.$disconnect();
  }
});

test("EN LIGNE — onze secondes après le démarrage, le bouton a disparu (attente réelle)", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const client = admin();
  let scene: Scene | null = null;
  try {
    const reperes = await reperesDeLaScene();
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    scene = await creerScene(
      client,
      "9L36B",
      reperes.societeId,
      agence.id,
      reperes.technicienDucos,
    );

    await page.setViewportSize({ width: 375, height: 900 });
    await connecterLeTechnicien(page);
    await page.goto(`/terrain/${scene.interventionId}`);

    await page
      .getByRole("button", { name: fr["terrain.compteur.demarrer"] })
      .click();
    const boutonAnnuler = page.getByRole("button", { name: BOUTON_ANNULER });
    await expect(boutonAnnuler).toBeVisible();

    await page.waitForTimeout(11_000);

    await expect(boutonAnnuler).toHaveCount(0);
    // LE COMPTEUR, LUI, TOURNE TOUJOURS (annulation close, pas le travail).
    await expect(
      page.getByRole("button", { name: fr["terrain.compteur.pause"] }),
    ).toBeVisible();
  } finally {
    if (scene !== null) {
      await nettoyer(client, scene);
    }
    await client.$disconnect();
  }
});

test("HORS RÉSEAU — annuler un démarrage ENCORE EN FILE le retire sans appel serveur", async ({
  page,
  context,
}) => {
  test.setTimeout(60_000);
  const client = admin();
  let scene: Scene | null = null;
  try {
    const reperes = await reperesDeLaScene();
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    scene = await creerScene(
      client,
      "9L36C",
      reperes.societeId,
      agence.id,
      reperes.technicienDucos,
    );

    await page.setViewportSize({ width: 375, height: 900 });
    await connecterLeTechnicien(page);
    await page.goto(`/terrain/${scene.interventionId}`);

    await context.setOffline(true);

    await page
      .getByRole("button", { name: fr["terrain.compteur.demarrer"] })
      .click();
    // LA SAISIE LOCALE, EN FILE (bandeau orange, jamais le rouge serveur).
    await expect(
      page.getByText(fr["terrain.compteur.hors_reseau_depuis"]),
    ).toBeVisible();
    const boutonAnnuler = page.getByRole("button", { name: BOUTON_ANNULER });
    await expect(boutonAnnuler).toBeVisible();
    await capturer(page, "apres-hors-reseau-bouton-annuler-visible");

    await boutonAnnuler.click();

    // RETIRÉE DE LA FILE, SANS RÉSEAU : retour à « Démarrer », aucun refus.
    await expect(
      page.getByRole("button", { name: fr["terrain.compteur.demarrer"] }),
    ).toBeVisible();
    await expect(
      page.getByText(fr["terrain.compteur.hors_reseau_depuis"]),
    ).toHaveCount(0);

    await context.setOffline(false);

    // RIEN N'A JAMAIS ÉTÉ APPLIQUÉ CÔTÉ SERVEUR — le démarrage n'est jamais parti.
    const verif = admin();
    try {
      const ligne = await verif.intervention.findUniqueOrThrow({
        where: { id: scene.interventionId },
        select: { statut: true },
      });
      expect(ligne.statut).toBe("affectee");
      const segments = await verif.segmentTravail.count({
        where: { intervention_id: scene.interventionId },
      });
      expect(segments).toBe(0);
    } finally {
      await verif.$disconnect();
    }
  } finally {
    if (scene !== null) {
      await nettoyer(client, scene);
    }
    await client.$disconnect();
  }
});

import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
} from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9K13-TERRAIN-ATTENTE-PIECE — « J'ATTENDS UNE PIÈCE », EN LIGNE ET HORS
 * RÉSEAU (décision d'Alexis du 09/11/2026).
 *
 * Chaque test pose sa PROPRE fiche jetable (client, site, intervention
 * `en_cours`), jamais une lecture de `SCENE.*` qu'un autre fichier écrit
 * (§9) — même discipline que `9k11-itineraire-terrain.spec.ts`.
 */

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const REFERENCE_EN_LIGNE = fr["terrain.e2e.piece_ref_en_ligne"];
const REFERENCE_HORS_RESEAU = fr["terrain.e2e.piece_ref_hors_reseau"];

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9K13-TERRAIN-ATTENTE-PIECE/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-375.png`),
    fullPage: true,
  });
}

async function creerInterventionEnCours(
  client: PrismaClient,
  prefixe: string,
): Promise<{
  readonly clientId: string;
  readonly siteId: string;
  readonly interventionId: string;
}> {
  const reperes = await reperesDeLaScene();
  const agence = await client.agence.findFirstOrThrow({
    where: { societe_id: reperes.societeId, code: "DUCOS" },
    select: { id: true },
  });

  const clientId = uuidv7();
  await client.client.create({
    data: {
      id: clientId,
      societe_id: reperes.societeId,
      raison_sociale: `zz${prefixe} client attente pièce`,
      actif: true,
    },
  });

  const siteId = uuidv7();
  await client.site.create({
    data: {
      id: siteId,
      societe_id: reperes.societeId,
      client_id: clientId,
      agence_id: agence.id,
      libelle: `zz${prefixe} site attente pièce`,
      adresse: { rue: "1 rue de l'épreuve" },
      commune: "Nouméa",
    },
  });

  const interventionId = uuidv7();
  const jour = `${String(reperes.lundi.annee).padStart(4, "0")}-${String(
    reperes.lundi.mois,
  ).padStart(2, "0")}-${String(reperes.lundi.jour).padStart(2, "0")}`;
  await client.intervention.create({
    data: {
      id: interventionId,
      societe_id: reperes.societeId,
      agence_id: agence.id,
      client_id: clientId,
      site_id: siteId,
      technicien_id: reperes.technicienDucos,
      type: "curatif",
      priorite: "p3",
      statut: "en_cours",
      date_planifiee: new Date(`${jour}T00:00:00.000Z`),
      creneau_debut: new Date(`${jour}T08:00:00.000Z`),
      duree_estimee_min: 60,
      mode_valorisation: "temps_passe",
      devise_code: "XPF",
      description: `zz${prefixe}-attente-piece`,
    },
  });

  return { clientId, siteId, interventionId };
}

async function nettoyer(
  client: PrismaClient,
  scene: {
    readonly clientId: string;
    readonly siteId: string;
    readonly interventionId: string;
  } | null,
): Promise<void> {
  if (scene !== null) {
    await client.interventionPause.deleteMany({
      where: { intervention_id: scene.interventionId },
    });
    await client.intervention.deleteMany({
      where: { id: scene.interventionId },
    });
    await client.site.deleteMany({ where: { id: scene.siteId } });
    await client.client.deleteMany({ where: { id: scene.clientId } });
  }
  await client.$disconnect();
}

test("375 px, en ligne — le technicien déclare l'attente, le bureau la voit", async ({
  page,
  browser,
}) => {
  const client = admin();
  let scene: Awaited<ReturnType<typeof creerInterventionEnCours>> | null = null;
  try {
    scene = await creerInterventionEnCours(client, "9K13A");

    await page.setViewportSize({ width: 375, height: 900 });
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.goto(`/terrain/${scene.interventionId}`);

    const bouton = page.getByRole("button", {
      name: fr["terrain.suspendre.bouton"],
    });
    await expect(bouton).toBeVisible();
    await capturer(page, "terrain-fiche-avant");

    await bouton.click();
    await page
      .getByLabel(fr["intervention.suspension.piece"])
      .fill(REFERENCE_EN_LIGNE);
    await page
      .getByLabel(fr["intervention.suspension.date_dispo"])
      .fill("2026-12-15");
    await capturer(page, "terrain-formulaire");
    await page
      .getByRole("button", { name: fr["terrain.suspendre.enregistrer"] })
      .click();

    await expect(page.getByText(REFERENCE_EN_LIGNE)).toBeVisible();
    await capturer(page, "terrain-fiche-apres");

    const ligne = await client.intervention.findUniqueOrThrow({
      where: { id: scene.interventionId },
      select: {
        statut: true,
        piece_attendue_ref: true,
        date_dispo_prevue: true,
      },
    });
    expect(ligne.statut).toBe("suspendue");
    expect(ligne.piece_attendue_ref).toBe(REFERENCE_EN_LIGNE);
    expect(ligne.date_dispo_prevue?.toISOString().slice(0, 10)).toBe(
      "2026-12-15",
    );

    // ── LE BUREAU LA VOIT — UN SECOND CONTEXTE (même discipline que
    // `fiche-rapport-modifie-annule-validation.spec.ts`) ─────────────────
    const contexteBureau = await browser.newContext();
    const pageBureau = await contexteBureau.newPage();
    try {
      await ouvrirLaSessionSensible(pageBureau, COMPTE_ADMIN_SOCIETE_EPREUVE);
      await pageBureau.goto(
        `/interventions/${scene.interventionId}?onglet=temps`,
      );
      // LA LIGNE DE LA PAUSE ELLE-MÊME (`lignePausePiece`), jamais une
      // correspondance large : l'historique des états (9J08A) montre AUSSI
      // la référence, sous une autre forme, ailleurs sur le même écran.
      await expect(
        pageBureau.getByText(
          `${fr["intervention.pauses.piece"]}${fr["ponctuation.deux_points"]}${REFERENCE_EN_LIGNE}`,
        ),
      ).toBeVisible();
      await capturer(pageBureau, "bureau-intervention-suspendue");
    } finally {
      await contexteBureau.close();
    }
  } finally {
    await nettoyer(client, scene);
  }
});

test("375 px, mode avion — la déclaration reste gardée hors connexion, puis « Envoyer » la transmet", async ({
  page,
  context,
}) => {
  const client = admin();
  let scene: Awaited<ReturnType<typeof creerInterventionEnCours>> | null = null;
  try {
    scene = await creerInterventionEnCours(client, "9K13B");

    await page.setViewportSize({ width: 375, height: 900 });
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.goto(`/terrain/${scene.interventionId}`);

    await context.setOffline(true);

    await page
      .getByRole("button", { name: fr["terrain.suspendre.bouton"] })
      .click();
    await page
      .getByLabel(fr["intervention.suspension.piece"])
      .fill(REFERENCE_HORS_RESEAU);
    await page
      .getByLabel(fr["intervention.suspension.date_dispo"])
      .fill("2026-12-20");
    await page
      .getByRole("button", { name: fr["terrain.suspendre.enregistrer"] })
      .click();

    // EXACT : `BoutonEnvoyer`, ailleurs sur la même page, porte le même
    // texte suivi d'un décompte (« En attente d'envoi (1) ») — une
    // correspondance large matcherait les deux.
    await expect(
      page.getByText(fr["terrain.file.en_attente_envoi"], { exact: true }),
    ).toBeVisible();

    // Toujours « en_cours » EN BASE : rien n'est parti tant que « Envoyer »
    // n'a pas été touché.
    expect(
      (
        await client.intervention.findUniqueOrThrow({
          where: { id: scene.interventionId },
          select: { statut: true },
        })
      ).statut,
    ).toBe("en_cours");

    await context.setOffline(false);
    await page
      .getByRole("button", { name: fr["terrain.file.envoyer"] })
      .click();
    await expect(page.getByText(fr["terrain.file.tout_envoye"])).toBeVisible();

    await expect(page.getByText(REFERENCE_HORS_RESEAU)).toBeVisible();
    const ligne = await client.intervention.findUniqueOrThrow({
      where: { id: scene.interventionId },
      select: { statut: true, piece_attendue_ref: true },
    });
    expect(ligne.statut).toBe("suspendue");
    expect(ligne.piece_attendue_ref).toBe(REFERENCE_HORS_RESEAU);
  } finally {
    await nettoyer(client, scene);
  }
});

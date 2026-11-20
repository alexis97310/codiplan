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
 * 9L08C-TERRAIN-REPRENDRE-SUSPENSION — LE TECHNICIEN AFFECTÉ REPREND
 * LUI-MÊME, DEPUIS LA FICHE TERRAIN, UNE INTERVENTION QU'IL A SUSPENDUE (en
 * ligne et hors réseau — décision d'Alexis du 16/11/2026, option 2).
 *
 * Même discipline que `9k13-terrain-attente-piece.spec.ts` : chaque test pose
 * sa PROPRE fiche jetable, jamais une lecture de `SCENE.*` qu'un autre
 * fichier écrit (§9).
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
  "docs/propositions/9L08C-TERRAIN-REPRENDRE-SUSPENSION/captures",
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
      raison_sociale: `zz${prefixe} client reprise`,
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
      libelle: `zz${prefixe} site reprise`,
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
      description: `zz${prefixe}-reprise`,
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

/**
 * Suspend la fiche OUVERTE sur `page`, par le chemin de production réel.
 *
 * **Le témoin de succès est le bouton « Reprendre »**, jamais la référence en
 * clair : depuis ce ticket, elle apparaît DEUX FOIS dans le DOM (le bandeau
 * de lecture de `BoutonSuspendreTerrain`, ET le contenu — toujours monté,
 * même fermé — du dialogue de `BoutonReprendreTerrain`), et `getByText`
 * refuserait l'ambiguïté en mode strict.
 */
async function suspendre(page: Page, reference: string): Promise<void> {
  await page
    .getByRole("button", { name: fr["terrain.suspendre.bouton"] })
    .click();
  await page.getByLabel(fr["intervention.suspension.piece"]).fill(reference);
  await page
    .getByLabel(fr["intervention.suspension.date_dispo"])
    .fill("2026-12-15");
  await page
    .getByRole("button", { name: fr["terrain.suspendre.enregistrer"] })
    .click();
  await expect(
    page.getByRole("button", { name: fr["terrain.reprendre.bouton"] }),
  ).toBeVisible();
}

test("375 px, en ligne — suspendre puis reprendre ; le bureau voit la reprise, l'historique la trace", async ({
  page,
  browser,
}) => {
  const client = admin();
  let scene: Awaited<ReturnType<typeof creerInterventionEnCours>> | null = null;
  try {
    scene = await creerInterventionEnCours(client, "9L08CA");

    await page.setViewportSize({ width: 375, height: 900 });
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.goto(`/terrain/${scene.interventionId}`);

    await suspendre(page, REFERENCE_EN_LIGNE);

    const boutonReprendre = page.getByRole("button", {
      name: fr["terrain.reprendre.bouton"],
    });
    await expect(boutonReprendre).toBeVisible();
    await capturer(page, "terrain-fiche-suspendue-avant");

    await boutonReprendre.click();
    // LA RÉFÉRENCE APPARAÎT DEUX FOIS DANS LE DOM (voir le docblock de
    // `suspendre` ci-dessus) : scopée au dialogue, désormais le seul endroit
    // qui l'affiche ENCORE une fois celui-ci ouvert au-dessus du reste.
    const dialogue = page.getByRole("dialog");
    await expect(dialogue.getByText(REFERENCE_EN_LIGNE)).toBeVisible();
    await capturer(page, "terrain-confirmation");

    await page
      .getByRole("button", { name: fr["terrain.reprendre.confirmer"] })
      .click();

    await expect(boutonReprendre).not.toBeVisible();
    await capturer(page, "terrain-fiche-reprise-apres");

    const ligne = await client.intervention.findUniqueOrThrow({
      where: { id: scene.interventionId },
      select: {
        statut: true,
        motif_suspension: true,
        piece_attendue_ref: true,
        date_dispo_prevue: true,
        suspendue_le: true,
      },
    });
    expect(ligne.statut).not.toBe("suspendue");
    expect(ligne.motif_suspension).toBeNull();
    expect(ligne.piece_attendue_ref).toBeNull();
    expect(ligne.date_dispo_prevue).toBeNull();
    expect(ligne.suspendue_le).toBeNull();

    // ── LE BUREAU VOIT LA REPRISE, ET L'HISTORIQUE LA TRACE — un second
    // contexte (même discipline que 9K13) ───────────────────────────────
    const contexteBureau = await browser.newContext();
    const pageBureau = await contexteBureau.newPage();
    try {
      await ouvrirLaSessionSensible(pageBureau, COMPTE_ADMIN_SOCIETE_EPREUVE);
      await pageBureau.goto(
        `/interventions/${scene.interventionId}?onglet=temps`,
      );
      // LA PAUSE N'EST PLUS « EN COURS » — elle porte désormais « Fermée
      // par », la trace que QUELQU'UN l'a refermée (jamais « En cours »,
      // qui disait qu'elle attendait encore).
      await expect(
        pageBureau.getByText(fr["intervention.pauses.en_cours"]),
      ).not.toBeVisible();
      await expect(
        pageBureau.getByText(fr["intervention.pauses.fermee_par"]),
      ).toBeVisible();
      await capturer(pageBureau, "bureau-intervention-reprise");
    } finally {
      await contexteBureau.close();
    }
  } finally {
    await nettoyer(client, scene);
  }
});

test("375 px, mode avion — la reprise reste gardée hors connexion, puis « Envoyer » la transmet", async ({
  page,
  context,
}) => {
  const client = admin();
  let scene: Awaited<ReturnType<typeof creerInterventionEnCours>> | null = null;
  try {
    scene = await creerInterventionEnCours(client, "9L08CB");

    await page.setViewportSize({ width: 375, height: 900 });
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.goto(`/terrain/${scene.interventionId}`);

    // SUSPENDUE EN LIGNE D'ABORD (par le chemin de production réel) — seul
    // le geste « Reprendre » est éprouvé hors réseau ici.
    await suspendre(page, REFERENCE_HORS_RESEAU);
    await page.reload();

    await context.setOffline(true);

    await page
      .getByRole("button", { name: fr["terrain.reprendre.bouton"] })
      .click();
    await page
      .getByRole("button", { name: fr["terrain.reprendre.confirmer"] })
      .click();

    await expect(
      page.getByText(fr["terrain.file.en_attente_envoi"], { exact: true }),
    ).toBeVisible();
    await capturer(page, "terrain-reprise-hors-reseau");

    // Toujours « suspendue » EN BASE : rien n'est parti tant que « Envoyer »
    // n'a pas été touché.
    expect(
      (
        await client.intervention.findUniqueOrThrow({
          where: { id: scene.interventionId },
          select: { statut: true },
        })
      ).statut,
    ).toBe("suspendue");

    await context.setOffline(false);
    await page
      .getByRole("button", { name: fr["terrain.file.envoyer"] })
      .click();
    await expect(page.getByText(fr["terrain.file.tout_envoye"])).toBeVisible();

    const ligne = await client.intervention.findUniqueOrThrow({
      where: { id: scene.interventionId },
      select: { statut: true },
    });
    expect(ligne.statut).not.toBe("suspendue");
  } finally {
    await nettoyer(client, scene);
  }
});

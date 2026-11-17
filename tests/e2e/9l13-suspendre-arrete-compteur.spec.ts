import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

// SÉRIE, PAS PARALLÈLE (même garde que `terrain.spec.ts`) — les deux
// scénarios démarrent le compteur sous LE MÊME compte technicien, et un seul
// segment ouvert existe par personne (`compteur.refus.deja_en_cours`) : en
// parallèle, le second démarrage se heurte au segment que le premier vient
// d'ouvrir sur une AUTRE intervention.
test.describe.configure({ mode: "serial" });

/**
 * 9L13-SUSPENDRE-ARRETE-COMPTEUR — la suspension ferme le segment de
 * compteur ouvert (décision d'Alexis du 10/11/2026).
 *
 * Chaque test pose sa PROPRE fiche jetable (client, site, intervention
 * `en_cours`), jamais une lecture de `SCENE.*` — même discipline que
 * `9k13-terrain-attente-piece.spec.ts`.
 */

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9L13-SUSPENDRE-ARRETE-COMPTEUR/captures",
);

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
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
      raison_sociale: `zz${prefixe} client compteur suspendu`,
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
      libelle: `zz${prefixe} site compteur suspendu`,
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
      description: `zz${prefixe}-compteur-suspendu`,
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
    await client.segmentTravail.deleteMany({
      where: { intervention_id: scene.interventionId },
    });
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

test("en ligne, 375 et 1280 px — suspendre arrête le compteur, le temps mesuré se fige", async ({
  page,
}) => {
  const client = admin();
  let scene: Awaited<ReturnType<typeof creerInterventionEnCours>> | null = null;
  try {
    scene = await creerInterventionEnCours(client, "9L13A");

    await page.setViewportSize({ width: 375, height: 900 });
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.goto(`/terrain/${scene.interventionId}`);

    await page
      .getByRole("button", { name: fr["terrain.compteur.reprendre"] })
      .click();
    await expect(
      page.getByText(fr["terrain.compteur.tourne_depuis"], { exact: false }),
    ).toBeVisible();
    await capturer(page, "avant-suspension", 375);
    await page.setViewportSize({ width: 1280, height: 900 });
    await capturer(page, "avant-suspension", 1280);
    await page.setViewportSize({ width: 375, height: 900 });

    const ouvertAvant = await client.segmentTravail.findFirst({
      where: { intervention_id: scene.interventionId, fin: null },
      select: { id: true },
    });
    expect(ouvertAvant).not.toBeNull();

    await page
      .getByRole("button", { name: fr["terrain.suspendre.bouton"] })
      .click();
    await page
      .getByLabel(fr["intervention.suspension.piece"])
      .fill("CMP-9L13A");
    await page
      .getByLabel(fr["intervention.suspension.date_dispo"])
      .fill("2026-12-10");
    await page
      .getByRole("button", { name: fr["terrain.suspendre.enregistrer"] })
      .click();

    // LE COMPTEUR NE TOURNE PLUS (D119) — ni le bandeau de la fiche, ni la
    // possibilité de le redémarrer : `peutDemarrerLeCompteur` refuse une
    // suspendue, et ce refus prend la place du bouton.
    await expect(
      page.getByText(fr["terrain.compteur.tourne_depuis"], { exact: false }),
    ).not.toBeVisible();
    await expect(page.getByText(fr["compteur.refus.suspendue"])).toBeVisible();
    await capturer(page, "apres-suspension", 375);
    await page.setViewportSize({ width: 1280, height: 900 });
    await capturer(page, "apres-suspension", 1280);

    const ouvertsApres = await client.segmentTravail.findMany({
      where: { intervention_id: scene.interventionId, fin: null },
    });
    expect(ouvertsApres).toHaveLength(0);

    const ligne = await client.intervention.findUniqueOrThrow({
      where: { id: scene.interventionId },
      select: { statut: true, temps_mesure_min: true },
    });
    expect(ligne.statut).toBe("suspendue");
    expect(ligne.temps_mesure_min).not.toBeNull();
  } finally {
    await nettoyer(client, scene);
  }
});

test("375 px, mode avion — l'arrêt du compteur arrive avec la suspension envoyée par la file", async ({
  page,
  context,
}) => {
  const client = admin();
  let scene: Awaited<ReturnType<typeof creerInterventionEnCours>> | null = null;
  try {
    scene = await creerInterventionEnCours(client, "9L13B");

    await page.setViewportSize({ width: 375, height: 900 });
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.goto(`/terrain/${scene.interventionId}`);

    await page
      .getByRole("button", { name: fr["terrain.compteur.reprendre"] })
      .click();
    await expect(
      page.getByText(fr["terrain.compteur.tourne_depuis"], { exact: false }),
    ).toBeVisible();

    await context.setOffline(true);

    // SEUL « SUSPENDRE » PART EN FILE — AUCUN « ARRÊTER » (voir le docblock
    // de `BoutonSuspendreTerrain`) : c'est le serveur, pas l'appareil, qui
    // doit fermer le segment quand cette suspension arrivera.
    await page
      .getByRole("button", { name: fr["terrain.suspendre.bouton"] })
      .click();
    await page
      .getByLabel(fr["intervention.suspension.piece"])
      .fill("CMP-9L13B");
    await page
      .getByLabel(fr["intervention.suspension.date_dispo"])
      .fill("2026-12-10");
    await page
      .getByRole("button", { name: fr["terrain.suspendre.enregistrer"] })
      .click();
    await expect(
      page.getByText(fr["terrain.file.en_attente_envoi"], { exact: true }),
    ).toBeVisible();

    // TOUJOURS OUVERT EN BASE — rien n'est parti tant que « Envoyer » n'a
    // pas été touché.
    expect(
      await client.segmentTravail.findFirst({
        where: { intervention_id: scene.interventionId, fin: null },
        select: { id: true },
      }),
    ).not.toBeNull();

    await context.setOffline(false);
    await page
      .getByRole("button", { name: fr["terrain.file.envoyer"] })
      .click();
    await expect(page.getByText(fr["terrain.file.tout_envoye"])).toBeVisible();

    await expect(
      page.getByText(fr["terrain.compteur.tourne_depuis"], { exact: false }),
    ).not.toBeVisible();

    const ouvertsApres = await client.segmentTravail.findMany({
      where: { intervention_id: scene.interventionId, fin: null },
    });
    expect(ouvertsApres).toHaveLength(0);

    const ligne = await client.intervention.findUniqueOrThrow({
      where: { id: scene.interventionId },
      select: { statut: true, temps_mesure_min: true },
    });
    expect(ligne.statut).toBe("suspendue");
    expect(ligne.temps_mesure_min).not.toBeNull();
  } finally {
    await nettoyer(client, scene);
  }
});

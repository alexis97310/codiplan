import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, type Page, test } from "@playwright/test";

import { cleJour, jourDe, maintenant } from "@/lib/calendar/fuseau";
import { fr } from "@/lib/i18n";
import { engendrerJetonQr } from "@/lib/machines/qr";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";

/**
 * LES CAPTURES DE 9DI-TP-TER1-JOURNEE-FICHE (QE-11) — APRÈS.
 *
 * Même recette que `captures-9dca-droits-terrain-demandes.spec.ts` : rien
 * n'est écrit sans `CAPTURES_9DI` (le dossier), pour que `pnpm test:e2e`
 * ordinaire n'écrive jamais de fichier. L'AVANT a été pris une fois, dans un
 * worktree au commit qui précède ce lot — voir la passation — avec une
 * scène volontairement plus pauvre (sans bandeau, sans reprise, sans
 * profil, qui n'existaient pas encore).
 *
 * SA PROPRE SCÈNE, préfixée `9DI-`, jamais `SCENE.*` (I9) : deux
 * interventions — la PRINCIPALE (toutes les données de la fiche) et une
 * SECONDE, en cours avec un segment déjà fermé, pour la capture de
 * « Reprendre le compteur » et, démarrée puis mise en pause par ce
 * fichier lui-même, pour la capture du bandeau.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9DI ?? "";
const ETAPE = "apres";

const PREFIXE = "9DI-";
const CLIENT_ID = randomUUID();
const SITE_ID = randomUUID();
const CONTACT_ID = randomUUID();
const FAMILLE_ID = randomUUID();
const MODELE_ID = randomUUID();
const MACHINE_ID = randomUUID();
const INTERVENTION_ID = randomUUID();
const INTERVENTION_MACHINE_ID = randomUUID();
const INTERVENTION_BANDEAU_ID = randomUUID();
const INTERVENTION_REPRISE_ID = randomUUID();
const SEGMENT_REPRISE_ID = randomUUID();

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.segmentTravail.deleteMany({
    where: {
      intervention_id: {
        in: [INTERVENTION_BANDEAU_ID, INTERVENTION_REPRISE_ID],
      },
    },
  });
  await client.interventionMachine.deleteMany({
    where: { id: INTERVENTION_MACHINE_ID },
  });
  await client.intervention.deleteMany({
    where: {
      id: {
        in: [INTERVENTION_ID, INTERVENTION_BANDEAU_ID, INTERVENTION_REPRISE_ID],
      },
    },
  });
  await client.machine.deleteMany({ where: { id: MACHINE_ID } });
  await client.modeleMateriel.deleteMany({ where: { id: MODELE_ID } });
  await client.familleMateriel.deleteMany({ where: { id: FAMILLE_ID } });
  await client.contact.deleteMany({ where: { id: CONTACT_ID } });
  await client.site.deleteMany({ where: { id: SITE_ID } });
  await client.client.deleteMany({ where: { id: CLIENT_ID } });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await nettoyer(client);
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const modeleExistant = await client.modeleMateriel.findFirstOrThrow({
      where: { societe_id: reperes.societeId },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: reperes.societeId,
        raison_sociale: `${PREFIXE}Client (captures)`,
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: `${PREFIXE}Lieu (captures)`,
      },
    });
    await client.contact.create({
      data: {
        id: CONTACT_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        nom: `${PREFIXE}Contact (captures)`,
        telephone: "26.00.11",
        mobile: "78.22.33",
        email: "contact-captures-9di@epreuve.test",
        canaux: ["email"],
        roles: ["contact_technique"],
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_ID,
        societe_id: reperes.societeId,
        modele_id: modeleExistant.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        numero_serie: "SN-9DI-CAPTURES",
        qr_token: engendrerJetonQr(),
      },
    });

    const cle = cleJour(jourDe(maintenant(reperes.fuseau).local));
    const commun = {
      societe_id: reperes.societeId,
      agence_id: agence.id,
      client_id: CLIENT_ID,
      site_id: SITE_ID,
      technicien_id: reperes.technicienDucos,
      type: "curatif" as const,
      mode_valorisation: "temps_passe" as const,
      devise_code: "XPF",
      date_planifiee: new Date(`${cle}T00:00:00.000Z`),
    };

    await client.intervention.create({
      data: {
        id: INTERVENTION_ID,
        statut: "affectee",
        priorite: "p1",
        description: `${PREFIXE}Courroie distendue, bruit anormal (captures)`,
        contact_id: CONTACT_ID,
        creneau_debut: new Date(`${cle}T09:00:00.000Z`),
        creneau_fin: new Date(`${cle}T10:30:00.000Z`),
        duree_estimee_min: 90,
        ...commun,
      },
    });
    await client.interventionMachine.create({
      data: {
        id: INTERVENTION_MACHINE_ID,
        societe_id: reperes.societeId,
        intervention_id: INTERVENTION_ID,
        machine_id: MACHINE_ID,
      },
    });

    await client.intervention.create({
      data: {
        id: INTERVENTION_BANDEAU_ID,
        statut: "affectee",
        priorite: "p3",
        duree_estimee_min: 60,
        ...commun,
      },
    });

    await client.intervention.create({
      data: {
        id: INTERVENTION_REPRISE_ID,
        statut: "en_cours",
        priorite: "p3",
        duree_estimee_min: 60,
        ...commun,
      },
    });
    const ilYA20Minutes = new Date(Date.now() - 20 * 60 * 1000);
    const ilYA5Minutes = new Date(Date.now() - 5 * 60 * 1000);
    await client.segmentTravail.create({
      data: {
        id: SEGMENT_REPRISE_ID,
        societe_id: reperes.societeId,
        intervention_id: INTERVENTION_REPRISE_ID,
        utilisateur_id: reperes.technicienDucos,
        debut: ilYA20Minutes,
        fin: ilYA5Minutes,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await nettoyer(client);
  } finally {
    await client.$disconnect();
  }
});

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${ETAPE}-${largeur}.png`),
    fullPage: true,
  });
}

async function ouvrirLaSessionDuTerrain(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await page.waitForLoadState("networkidle");
}

for (const largeur of [375, 1280] as const) {
  test(`capture — Ma journée, sans bandeau, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirLaSessionDuTerrain(page);
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "journee", largeur);
  });

  test(`capture — la fiche d'une intervention transmise, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirLaSessionDuTerrain(page);
    await page.goto(`/terrain/${INTERVENTION_ID}`);
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "fiche", largeur);
  });

  test(`capture — le profil, à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirLaSessionDuTerrain(page);
    await page.goto("/terrain/profil");
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "profil", largeur);
  });
}

test("capture — « Reprendre le compteur », à 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 1200 });
  await ouvrirLaSessionDuTerrain(page);
  await page.goto(`/terrain/${INTERVENTION_REPRISE_ID}`);
  await expect(
    page.getByRole("button", { name: fr["terrain.compteur.reprendre"] }),
  ).toBeVisible();
  await capturer(page, "reprendre", 375);
});

test("capture — Ma journée, avec le bandeau « compteur en cours », à 375px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 1200 });
  await ouvrirLaSessionDuTerrain(page);

  await page.goto(`/terrain/${INTERVENTION_BANDEAU_ID}`);
  await page
    .getByRole("button", { name: fr["terrain.compteur.demarrer"] })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/terrain/${INTERVENTION_BANDEAU_ID}$`),
  );

  await page.goto("/terrain");
  const bandeau = page.getByRole("link", {
    name: new RegExp(fr["terrain.compteur.bandeau_prefixe"]),
  });
  await expect(bandeau).toBeVisible();
  await capturer(page, "journee-bandeau", 375);

  // ── ARRÊTER, pour ne laisser aucun compteur ouvert derrière ce fichier ──
  await page.goto(`/terrain/${INTERVENTION_BANDEAU_ID}`);
  await page
    .getByRole("button", { name: fr["terrain.compteur.pause"] })
    .click();
});

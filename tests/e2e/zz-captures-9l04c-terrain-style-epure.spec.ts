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
  FORFAITS_SCENE,
  MOT_DE_PASSE_EPREUVE,
} from "./setup/scene";

/**
 * LES CAPTURES DE 9L04C-TERRAIN-STYLE-EPURE — AVANT/APRÈS, même recette que
 * `zz-captures-9g5-terrain-ergonomie.spec.ts` : lancé une fois sur le code
 * d'avant (AVANT), une fois sur le code livré (APRÈS). Rien n'est écrit sans
 * `CAPTURES_9L04C` (le chemin complet du dossier cible).
 *
 * UNE scène NEUVE, préfixée `9L04C-`, avec TROIS interventions — affectée,
 * en cours, terminée — jamais `SCENE.*`, que d'autres fichiers font avancer
 * concurremment sous `fullyParallel` (voir le commentaire de
 * `tests/e2e/setup/scene.ts` sur `compteurA`/`rapportTravaillee`).
 *
 * 375 px seulement (consigne du ticket) : Ma journée, la fiche dans ses
 * trois statuts, la coquille hors réseau, et UN écran du bureau à 1280 px —
 * inchangé — pour prouver que la zone épurée ne déteint pas sur lui.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const AFFECTEE_ID = uuidv7();
const EN_COURS_ID = uuidv7();
const TERMINEE_ID = uuidv7();

let agenceId = "";
let technicienId = "";
let societeId = "";

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  societeId = reperes.societeId;
  technicienId = reperes.technicienDucos;
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });
    agenceId = agence.id;

    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: societeId,
        raison_sociale: "9L04C — Client de capture",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: societeId,
        client_id: CLIENT_ID,
        agence_id: agenceId,
        libelle: "9L04C — Site de capture",
      },
    });

    const base = {
      societe_id: societeId,
      client_id: CLIENT_ID,
      site_id: SITE_ID,
      agence_id: agenceId,
      technicien_id: technicienId,
      type: "curatif" as const,
      date_planifiee: new Date("2026-11-13T22:00:00Z"),
      duree_estimee_min: 60,
      mode_valorisation: "temps_passe" as const,
      devise_code: "XPF",
      forfait_deplacement_id: FORFAITS_SCENE[0].id,
      description: "9L04C — panne de capture, filet et style épuré",
    };

    await client.intervention.create({
      data: { id: AFFECTEE_ID, ...base, statut: "affectee" },
    });
    await client.intervention.create({
      data: { id: EN_COURS_ID, ...base, statut: "en_cours" },
    });
    await client.intervention.create({
      data: { id: TERMINEE_ID, ...base, statut: "terminee" },
    });
    await client.$executeRawUnsafe(
      `INSERT INTO "segment_travail" ("id","societe_id","intervention_id","utilisateur_id","nom_technicien_affiche","debut","fin","modifie_le")
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid,
               (SELECT "nom" FROM "utilisateur" WHERE "id" = $3::uuid), now() - interval '45 minutes', now(), now())`,
      societeId,
      TERMINEE_ID,
      technicienId,
    );
    await client.intervention.update({
      where: { id: TERMINEE_ID },
      data: { temps_mesure_min: 45, temps_valide_min: 45 },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      TERMINEE_ID,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_ID,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_ID } });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER = process.env.CAPTURES_9L04C ?? "";
const PHASE = process.env.CAPTURES_9L04C_PHASE === "avant" ? "avant" : "apres";

async function capturer(page: Page, nom: string): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${PHASE}-375.png`),
    fullPage: false,
  });
}

async function ouvrirLaSessionDuTerrain(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

test("capture — Ma journée, à 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await ouvrirLaSessionDuTerrain(page);
  await expect(page.locator("main")).toBeVisible();
  await capturer(page, "ma-journee");
});

test("capture — fiche, intervention affectée, à 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await ouvrirLaSessionDuTerrain(page);
  await page.goto(`/terrain/${AFFECTEE_ID}`);
  await expect(page.locator("main")).toBeVisible();
  await capturer(page, "fiche-affectee");
});

test("capture — fiche, intervention en cours, à 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await ouvrirLaSessionDuTerrain(page);
  await page.goto(`/terrain/${EN_COURS_ID}`);
  await expect(page.locator("main")).toBeVisible();
  await capturer(page, "fiche-en-cours");
});

test("capture — fiche, intervention terminée, à 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await ouvrirLaSessionDuTerrain(page);
  await page.goto(`/terrain/${TERMINEE_ID}`);
  await expect(page.locator("main")).toBeVisible();
  await capturer(page, "fiche-terminee");
});

test("capture — coquille hors réseau, aucune copie, à 375px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  // AUCUNE SESSION, AUCUNE VISITE PRÉALABLE DE /terrain — même garde que
  // `zz-captures-9g5-terrain-ergonomie.spec.ts` (sans quoi `CopieLocaleTerrain`
  // aurait déjà écrit une copie dans IndexedDB).
  await page.goto("/terrain-hors-reseau");
  await expect(
    page.getByText(fr["terrain.hors_reseau.aucune_copie"]),
  ).toBeVisible();
  await capturer(page, "coquille-hors-reseau");
});

test("capture — un écran du bureau, inchangé, à 1280px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/connexion");
  await page
    .getByLabel(fr["connexion.email"])
    .fill(COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await page.goto(`/interventions/${TERMINEE_ID}`);
  await expect(page.locator("main")).toBeVisible();
  await capturer(page, "bureau-fiche-intervention");
});

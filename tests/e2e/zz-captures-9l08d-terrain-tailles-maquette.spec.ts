import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";

/**
 * LES CAPTURES DE 9L08D-TERRAIN-TAILLES-MAQUETTE — AVANT/APRÈS, même recette
 * que `zz-captures-9l04c-terrain-style-epure.spec.ts` : lancé une fois sur le
 * code d'avant (AVANT, 18/16 px), une fois sur le code livré (APRÈS, 17/13-14
 * px, D263). Rien n'est écrit sans `CAPTURES_9L08D` (le chemin complet du
 * dossier cible).
 *
 * UNE scène NEUVE, préfixée `9L08D-`, avec une intervention EN COURS et un
 * modèle de checklist GÉNÉRIQUE à un point — jamais `SCENE.*`, que d'autres
 * fichiers font avancer concurremment sous `fullyParallel`.
 *
 * Cinq écrans, 375 px seulement (§ CAPTURES du ticket) : l'en-tête de la
 * fiche, une rubrique de checklist, la rubrique Photos, Ma journée, et la
 * coquille hors réseau.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const EN_COURS_ID = uuidv7();
const MODELE_ID = uuidv7();
const VERSION_ID = uuidv7();
const POINT_ID = uuidv7();

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
        raison_sociale: "9L08D — Client de capture",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: societeId,
        client_id: CLIENT_ID,
        agence_id: agenceId,
        libelle: "9L08D — Site de capture",
      },
    });
    await client.intervention.create({
      data: {
        id: EN_COURS_ID,
        societe_id: societeId,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        agence_id: agenceId,
        technicien_id: technicienId,
        type: "curatif",
        statut: "en_cours",
        date_planifiee: new Date("2026-11-16T22:00:00Z"),
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "9L08D — panne de capture, tailles de la maquette",
      },
    });

    // UN MODÈLE GÉNÉRIQUE, UNE SEULE VERSION, UN SEUL POINT — même recette
    // que `9k22-checklist-hors-reseau.spec.ts` : sans rattachement, il
    // s'applique à toute intervention de la société.
    await client.checklistModele.create({
      data: {
        id: MODELE_ID,
        societe_id: societeId,
        code: "ZZ9L08D-GENERIQUE",
        libelle: "9L08D — checklist de capture",
        actif: true,
      },
    });
    await client.checklistVersion.create({
      data: {
        id: VERSION_ID,
        societe_id: societeId,
        checklist_modele_id: MODELE_ID,
        numero: 1,
      },
    });
    await client.checklistPoint.create({
      data: {
        id: POINT_ID,
        societe_id: societeId,
        checklist_version_id: VERSION_ID,
        section: "Sécurité",
        ordre: 1,
        libelle: "9L08D — point de capture",
        obligatoire: false,
        type_reponse: "conforme_non_conforme_sans_objet",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.checklistVersion.deleteMany({
      where: { checklist_modele_id: MODELE_ID },
    });
    await client.checklistModele.deleteMany({ where: { id: MODELE_ID } });
    await client.intervention.deleteMany({ where: { client_id: CLIENT_ID } });
    await client.site.deleteMany({ where: { client_id: CLIENT_ID } });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER = process.env.CAPTURES_9L08D ?? "";
const PHASE = process.env.CAPTURES_9L08D_PHASE === "avant" ? "avant" : "apres";

async function capturer(
  cible: Page | ReturnType<Page["locator"]>,
  nom: string,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await cible.screenshot({ path: join(DOSSIER, `${nom}-${PHASE}-375.png`) });
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

test("capture — en-tête de la fiche, à 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await ouvrirLaSessionDuTerrain(page);
  await page.goto(`/terrain/${EN_COURS_ID}`);
  // `components/navigation/bandeau-mobile.tsx` pose SON PROPRE `<header>`,
  // avant celui de la fiche dans le DOM — `.first()` seul attraperait le
  // bandeau de navigation, jamais l'en-tête de D263. Celui de la fiche est
  // à l'intérieur de `<main>`.
  const entete = page.locator("main header").first();
  await expect(entete).toBeVisible();
  await capturer(entete, "entete-fiche");
});

test("capture — une rubrique de checklist, à 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await ouvrirLaSessionDuTerrain(page);
  await page.goto(`/terrain/${EN_COURS_ID}`);
  const titreChecklist = page.getByText(
    `${fr["checklist.terrain.provenance_prefixe"]}${fr["ponctuation.deux_points"]}`,
    { exact: false },
  );
  await expect(titreChecklist).toBeVisible();
  const rubrique = titreChecklist.locator("xpath=ancestor::section[1]");
  await capturer(rubrique, "rubrique-checklist");
});

test("capture — la rubrique Photos, à 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await ouvrirLaSessionDuTerrain(page);
  await page.goto(`/terrain/${EN_COURS_ID}`);
  const titrePhotos = page.getByText(fr["terrain.photos.titre"], {
    exact: true,
  });
  await expect(titrePhotos).toBeVisible();
  const rubrique = titrePhotos.locator("xpath=ancestor::section[1]");
  await capturer(rubrique, "rubrique-photos");
});

test("capture — Ma journée, à 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await ouvrirLaSessionDuTerrain(page);
  await expect(page.locator("main")).toBeVisible();
  await capturer(page, "ma-journee");
});

test("capture — coquille hors réseau, aucune copie, à 375px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  // AUCUNE SESSION, AUCUNE VISITE PRÉALABLE DE /terrain — même garde que
  // `zz-captures-9l04c-terrain-style-epure.spec.ts` : `CopieLocaleTerrain`
  // n'a ainsi écrit aucune copie dans IndexedDB.
  await page.goto("/terrain-hors-reseau");
  await expect(
    page.getByText(fr["terrain.hors_reseau.aucune_copie"]),
  ).toBeVisible();
  await capturer(page, "coquille-hors-reseau");
});

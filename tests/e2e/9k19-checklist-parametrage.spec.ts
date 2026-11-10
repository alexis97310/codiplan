import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9K19-CHECKLIST-PARAMETRAGE — l'écran de paramétrage des checklists (CK3) :
 * liste, création d'un modèle, publication d'une version, modification
 * (publie la suivante, D235), désactivation.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `9K19-` : une famille active créée en
 * `beforeAll`, effacée en `afterAll` — même patron que
 * `9k17a-materiel-sous-type.spec.ts`. Le modèle et ses versions sont créés
 * PAR les tests eux-mêmes (volet « Ajouter ») et effacés au même endroit.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const DOSSIER = join(
  process.cwd(),
  "docs/propositions/9K19-CHECKLIST-PARAMETRAGE/captures",
);

/** EN VIEWPORT, jamais `fullPage` — la capture montre ce qui se voit sans défiler. */
async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({ path: join(DOSSIER, `${nom}.png`) });
}

const FAMILLE = uuidv7();
const CODE_FAMILLE = "9K19FAM";
const LIBELLE_FAMILLE = "9K19-Famille";

const CODE_MODELE = "9K19-CHK";
const LIBELLE_MODELE = "9K19-Checklist";

test.beforeAll(async () => {
  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    await client.familleMateriel.create({
      data: {
        id: FAMILLE,
        societe_id: societe.id,
        code: CODE_FAMILLE,
        libelle: LIBELLE_FAMILLE,
        actif: true,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    const modele = await client.checklistModele.findFirst({
      where: { code: CODE_MODELE },
      select: { id: true },
    });
    if (modele !== null) {
      await client.checklistVersion.deleteMany({
        where: { checklist_modele_id: modele.id },
      });
      await client.checklistModele.deleteMany({ where: { id: modele.id } });
    }
    await client.familleMateriel.deleteMany({ where: { code: CODE_FAMILLE } });
  } finally {
    await client.$disconnect();
  }
});

async function connexionAdmin(page: Page): Promise<void> {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
}

test("« Ajouter un modèle » — rattaché à la famille, relu en base dans la liste", async ({
  page,
}) => {
  await connexionAdmin(page);
  await page.goto("/parametres/checklists");

  await page
    .getByRole("link", { name: fr["checklist.parametrage.creer_modele"] })
    .click();
  const volet = page.getByRole("dialog");
  await expect(
    volet.getByRole("heading", {
      name: fr["checklist.parametrage.creer_modele"],
    }),
  ).toBeVisible();

  await volet.getByLabel(fr["checklist.parametrage.code"]).fill(CODE_MODELE);
  await volet
    .getByLabel(fr["checklist.parametrage.libelle"])
    .fill(LIBELLE_MODELE);
  await volet
    .getByLabel(fr["checklist.parametrage.famille"])
    .selectOption({ label: LIBELLE_FAMILLE });
  await volet
    .getByRole("button", { name: fr["checklist.parametrage.creer_action"] })
    .click();

  await expect(page).toHaveURL(/\/parametres\/checklists$/);
  const table = page.locator("table").first();
  const ligne = table.locator("tr", { hasText: CODE_MODELE });
  await expect(ligne).toHaveCount(1);
  await expect(ligne.filter({ hasText: LIBELLE_FAMILLE })).toHaveCount(1);
  await expect(
    ligne.getByRole("link", { name: fr["checklist.parametrage.publier"] }),
  ).toBeVisible();
});

test("« Publier une version » — un point, relu « Version n°1 » dans la liste", async ({
  page,
}) => {
  await connexionAdmin(page);
  await page.goto("/parametres/checklists");

  const table = page.locator("table").first();
  await table
    .locator("tr", { hasText: CODE_MODELE })
    .getByRole("link", { name: fr["checklist.parametrage.publier"] })
    .click();

  await expect(page).toHaveURL(/\/parametres\/checklists\/.+\/version$/);
  await page
    .getByLabel(fr["checklist.parametrage.point_section"])
    .fill("Sécurité");
  await page
    .getByLabel(fr["checklist.parametrage.point_libelle"])
    .fill("Premier point");
  await page
    .getByRole("button", { name: fr["checklist.parametrage.publier_action"] })
    .click();

  await expect(page).toHaveURL(/\/parametres\/checklists$/);
  const table2 = page.locator("table").first();
  await expect(
    table2.locator("tr", { hasText: CODE_MODELE }).filter({ hasText: "n°1" }),
  ).toHaveCount(1);
});

test("« Modifier » — publie la v2, la v1 reste lisible dans l'aperçu des versions précédentes", async ({
  page,
}) => {
  await connexionAdmin(page);
  await page.goto("/parametres/checklists");

  const table = page.locator("table").first();
  await table
    .locator("tr", { hasText: CODE_MODELE })
    .getByRole("link", { name: fr["checklist.parametrage.modifier_version"] })
    .click();

  await expect(page).toHaveURL(/\/parametres\/checklists\/.+\/version$/);
  // L'ÉDITEUR EST PRÉREMPLI avec le point de la v1.
  await expect(
    page.getByLabel(fr["checklist.parametrage.point_libelle"]).first(),
  ).toHaveValue("Premier point");

  await page
    .getByRole("button", { name: fr["checklist.parametrage.ajouter_point"] })
    .click();
  await page
    .getByLabel(fr["checklist.parametrage.point_section"])
    .last()
    .fill("Levage");
  await page
    .getByLabel(fr["checklist.parametrage.point_libelle"])
    .last()
    .fill("Second point");

  await page
    .getByRole("button", { name: fr["checklist.parametrage.publier_action"] })
    .click();

  await expect(page).toHaveURL(/\/parametres\/checklists$/);
  const table2 = page.locator("table").first();
  await expect(
    table2.locator("tr", { hasText: CODE_MODELE }).filter({ hasText: "n°2" }),
  ).toHaveCount(1);

  await table2
    .locator("tr", { hasText: CODE_MODELE })
    .getByRole("link", { name: fr["checklist.parametrage.modifier_version"] })
    .click();
  const versionV1 = page.locator("details", { hasText: "n°1" });
  await versionV1.locator("summary").click();
  await expect(
    versionV1.locator("li", { hasText: "Premier point" }),
  ).toHaveCount(1);
});

test("« Désactiver » puis « Réactiver » — relu dans la liste", async ({
  page,
}) => {
  await connexionAdmin(page);
  await page.goto("/parametres/checklists");

  const table = page.locator("table").first();
  const ligne = table.locator("tr", { hasText: CODE_MODELE });
  await ligne
    .getByRole("button", { name: fr["checklist.parametrage.desactiver"] })
    .click();

  await expect(page).toHaveURL(/\/parametres\/checklists$/);
  const ligneApres = page
    .locator("table")
    .first()
    .locator("tr", { hasText: CODE_MODELE });
  await expect(
    ligneApres.getByRole("button", {
      name: fr["checklist.parametrage.activer"],
    }),
  ).toBeVisible();

  await ligneApres
    .getByRole("button", { name: fr["checklist.parametrage.activer"] })
    .click();
  await expect(page).toHaveURL(/\/parametres\/checklists$/);
});

test("captures — Paramètres › Checklists, et l'éditeur de version, à 1280 et 375 px", async ({
  page,
}) => {
  await connexionAdmin(page);

  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.goto("/parametres/checklists");
  await capturer(page, "liste-1280");

  const table = page.locator("table").first();
  await table
    .locator("tr", { hasText: CODE_MODELE })
    .getByRole("link", { name: fr["checklist.parametrage.modifier_version"] })
    .click();
  await expect(page).toHaveURL(/\/parametres\/checklists\/.+\/version$/);
  await capturer(page, "editeur-version-1280");

  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/parametres/checklists");
  await capturer(page, "liste-375");

  await page
    .locator("li", { hasText: CODE_MODELE })
    .getByRole("link", { name: fr["checklist.parametrage.modifier_version"] })
    .click();
  await expect(page).toHaveURL(/\/parametres\/checklists\/.+\/version$/);
  await capturer(page, "editeur-version-375");
});

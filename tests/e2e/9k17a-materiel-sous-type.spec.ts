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
 * 9K17A-MATERIEL-SOUS-TYPE — le troisième onglet « Sous-types », et le choix
 * sur la fiche d'un modèle (D238, décision d'Alexis du 10/11/2026).
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `9K17A-` : une famille active (même patron que
 * `9i95-refonte-parametres-materiel.spec.ts`), créée en `beforeAll`, effacée
 * en `afterAll`. Le sous-type et le modèle créés PAR les tests eux-mêmes
 * (volet « Ajouter ») sont retrouvés par leur code et effacés au même
 * endroit.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const DOSSIER = join(
  process.cwd(),
  "docs/propositions/9K17A-MATERIEL-SOUS-TYPE/captures",
);

/** EN VIEWPORT, jamais `fullPage` — la capture montre ce qui se voit sans défiler. */
async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({ path: join(DOSSIER, `${nom}.png`) });
}

const FAMILLE = uuidv7();
const CODE_FAMILLE = "9K17AFAM";
const LIBELLE_FAMILLE = "9K17A-Famille";

const CODE_SOUS_TYPE = "9K17AST";
const LIBELLE_SOUS_TYPE = "9K17A-SousType";
const LIBELLE_SOUS_TYPE_MODIFIE = "9K17A-SousTypeModifie";

const MARQUE_MODELE = "9K17A-Marque";
const REFERENCE_MODELE = "9K17A-Ref1";

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
    await client.modeleMateriel.deleteMany({
      where: { reference: REFERENCE_MODELE },
    });
    await client.sousTypeMateriel.deleteMany({
      where: { code: CODE_SOUS_TYPE },
    });
    await client.familleMateriel.deleteMany({ where: { code: CODE_FAMILLE } });
  } finally {
    await client.$disconnect();
  }
});

async function connexionAdmin(page: Page): Promise<void> {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
}

test("l'onglet « Sous-types » existe, troisième après Familles et Modèles", async ({
  page,
}) => {
  await connexionAdmin(page);
  await page.goto("/parametres/materiel");

  const nav = page.locator('nav[data-nav="materiel"]');
  await expect(
    nav.getByRole("link", { name: fr["materiel.sous_types"] }),
  ).toBeVisible();

  await nav.getByRole("link", { name: fr["materiel.sous_types"] }).click();
  await expect(page).toHaveURL(/\/parametres\/materiel\?onglet=sous-types$/);
  await expect(
    nav.getByRole("link", { name: fr["materiel.sous_types"] }),
  ).toHaveAttribute("aria-current", "page");
});

test("« Ajouter un sous-type », puis « Modifier » depuis le volet, valeur relue en base", async ({
  page,
}) => {
  await connexionAdmin(page);
  await page.goto("/parametres/materiel?onglet=sous-types");

  await page
    .getByRole("link", { name: fr["materiel.creer_sous_type"] })
    .click();
  const volet = page.getByRole("dialog");
  await expect(
    volet.getByRole("heading", { name: fr["materiel.creer_sous_type"] }),
  ).toBeVisible();

  await volet
    .getByLabel(fr["materiel.famille"])
    .selectOption({ label: LIBELLE_FAMILLE });
  await volet.getByLabel(fr["materiel.code"]).fill(CODE_SOUS_TYPE);
  await volet.getByLabel(fr["materiel.libelle"]).fill(LIBELLE_SOUS_TYPE);
  await volet
    .getByRole("button", { name: fr["materiel.creer_action"] })
    .click();

  // 9K18A-MATERIEL-RETOUR-ONGLET — le retour reste sur « Sous-types », PAS
  // sur « Familles » (le défaut), et repère la ligne créée.
  await expect(page).toHaveURL(
    /\/parametres\/materiel\?onglet=sous-types&ligne=/,
  );
  await page.goto("/parametres/materiel?onglet=sous-types");
  const table = page.locator("table").first();
  await expect(table.locator("tr", { hasText: LIBELLE_SOUS_TYPE })).toHaveCount(
    1,
  );

  const ligne = table.locator("tr", { hasText: CODE_SOUS_TYPE });
  await ligne.getByRole("link", { name: fr["materiel.modifier"] }).click();

  const voletModifier = page.getByRole("dialog");
  await expect(voletModifier.getByLabel(fr["materiel.code"])).toHaveValue(
    CODE_SOUS_TYPE,
  );
  await voletModifier
    .getByLabel(fr["materiel.libelle"])
    .fill(LIBELLE_SOUS_TYPE_MODIFIE);
  await voletModifier
    .getByRole("button", { name: fr["materiel.enregistrer"] })
    .click();

  await expect(page).toHaveURL(
    /\/parametres\/materiel\?onglet=sous-types&ligne=/,
  );
  await page.goto("/parametres/materiel?onglet=sous-types");
  await expect(
    table.locator("tr", { hasText: LIBELLE_SOUS_TYPE_MODIFIE }),
  ).toHaveCount(1);
});

test("un modèle choisit le sous-type créé plus haut — relu en base sur la fiche", async ({
  page,
}) => {
  await connexionAdmin(page);
  await page.goto("/parametres/materiel?onglet=modeles");

  await page.getByRole("link", { name: fr["materiel.creer_modele"] }).click();
  const volet = page.getByRole("dialog");
  await expect(
    volet.getByRole("heading", { name: fr["materiel.creer_modele"] }),
  ).toBeVisible();

  await volet
    .getByLabel(fr["materiel.famille"])
    .selectOption({ label: LIBELLE_FAMILLE });
  await volet
    .getByLabel(fr["materiel.sous_type"])
    .selectOption({ label: LIBELLE_SOUS_TYPE_MODIFIE });
  await volet.getByLabel(fr["materiel.marque"]).fill(MARQUE_MODELE);
  await volet.getByLabel(fr["materiel.reference"]).fill(REFERENCE_MODELE);
  await volet
    .getByRole("button", { name: fr["materiel.creer_action"] })
    .click();

  await expect(page).toHaveURL(/\/parametres\/materiel\?onglet=modeles&ligne=/);
  await page.goto(
    `/parametres/materiel?onglet=modeles&q=${encodeURIComponent(REFERENCE_MODELE)}`,
  );
  const table = page.locator("table").first();
  const ligne = table.locator("tr", { hasText: REFERENCE_MODELE });
  await expect(ligne).toHaveCount(1);
  await expect(
    ligne.filter({ hasText: LIBELLE_SOUS_TYPE_MODIFIE }),
  ).toHaveCount(1);

  await ligne.getByRole("link", { name: fr["materiel.modifier"] }).click();
  const voletModifier = page.getByRole("dialog");
  const selectSousType = voletModifier.getByLabel(fr["materiel.sous_type"]);
  const libelleChoisi = await selectSousType.evaluate(
    (el: HTMLSelectElement) => el.options[el.selectedIndex]?.text,
  );
  expect(libelleChoisi).toBe(LIBELLE_SOUS_TYPE_MODIFIE);
});

test("captures — Paramètres › Matériel (onglet Sous-types) et la fiche d'un modèle, à 1280 et 375 px", async ({
  page,
}) => {
  await connexionAdmin(page);

  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.goto("/parametres/materiel?onglet=sous-types");
  await capturer(page, "sous-types-1280");

  await page.goto(
    `/parametres/materiel?onglet=modeles&q=${encodeURIComponent(REFERENCE_MODELE)}`,
  );
  const table = page.locator("table").first();
  await table
    .locator("tr", { hasText: REFERENCE_MODELE })
    .getByRole("link", { name: fr["materiel.modifier"] })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await capturer(page, "fiche-modele-sous-type-1280");

  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/parametres/materiel?onglet=sous-types");
  await capturer(page, "sous-types-375");

  await page.goto(
    `/parametres/materiel?onglet=modeles&q=${encodeURIComponent(REFERENCE_MODELE)}`,
  );
  await page
    .locator("li", { hasText: REFERENCE_MODELE })
    .getByRole("link", { name: fr["materiel.modifier"] })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await capturer(page, "fiche-modele-sous-type-375");
});

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
 * 9K18A-MATERIEL-RETOUR-ONGLET — après « Valider », revenir sur le MÊME
 * onglet, avec les MÊMES filtres, au même endroit de la page.
 *
 * Signalé par Alexis le 10/11/2026 : ajouter un sous-type depuis l'onglet
 * « Modèles » renvoyait systématiquement sur l'onglet « Familles ». Trois
 * scénarios, un par onglet — le cas d'Alexis exactement (Modèles, filtré sur
 * une famille), puis Sous-types et Familles.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `9K18A-` : une famille et un modèle SANS
 * sous-type, créés en `beforeAll`, effacés en `afterAll`. Le sous-type et la
 * seconde famille créés PAR les tests sont retrouvés par leur code et
 * effacés au même endroit.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const DOSSIER = join(
  process.cwd(),
  "docs/propositions/9K18A-MATERIEL-RETOUR-ONGLET/captures",
);

/** EN VIEWPORT, jamais `fullPage` — la capture montre ce qui se voit sans défiler. */
async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({ path: join(DOSSIER, `${nom}.png`) });
}

const FAMILLE = uuidv7();
const CODE_FAMILLE = "9K18AFAM";
const LIBELLE_FAMILLE = "9K18A-Famille";

const MODELE = uuidv7();
const MARQUE_MODELE = "9K18A-Marque";
const REFERENCE_MODELE = "9K18A-Ref1";

const SOUS_TYPE_EXISTANT = uuidv7();
const CODE_SOUS_TYPE_EXISTANT = "9K18AST0";
const LIBELLE_SOUS_TYPE_EXISTANT = "9K18A-SousTypeExistant";

const CODE_SOUS_TYPE_CREE = "9K18AST1";
const LIBELLE_SOUS_TYPE_CREE = "9K18A-SousTypeCree";

const CODE_FAMILLE_CREEE = "9K18AFC";
const LIBELLE_FAMILLE_CREEE = "9K18A-FamilleCreee";
const LIBELLE_FAMILLE_MODIFIEE = "9K18A-FamilleModifiee";

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
    await client.sousTypeMateriel.create({
      data: {
        id: SOUS_TYPE_EXISTANT,
        societe_id: societe.id,
        famille_id: FAMILLE,
        code: CODE_SOUS_TYPE_EXISTANT,
        libelle: LIBELLE_SOUS_TYPE_EXISTANT,
        actif: true,
      },
    });
    await client.modeleMateriel.create({
      data: {
        id: MODELE,
        societe_id: societe.id,
        famille_id: FAMILLE,
        marque: MARQUE_MODELE,
        reference: REFERENCE_MODELE,
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
      where: { code: { in: [CODE_SOUS_TYPE_EXISTANT, CODE_SOUS_TYPE_CREE] } },
    });
    await client.familleMateriel.deleteMany({
      where: { code: { in: [CODE_FAMILLE, CODE_FAMILLE_CREEE] } },
    });
  } finally {
    await client.$disconnect();
  }
});

async function connexionAdmin(page: Page): Promise<void> {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
}

test("LE CAS D'ALEXIS — onglet Modèles filtré sur une famille, ajouter un sous-type au modèle, revenir au MÊME endroit", async ({
  page,
}) => {
  await connexionAdmin(page);
  await page.setViewportSize({ width: 1280, height: 1200 });

  await page.goto(
    `/parametres/materiel?onglet=modeles&famille=${FAMILLE}&q=${encodeURIComponent(REFERENCE_MODELE)}`,
  );
  const table = page.locator("table").first();
  const ligne = table.locator("tr", { hasText: REFERENCE_MODELE });
  await ligne.getByRole("link", { name: fr["materiel.modifier"] }).click();

  const volet = page.getByRole("dialog");
  await volet
    .getByLabel(fr["materiel.sous_type"])
    .selectOption({ label: LIBELLE_SOUS_TYPE_EXISTANT });
  await volet.getByRole("button", { name: fr["materiel.enregistrer"] }).click();

  // LA CAPTURE D'ABORD — même sur l'ANCIEN code (rouge attendu ensuite), elle
  // montre déjà où la page est retombée (`captures-avant-apres-e2e`).
  await capturer(page, "cas-alexis-modeles-apres-1280");
  const url = new URL(page.url());
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(url.toString());
  await capturer(page, "cas-alexis-modeles-apres-375");

  // LE CŒUR DU TICKET : onglet=modeles ET famille=<FAMILLE> ET q=<reference>
  // survivent, jamais l'onglet Familles par défaut.
  expect(url.searchParams.get("onglet")).toBe("modeles");
  expect(url.searchParams.get("famille")).toBe(FAMILLE);
  expect(url.searchParams.get("q")).toBe(REFERENCE_MODELE);
  expect(url.searchParams.has("ligne")).toBe(true);
  await expect(table.locator("tr", { hasText: REFERENCE_MODELE })).toHaveCount(
    1,
  );
});

test("L'ONGLET SOUS-TYPES — créer un sous-type, revenir sur Sous-types, pas sur Familles", async ({
  page,
}) => {
  await connexionAdmin(page);
  await page.setViewportSize({ width: 1280, height: 1200 });

  await page.goto("/parametres/materiel?onglet=sous-types");
  await page
    .getByRole("link", { name: fr["materiel.creer_sous_type"] })
    .click();
  const volet = page.getByRole("dialog");
  await volet
    .getByLabel(fr["materiel.famille"])
    .selectOption({ label: LIBELLE_FAMILLE });
  await volet.getByLabel(fr["materiel.code"]).fill(CODE_SOUS_TYPE_CREE);
  await volet.getByLabel(fr["materiel.libelle"]).fill(LIBELLE_SOUS_TYPE_CREE);
  await volet
    .getByRole("button", { name: fr["materiel.creer_action"] })
    .click();

  await capturer(page, "onglet-sous-types-apres-1280");
  const url = new URL(page.url());
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(url.toString());
  await capturer(page, "onglet-sous-types-apres-375");

  expect(url.searchParams.get("onglet")).toBe("sous-types");
  expect(url.searchParams.has("ligne")).toBe(true);
});

test("L'ONGLET FAMILLES — créer puis modifier une famille, le défaut reste atteignable sans régression", async ({
  page,
}) => {
  await connexionAdmin(page);
  await page.setViewportSize({ width: 1280, height: 1200 });

  await page.goto("/parametres/materiel");
  await page.getByRole("link", { name: fr["materiel.creer_famille"] }).click();
  const volet = page.getByRole("dialog");
  await volet.getByLabel(fr["materiel.code"]).fill(CODE_FAMILLE_CREEE);
  await volet.getByLabel(fr["materiel.libelle"]).fill(LIBELLE_FAMILLE_CREEE);
  await volet
    .getByRole("button", { name: fr["materiel.creer_action"] })
    .click();

  await capturer(page, "onglet-familles-apres-creation-1280");
  const urlCreation = new URL(page.url());
  const table = page.locator("table").first();
  await expect(
    table.locator("tr", { hasText: LIBELLE_FAMILLE_CREEE }),
  ).toHaveCount(1);

  const ligneCreee = table.locator("tr", { hasText: CODE_FAMILLE_CREEE });
  await ligneCreee.getByRole("link", { name: fr["materiel.modifier"] }).click();
  const voletModifier = page.getByRole("dialog");
  await voletModifier
    .getByLabel(fr["materiel.libelle"])
    .fill(LIBELLE_FAMILLE_MODIFIEE);
  await voletModifier
    .getByRole("button", { name: fr["materiel.enregistrer"] })
    .click();
  await expect(
    table.locator("tr", { hasText: LIBELLE_FAMILLE_MODIFIEE }),
  ).toHaveCount(1);

  const urlModification = new URL(page.url());
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(urlModification.toString());
  await capturer(page, "onglet-familles-apres-modification-375");

  expect(urlCreation.searchParams.has("onglet")).toBe(false);
  expect(urlCreation.searchParams.has("ligne")).toBe(true);
});

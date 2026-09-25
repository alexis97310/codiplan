import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 80-VISUEL-2 — « n MODÈLES » D'UNE FAMILLE MÈNE AUX MODÈLES DE CETTE FAMILLE.
 *
 * ## Le défaut, mesuré sur `main` le 25/09/2026 (SAV-29)
 *
 * Dans le tableau des familles de `/parametres/materiel`, « n modèles » était
 * un simple saut d'ancre `#modeles` vers la carte qui liste TOUS les modèles,
 * toutes familles confondues — avec dix familles et quatre-vingts modèles, il
 * fallait chercher à la main ceux de la famille cliquée.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `VIS2-`
 *
 * Deux familles créées en `beforeAll`, supprimées en `afterAll` — aucune
 * ligne du semis n'est touchée. La première porte deux modèles, la seconde
 * un seul : le nombre exact que le lien affiche (« 2 modèles » / « 1 modèle »)
 * et que l'épreuve retrouve après le clic.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const FAMILLE_A = uuidv7();
const FAMILLE_B = uuidv7();
const MODELE_A1 = uuidv7();
const MODELE_A2 = uuidv7();
const MODELE_B1 = uuidv7();

const CODE_A = "VIS2A";
const CODE_B = "VIS2B";
const LIBELLE_A = "VIS2-Famille A";
const LIBELLE_B = "VIS2-Famille B";
const MARQUE_A = "VIS2-MarqueA";
const MARQUE_B = "VIS2-MarqueB";
const REFERENCE_A1 = "VIS2-RefA1";
const REFERENCE_A2 = "VIS2-RefA2";
const REFERENCE_B1 = "VIS2-RefB1";

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    await client.familleMateriel.create({
      data: {
        id: FAMILLE_A,
        societe_id: reperes.societeId,
        code: CODE_A,
        libelle: LIBELLE_A,
      },
    });
    await client.familleMateriel.create({
      data: {
        id: FAMILLE_B,
        societe_id: reperes.societeId,
        code: CODE_B,
        libelle: LIBELLE_B,
      },
    });
    await client.modeleMateriel.create({
      data: {
        id: MODELE_A1,
        societe_id: reperes.societeId,
        famille_id: FAMILLE_A,
        marque: MARQUE_A,
        reference: REFERENCE_A1,
      },
    });
    await client.modeleMateriel.create({
      data: {
        id: MODELE_A2,
        societe_id: reperes.societeId,
        famille_id: FAMILLE_A,
        marque: MARQUE_A,
        reference: REFERENCE_A2,
      },
    });
    await client.modeleMateriel.create({
      data: {
        id: MODELE_B1,
        societe_id: reperes.societeId,
        famille_id: FAMILLE_B,
        marque: MARQUE_B,
        reference: REFERENCE_B1,
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
      where: { famille_id: { in: [FAMILLE_A, FAMILLE_B] } },
    });
    await client.familleMateriel.deleteMany({
      where: { id: { in: [FAMILLE_A, FAMILLE_B] } },
    });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/80-VISUEL-2/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-1280.png`),
    fullPage: true,
  });
}

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("« 2 modèles » de la première famille mène exactement à ses deux modèles, aucun de la seconde", async ({
  page,
}) => {
  await page.goto("/parametres/materiel");

  // La table des FAMILLES est la première du document — la seconde, dans la
  // carte « Modèles », montre aussi le libellé de la famille en colonne, et
  // il ne faut pas confondre les deux.
  const tableFamilles = page.locator("table").first();
  const ligneFamilleA = tableFamilles.locator("tr", { hasText: LIBELLE_A });
  const lienModelesA = ligneFamilleA.locator(
    `a[href="/parametres/materiel?famille=${FAMILLE_A}#modeles"]`,
  );
  await expect(lienModelesA).toBeVisible();

  await lienModelesA.click();
  await expect(page).toHaveURL(
    new RegExp(`/parametres/materiel\\?famille=${FAMILLE_A}#modeles`),
  );

  const carteModeles = page.locator("#modeles");
  await expect(carteModeles.locator("h2", { hasText: LIBELLE_A })).toHaveCount(
    1,
  );
  await expect(
    carteModeles.getByRole("link", { name: fr["materiel.tout_afficher"] }),
  ).toHaveAttribute("href", "/parametres/materiel#modeles");

  const ligneModeleDans = (ref: string) =>
    carteModeles.locator("table tbody tr", { hasText: ref });

  const lignesVis2 = carteModeles.locator("table tbody tr", {
    hasText: "VIS2-Ref",
  });
  await expect(lignesVis2).toHaveCount(2);
  await expect(ligneModeleDans(REFERENCE_A1)).toHaveCount(1);
  await expect(ligneModeleDans(REFERENCE_A2)).toHaveCount(1);
  await expect(ligneModeleDans(REFERENCE_B1)).toHaveCount(0);

  // Les formulaires « modifier » suivent le même filtre.
  await expect(page.locator("h2", { hasText: REFERENCE_A1 })).toHaveCount(1);
  await expect(page.locator("h2", { hasText: REFERENCE_B1 })).toHaveCount(0);

  await capturer(page, "modeles-filtres-famille-a");

  await carteModeles
    .getByRole("link", { name: fr["materiel.tout_afficher"] })
    .click();
  await expect(page).toHaveURL(/\/parametres\/materiel#modeles$/);
  await expect(ligneModeleDans(REFERENCE_A1)).toHaveCount(1);
  await expect(ligneModeleDans(REFERENCE_A2)).toHaveCount(1);
  await expect(ligneModeleDans(REFERENCE_B1)).toHaveCount(1);
  await expect(page.locator("h2", { hasText: REFERENCE_B1 })).toHaveCount(1);

  await capturer(page, "modeles-tout-afficher");
});

test("un identifiant de famille inconnu est ignoré en silence : liste complète, jamais d'erreur, jamais l'identifiant affiché", async ({
  page,
}) => {
  const idInconnu = "01a0f100-0000-7000-8000-00000000dead";
  await page.goto(`/parametres/materiel?famille=${idInconnu}#modeles`);

  const carteModeles = page.locator("#modeles");
  const ligneModeleDans = (ref: string) =>
    carteModeles.locator("table tbody tr", { hasText: ref });
  await expect(ligneModeleDans(REFERENCE_A1)).toHaveCount(1);
  await expect(ligneModeleDans(REFERENCE_A2)).toHaveCount(1);
  await expect(ligneModeleDans(REFERENCE_B1)).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: fr["materiel.tout_afficher"] }),
  ).toHaveCount(0);
  const html = await page.content();
  expect(html).not.toContain(idInconnu);
});

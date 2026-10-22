import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { ouvrirUneSession } from "./setup/session";
import { SCENE } from "./setup/scene";

/**
 * LES CAPTURES DE 9G9C-CARTES-FICHES — AVANT/APRÈS, même recette que
 * `zz-captures-9g9a.spec.ts` : rien n'est écrit sans `CAPTURES_9G9C` (le
 * dossier), `CAPTURES_9G9C_PHASE` choisit entre `avant` et `apres` (par
 * défaut `apres`).
 *
 * La fiche intervention se rejoint par `SCENE.deplacable` — un identifiant
 * FIXE, jamais le premier lien de la liste : 9G9A a mesuré que
 * `a[href^="/interventions/"]` sur `/interventions` attrape le lien
 * « Nouvelle intervention » (même préfixe) avant toute ligne du registre, et
 * sa capture « fiche-intervention » montrait autre chose que la fiche. Les
 * autres fiches (client, site, lot d'import) se rejoignent par un lien
 * scopé à l'intérieur du conteneur qui les rend (`table` ou `main`), jamais
 * un sélecteur global, et en excluant explicitement le lien de création
 * (même préfixe, même piège) — chaque navigation est confirmée par
 * `toHaveURL` avant la photo, pour la même raison.
 *
 * Aucune fiche demande capturée : `prisma/seed.ts` ne sème aucune
 * `demande` (seul le registre vide est démontrable) — forger une demande
 * dans ce spec dépasserait le territoire de ce lot.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9G9C ?? "";
const PHASE = process.env.CAPTURES_9G9C_PHASE === "avant" ? "avant" : "apres";

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  await page.setViewportSize({ width: largeur, height: 900 });
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${PHASE}-${nom}-${largeur}.png`),
    fullPage: true,
  });
}

async function capturerLesDeuxLargeurs(page: Page, nom: string): Promise<void> {
  await capturer(page, nom, 1280);
  await capturer(page, nom, 375);
}

test("fiche intervention", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto(`/interventions/${SCENE.deplacable}`);
  await expect(page).toHaveURL(
    new RegExp(`/interventions/${SCENE.deplacable}`),
  );
  await expect(page.locator("main")).toBeVisible();
  await capturerLesDeuxLargeurs(page, "fiche-intervention");
});

test("registre des interventions", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto("/interventions");
  await expect(page.locator("main")).toBeVisible();
  await capturerLesDeuxLargeurs(page, "interventions");
});

test("fiche client", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto("/clients");
  const lien = page
    .locator('main a[href^="/clients/"]:not([href="/clients/nouveau"])')
    .first();
  await expect(lien).toBeVisible();
  await lien.click();
  await expect(page).toHaveURL(/\/clients\/[0-9a-f-]+$/);
  await expect(page.locator("main")).toBeVisible();
  await capturerLesDeuxLargeurs(page, "fiche-client");
});

test("nouveau client", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto("/clients/nouveau");
  await expect(page.locator("main")).toBeVisible();
  await capturerLesDeuxLargeurs(page, "clients-nouveau");
});

test("liste des clients", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto("/clients");
  await expect(page.locator("main")).toBeVisible();
  await capturerLesDeuxLargeurs(page, "clients");
});

test("fiche site", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto("/sites");
  const lien = page
    .locator('main a[href^="/sites/"]:not([href="/sites/nouveau"])')
    .first();
  await expect(lien).toBeVisible();
  await lien.click();
  await expect(page).toHaveURL(/\/sites\/[0-9a-f-]+$/);
  await expect(page.locator("main")).toBeVisible();
  await capturerLesDeuxLargeurs(page, "fiche-site");
});

test("nouveau site", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto("/sites/nouveau");
  await expect(page.locator("main")).toBeVisible();
  await capturerLesDeuxLargeurs(page, "sites-nouveau");
});

test("liste des sites", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto("/sites");
  await expect(page.locator("main")).toBeVisible();
  await capturerLesDeuxLargeurs(page, "sites");
});

test("liste des demandes", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto("/demandes");
  await expect(page.locator("main")).toBeVisible();
  await capturerLesDeuxLargeurs(page, "demandes");
});

test("fiche machine (parc)", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto("/parc");
  const ficheComplete = page.getByRole("link", { name: /fiche complète/i });
  await expect(ficheComplete).toBeVisible();
  await ficheComplete.click();
  await expect(page).toHaveURL(/\/parc\/[0-9a-f-]+/);
  await expect(page.locator("main")).toBeVisible();
  await capturerLesDeuxLargeurs(page, "fiche-machine");
});

test("nouvelle machine", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto("/parc/nouvelle");
  await expect(page.locator("main")).toBeVisible();
  await capturerLesDeuxLargeurs(page, "parc-nouvelle");
});

test("parc", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto("/parc");
  await expect(page.locator("main")).toBeVisible();
  await capturerLesDeuxLargeurs(page, "parc");
});

test("registre VGP", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto("/vgp");
  await expect(page.locator("main")).toBeVisible();
  await capturerLesDeuxLargeurs(page, "vgp");
});

test("VGP à déterminer", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto("/vgp/a-determiner");
  await expect(page.locator("main")).toBeVisible();
  await capturerLesDeuxLargeurs(page, "vgp-a-determiner");
});

test("absences", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto("/absences");
  await expect(page.locator("main")).toBeVisible();
  await capturerLesDeuxLargeurs(page, "absences");
});

test("lot d'import", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto("/imports");
  const lien = page.locator('table a[href^="/imports/"]').first();
  await expect(lien).toBeVisible();
  await lien.click();
  await expect(page).toHaveURL(/\/imports\/[0-9a-f-]+/);
  await expect(page.locator("main")).toBeVisible();
  await capturerLesDeuxLargeurs(page, "fiche-import");
});

test("liste des imports", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto("/imports");
  await expect(page.locator("main")).toBeVisible();
  await capturerLesDeuxLargeurs(page, "imports");
});

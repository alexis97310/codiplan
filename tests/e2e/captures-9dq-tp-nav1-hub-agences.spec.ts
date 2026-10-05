import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, type Page, test } from "@playwright/test";

import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LES CAPTURES DE 9DQ-TP-NAV1-HUB-AGENCES — même recette que
 * `captures-9aq-cg1-retour-parametres.spec.ts` : rien n'est écrit sans la
 * variable d'environnement qui nomme le dossier, pour que `pnpm test:e2e`
 * ordinaire n'écrive jamais de fichier.
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant le lot (`CAPTURES_9DQ_FASE=avant`), une fois sur le code
 * livré (`CAPTURES_9DQ_FASE=apres`). LECTURE SEULE : aucune scène propre,
 * les écrans se lisent tels que le semis les rend déjà.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9DQ ?? "";
const FASE = process.env.CAPTURES_9DQ_FASE ?? "";

async function capturer(page: Page, ecran: string, largeur: number) {
  if (DOSSIER === "" || FASE === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${ecran}-${FASE}-${largeur}.png`),
    fullPage: true,
  });
}

for (const largeur of [1280, 375] as const) {
  test(`capture — hub /parametres à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
    await page.goto("/parametres");
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "hub", largeur);
  });
}

test("capture — le menu, entrée Paramètres", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1200 });
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/parametres");
  await expect(page.locator("main")).toBeVisible();
  await capturer(page, "menu", 1280);
});

test("capture — liste des agences", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1200 });
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/parametres/agences");
  await expect(page.locator("main")).toBeVisible();
  await capturer(page, "liste-agences", 1280);
});

test("capture — fiche d'une agence", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1200 });
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/parametres/agences");
  await page.locator("main tbody tr").first().getByRole("link").last().click();
  await page.waitForURL(/\/parametres\/agences\/[0-9a-f-]+$/);
  await expect(page.locator("main")).toBeVisible();
  await capturer(page, "fiche-agence", 1280);
});

test("capture — création d'une agence (listes territoire et fuseau)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1200 });
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/parametres/agences/nouvelle");
  await expect(page.locator("main")).toBeVisible();
  await capturer(page, "creation-agence", 1280);
});

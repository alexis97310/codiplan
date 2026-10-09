import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES D'ÉTATS DE 9CB-TP-UX1-3-COMPOSANTS — même recette que
 * `captures-pg-c5-tiroir.spec.ts` : AVANT sur le code d'avant ce ticket,
 * APRÈS sur le code livré.
 *
 * **Le tiroir de menu, à 375 px** — il existe des deux côtés (D121,
 * COQUE-375) ; seul son CONTENU change — les icônes du menu (D139, commit
 * « icônes du menu »).
 *
 * **La tuile cliquable, au survol et au focus clavier, à 1280 px** — le
 * chevron et l'anneau de focus n'existent qu'APRÈS ce ticket (D140, commit
 * « tuile cliquable ») : AVANT, la capture montre la tuile ordinaire.
 *
 * LECTURE SEULE : aucune scène forgée, aucune donnée créée ni supprimée —
 * le déclencheur, la colonne et la tuile existent sur toute session ouverte.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9CB ?? "";

async function capturer(page: Page, nom: string): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({ path: join(DOSSIER, `${nom}.png`), fullPage: true });
}

test.describe("à 375px", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 1200 });
    await ouvrirUneSession(page);
  });

  test("capture — le tiroir de menu ouvert", async ({ page }) => {
    await page.goto("/tableau-de-bord");
    await page.getByRole("button", { name: fr["nav.ouvrir_le_menu"] }).click();
    const colonne = page.locator("#colonne-navigation");
    await expect(colonne).toBeVisible();
    await page.waitForTimeout(200);
    await capturer(page, "tiroir-menu-ouvert-375");
  });
});

test.describe("à 1280px", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await ouvrirUneSession(page);
  });

  test("capture — la tuile « À planifier », au survol", async ({ page }) => {
    await page.goto("/tableau-de-bord");
    const tuile = page.locator('[data-bloc="kpi-a-planifier"] a').first();
    await expect(tuile).toBeVisible();
    await tuile.hover();
    await page.waitForTimeout(200);
    await capturer(page, "tuile-survol-1280");
  });

  test("capture — la tuile « À planifier », au focus clavier", async ({
    page,
  }) => {
    await page.goto("/tableau-de-bord");
    const tuile = page.locator('[data-bloc="kpi-a-planifier"] a').first();
    await expect(tuile).toBeVisible();
    await tuile.focus();
    await page.waitForTimeout(200);
    await capturer(page, "tuile-focus-1280");
  });
});

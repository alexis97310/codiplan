import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { reperesDeLaScene } from "./setup/reperes";
import { cleDeJour } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE PG-C6-FILTRES-AUJOURDHUI — même recette que les autres
 * parties de ce ticket : AVANT sur le code d'avant (`git worktree`), APRÈS
 * sur le code livré. Aucune clé typée du dictionnaire : la barre de filtres
 * n'existe pas sur le code d'AVANT.
 *
 * Aucune scène forgée : ces captures montrent la STRUCTURE de la barre
 * d'outils (filtres, « Aujourd'hui »), jamais le contenu du semis.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_PG_C6 ?? "";

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

async function capturerLaBarre(page: Page, largeur: number): Promise<void> {
  const reperes = await reperesDeLaScene();
  await page.goto(`/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`);
  await expect(page.locator("main")).toBeVisible();

  const filtreStatut = page.locator('select[name="statut"]');
  await capturer(
    page,
    (await filtreStatut.count()) > 0
      ? "barre-outils-apres"
      : "barre-outils-avant",
    largeur,
  );
}

test.describe("à 1280px", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1200 });
    await ouvrirUneSession(page);
  });

  test("capture — la barre d'outils du planning, à 1280px", async ({
    page,
  }) => {
    await capturerLaBarre(page, 1280);
  });
});

test.describe("à 375px", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 1200 });
    await ouvrirUneSession(page);
  });

  test("capture — la barre d'outils du planning, à 375px", async ({ page }) => {
    await capturerLaBarre(page, 375);
  });
});

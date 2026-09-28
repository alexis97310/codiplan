import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { cleDeJour } from "./setup/scene";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE PG-C4-CHARGE (9BJA-REPRISE-9BJ, 29/09/2026) — 9BJ avait
 * livré PG-C4 sans les prendre (passation de 9BJ, « Ce que je n'ai PAS
 * fait »). Même recette que les autres captures AVANT/APRÈS du dépôt :
 * rien n'est écrit sans une variable d'environnement qui nomme le dossier,
 * et AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois
 * sur le code d'avant le ticket (`git worktree`), une fois sur le code
 * livré. La barre PAR JOUR dans les cases (point 2 du ticket 9BJ, non fait
 * par lui) n'existe QUE sur le code livré par la reprise elle-même : AVANT,
 * cette capture montre la colonne compacte sans elle.
 *
 * SCÈNE DE DÉMONSTRATION SEULEMENT (consigne du ticket) : aucune donnée
 * forgée, la semaine courante du jeu de démonstration.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_PG_C4 ?? "";

async function capturer(page: Page, nom: string, largeur: number) {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("capture — colonne technicien et barres, 1280px", async ({ page }) => {
  const reperes = await reperesDeLaScene();
  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.goto(`/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`);
  await expect(page.locator("main")).toBeVisible();
  await capturer(page, "colonne-technicien-barres", 1280);
});

test("capture — colonne technicien et barres, 375px", async ({ page }) => {
  const reperes = await reperesDeLaScene();
  await page.setViewportSize({ width: 375, height: 1600 });
  await page.goto(`/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`);
  await expect(page.locator("main")).toBeVisible();
  await capturer(page, "colonne-technicien-barres", 375);
});

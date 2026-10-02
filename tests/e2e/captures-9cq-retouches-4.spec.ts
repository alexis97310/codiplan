import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9CQ-RETOUCHES-4 — même recette que
 * `captures-9cn-retouches-3.spec.ts`.
 *
 * AUCUN ÉCRAN N'EST TOUCHÉ PAR CE LOT : il ne resserre que des gardiens de
 * tests (priorité, focus, `sansCommentaires`, trois copies locales
 * retirées). La capture sert de preuve que le tableau de bord reste
 * identique. AVANT/APRÈS se prend en rejouant ce même fichier deux fois
 * (`git worktree`, une fois sur le code d'avant ce lot, une fois sur le code
 * livré).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9CQ ?? "";

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

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
      await ouvrirUneSession(page);
    });

    test(`capture — tableau de bord, à ${largeur}px`, async ({ page }) => {
      await page.goto("/tableau-de-bord");
      await expect(
        page.getByRole("heading", { name: fr["tableau_de_bord.titre"] }),
      ).toBeVisible();
      await capturer(page, "tableau-de-bord", largeur);
    });
  });
}

import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE PG-A2-ORDRE-TECHNICIENS (28/09/2026) — même recette que
 * `captures-pg-a1-feries-grille.spec.ts`.
 *
 * AUCUNE SCÈNE FORGÉE ICI : le défaut se reproduit directement sur le jeu de
 * démonstration — la vue Jour triait par `technicienId` (un UUID), la grille
 * Semaine par libellé. La capture prend un jour OUVERT de la scène, le lundi
 * 21/09/2026, et montre l'ordre des colonnes de la vue Jour.
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant ce ticket (`git worktree`), une fois sur le code livré.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_PG_A2 ?? "";

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

    test(`capture — vue Jour du 21/09/2026 (jour ouvert), ordre des colonnes, à ${largeur}px`, async ({
      page,
    }) => {
      await page.goto("/planning?vue=jour&jour=2026-09-21");
      await expect(
        page.getByRole("heading", { name: fr["planning.titre"] }),
      ).toBeVisible();
      await capturer(page, "jour-21-09-2026-ordre", largeur);
    });
  });
}

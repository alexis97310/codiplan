import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9CN-RETOUCHES-3 — même recette que
 * `captures-pg-a2-ordre-techniciens.spec.ts`.
 *
 * AUCUNE SCÈNE FORGÉE ICI : le ticket déplace `ouTravaille` de `page.tsx`
 * vers `presentation.ts` sans toucher au rendu — la capture sert de preuve
 * que l'écran reste identique. AVANT/APRÈS se prend en rejouant ce même
 * fichier deux fois (`git worktree`, une fois sur le code d'avant ce lot,
 * une fois sur le code livré).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9CN ?? "";

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

    test(`capture — planning, vue Semaine, colonne Technicien avec son agence, à ${largeur}px`, async ({
      page,
    }) => {
      await page.goto("/planning");
      await expect(
        page.getByRole("heading", { name: fr["planning.titre"] }),
      ).toBeVisible();
      await capturer(page, "planning-semaine-agence", largeur);
    });
  });
}

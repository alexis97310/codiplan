import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE PG-A1-FERIES-GRILLE (28/09/2026) — même recette que
 * `captures-aa5-banniere-planning.spec.ts` : rien n'est écrit sans la
 * variable d'environnement qui nomme le dossier.
 *
 * AUCUNE SCÈNE FORGÉE ICI : le férié qui manque à la démonstration est déjà
 * dans le semis — « Fête de la citoyenneté », le 24 septembre, territoire NC
 * (`prisma/seed-data.ts:364`). Les captures rejouent donc directement les
 * deux URL du planning sur le jeu de démonstration, avec le compte ADV de
 * CODIMA-NC.
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant ce ticket (`git stash`), une fois sur le code livré.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_PG_A1 ?? "";

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

    test(`capture — vue Semaine du 21/09/2026 (jeudi férié dans la semaine), à ${largeur}px`, async ({
      page,
    }) => {
      await page.goto("/planning?semaine=2026-09-21");
      await expect(
        page.getByRole("heading", { name: fr["planning.titre"] }),
      ).toBeVisible();
      await capturer(page, "semaine-21-09-2026", largeur);
    });

    test(`capture — vue Jour du 24/09/2026 (jeudi férié), à ${largeur}px`, async ({
      page,
    }) => {
      await page.goto("/planning?vue=jour&jour=2026-09-24");
      await expect(
        page.getByRole("heading", { name: fr["planning.titre"] }),
      ).toBeVisible();
      await expect(
        page.locator('[data-maquette-bloc="vue-jour"]'),
      ).toBeVisible();
      await capturer(page, "jour-24-09-2026", largeur);
    });
  });
}

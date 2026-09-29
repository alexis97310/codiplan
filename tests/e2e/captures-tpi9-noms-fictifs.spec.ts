import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9BY-TP-I9-NOMS-REELS (30/09/2026) — même recette que
 * `captures-pg-a2-ordre-techniciens.spec.ts`.
 *
 * AUCUNE SCÈNE FORGÉE ICI : le changement mesuré est le NOM des quatre
 * techniciens de la démonstration (I9), déjà posés par le semis — la
 * capture prend un jour OUVERT de la scène, le lundi 21/09/2026, où la vue
 * Jour et la vue Semaine montrent leurs noms.
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant ce ticket (`git worktree`, base ressemée avec les anciens
 * noms), une fois sur le code livré (mémoire « captures-avant-apres-e2e »).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_TPI9 ?? "";

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

    test(`capture — planning vue Semaine, à ${largeur}px`, async ({ page }) => {
      await page.goto("/planning");
      await expect(
        page.getByRole("heading", { name: fr["planning.titre"] }),
      ).toBeVisible();
      await capturer(page, "planning-semaine", largeur);
    });

    test(`capture — planning vue Jour du 21/09/2026, à ${largeur}px`, async ({
      page,
    }) => {
      await page.goto("/planning?vue=jour&jour=2026-09-21");
      await expect(
        page.getByRole("heading", { name: fr["planning.titre"] }),
      ).toBeVisible();
      await capturer(page, "planning-jour", largeur);
    });

    test(`capture — équipe, à ${largeur}px`, async ({ page }) => {
      await page.goto("/parametres/equipe");
      await capturer(page, "equipe", largeur);
    });

    test(`capture — absences, à ${largeur}px`, async ({ page }) => {
      await page.goto("/absences");
      await capturer(page, "absences", largeur);
    });
  });
}

import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9CS-EN-RETARD-VERT-A-ZERO — même recette que
 * `captures-9cq-retouches-4.spec.ts`.
 *
 * AUCUNE SCÈNE FORGÉE : lecture seule du jeu de démonstration du seed.
 * **La tuile NE s'y lit PAS à zéro** — mesuré le 03/10/2026 contre la base
 * d'épreuve, CODIMA-NC (société du compte `adv@codima.test` connecté ici)
 * porte des interventions « en retard » au sens de
 * `lib/interventions/retard.ts` (`enRetard`). Les dates du semis sont
 * replacées par rapport à AUJOURD'HUI à chaque exécution : ce compte varie
 * d'un jour à l'autre et ne tombe jamais sciemment à 0 — ni le commentaire
 * qu'il remplaçait (« jamais d'intervention en retard ») ni un nombre figé
 * ne tiendraient. **La preuve du ton vert à zéro est donc le test
 * unitaire** — `tests/unit/tableau-de-bord/presentation.test.ts`, describe
 * « « En retard » passe au vert à zéro (décision du 02/10/2026, point 4 ;
 * D148) » : `tonEnRetard(0)` rend `"vert"`, `tonEnRetard(1)` et
 * `tonEnRetard(7)` restent `"rouge"`. Ces captures montrent la tuile telle
 * que le semis la rend, au ton **rouge**.
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois (`git
 * worktree`, une fois sur le code d'avant ce lot, une fois sur le code
 * livré).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9CS ?? "";

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

import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9AC-CLIENTS-COMPTEUR-GRIS (27/09/2026) — même recette que
 * `captures-gr12-sites.spec.ts` : rien n'est écrit sans une variable
 * d'environnement qui nomme le dossier, pour que l'exécution ordinaire de
 * `pnpm test:e2e` n'écrive jamais de fichier.
 *
 * `/clients` et `/sites`, à 1280 et 375 px — les deux écrans dont le
 * compteur d'équipements passe de rouge (PASTILLES-1) à gris (décision
 * d'Alexis du 26/09).
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant le lot (`git show <parent>:...` remis temporairement sur
 * le disque), une fois sur le code livré — jamais en comparant deux fichiers
 * distincts.
 */

test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9AC_CLIENTS_COMPTEUR_GRIS ?? "";

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
      await page.setViewportSize({ width: largeur, height: 900 });
      await ouvrirUneSession(page);
    });

    test(`capture — /clients`, async ({ page }) => {
      await page.goto("/clients");
      await expect(page.locator("article").first()).toBeVisible();
      await capturer(page, "liste-clients", largeur);
    });

    test(`capture — /sites`, async ({ page }) => {
      await page.goto("/sites");
      await expect(page.locator("article").first()).toBeVisible();
      await capturer(page, "liste-sites", largeur);
    });
  });
}

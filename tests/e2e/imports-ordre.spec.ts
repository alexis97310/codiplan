import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { mot } from "@/lib/i18n/vocabulaire";

import { ouvrirUneSession } from "./setup/session";

/**
 * LA LIGNE « À IMPORTER APRÈS » SUR L'ÉCRAN DES IMPORTS (GR15, constat G16).
 *
 * L'écran liste des TYPES, pas des lignes de données : aucune scène à
 * fabriquer, donc aucune donnée forgée et rien à nettoyer.
 *
 * `CAPTURES_IMPORTS_ORDRE=<dossier>` fait écrire les captures AVANT les
 * assertions, à 1280 et 375 px — sans la variable, rien n'est écrit.
 */

const DOSSIER_CAPTURES = process.env.CAPTURES_IMPORTS_ORDRE ?? "";

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER_CAPTURES === "") return;
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

for (const largeur of [1280, 375]) {
  test(`les équipements désignent leurs trois préalables (${largeur}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto("/imports");
    await capturer(page, "imports-ordre-equipements", largeur);
    const ligne = page.locator(
      'li[data-type="equipements"] [data-importer-apres]',
    );
    await expect(ligne).toHaveCount(1);
    await expect(ligne).toContainText(fr["imports.type.clients"]);
    await expect(ligne).toContainText(mot("site", true));
    await expect(ligne).toContainText(fr["imports.type.modeles"]);
  });
}

test("les clients — racine — n'ont aucune ligne « à importer après »", async ({
  page,
}) => {
  await page.goto("/imports");
  const ligne = page.locator('li[data-type="clients"] [data-importer-apres]');
  await expect(ligne).toHaveCount(0);
});

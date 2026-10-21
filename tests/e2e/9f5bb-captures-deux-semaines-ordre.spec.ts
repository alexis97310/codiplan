import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { cleJour, jourSuivant } from "@/lib/calendar/fuseau";

import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * CAPTURE 9F5BB-REPRISE-9F5BA — même ordre des techniciens entre la vue
 * Semaine et la vue Deux semaines, aux deux viewports. `comparerLignes`
 * (`lib/interventions/grille.ts`) est la SEULE fonction de tri, appelée à
 * l'identique par les deux vues (`page.tsx`, `construireGrille`) : l'ordre
 * ne dépend ni de la charge ni de la fenêtre de jours, seulement du libellé
 * (référentiel). Rien n'est posé par cette capture : elle lit la scène de
 * démonstration, déjà en place.
 */

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9F5BB-REPRISE-9F5BA/captures",
);

async function capturer(
  page: Page,
  nom: string,
  largeur: 375 | 1280,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
  });
}

for (const largeur of [375, 1280] as const) {
  test(`même ordre des techniciens, Semaine vs Deux semaines, à ${largeur}px`, async ({
    page,
  }) => {
    const reperes = await reperesDeLaScene();
    const lundiPlus1 = jourSuivant(reperes.lundi, 7);

    await ouvrirUneSession(page);

    await page.goto(
      `/planning?vue=deux_semaines&semaine=${cleJour(lundiPlus1)}`,
    );
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, `deux-semaines-ordre`, largeur);

    await page.goto(`/planning?vue=semaine&semaine=${cleJour(lundiPlus1)}`);
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, `semaine-ordre`, largeur);
  });
}

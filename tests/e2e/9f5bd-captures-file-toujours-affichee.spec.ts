import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { cleJour } from "@/lib/calendar/fuseau";
import { fr } from "@/lib/i18n";

import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * CAPTURE 9F5BD-REPRISE-9F5BC — la ligne « Non affectées » est TOUJOURS
 * affichée, vide ou non (D218, décision d'Alexis du 21/10/2026). La scène
 * de démonstration (`reperesDeLaScene`) ne porte, sur SA semaine courante,
 * aucune intervention non affectée : si la ligne/colonne apparaît quand
 * même, en tête, c'est qu'elle est désormais semée AVANT toute intervention
 * (`construireGrille`, `construireJournee`), jamais la preuve du contraire.
 * Rien n'est posé par cette capture : elle lit la scène déjà en place.
 */

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9F5BD-REPRISE-9F5BC/captures",
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
  test(`la file « Non affectées », vide, en tête — Semaine, Deux semaines et Jour, à ${largeur}px`, async ({
    page,
  }) => {
    const reperes = await reperesDeLaScene();

    await ouvrirUneSession(page);

    // Le texte paraît deux fois dans le DOM (grille desktop + liste mobile,
    // D-06) : seule celle que le viewport montre est VISIBLE.
    const fileAffichee = page
      .getByText(fr["statistiques.non_affectees"])
      .filter({ visible: true });

    await page.goto(`/planning?vue=semaine&semaine=${cleJour(reperes.lundi)}`);
    await expect(page.locator("main")).toBeVisible();
    await expect(fileAffichee.first()).toBeVisible();
    await capturer(page, `semaine-file-vide`, largeur);

    await page.goto(
      `/planning?vue=deux_semaines&semaine=${cleJour(reperes.lundi)}`,
    );
    await expect(page.locator("main")).toBeVisible();
    await expect(fileAffichee.first()).toBeVisible();
    await capturer(page, `deux-semaines-file-vide`, largeur);

    await page.goto(`/planning?vue=jour&jour=${cleJour(reperes.lundi)}`);
    await expect(page.locator("main")).toBeVisible();
    await expect(fileAffichee.first()).toBeVisible();
    await capturer(page, `jour-file-vide`, largeur);
  });
}

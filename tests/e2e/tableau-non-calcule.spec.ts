import { expect, test } from "@playwright/test";

import { ouvrirUneSession } from "./setup/session";

/**
 * GR17-M8 (audit GR du 26/09/2026, constat M8) — « NON CALCULÉ » NE SE LIT
 * PLUS COMME UNE MESURE.
 *
 * ## Le constat
 *
 * `[data-bloc="kpi-occupation"]` (et `kpi-vgp`, quand le registre n'a jamais
 * reçu de vérification) rendait « Non calculé » dans le même corps que le
 * grand chiffre des autres tuiles — même taille, même graisse — au point
 * qu'un œil qui parcourt le bandeau lit une mesure là où il n'y en a aucune.
 *
 * ## Ce que ce scénario éprouve
 *
 * Sur `/tableau-de-bord`, dans la tuile « Taux d'occupation »
 * (`[data-bloc="kpi-occupation"]`, jamais calculée — R2-13), l'élément
 * `[data-non-calcule]` porte une taille de police STRICTEMENT plus petite que
 * l'élément `.text-\[27px\]` qui l'entoure — une comparaison RELATIVE, lue
 * dans la même page, jamais une valeur absolue qui figerait un jeton.
 *
 * ## Lecture seule
 *
 * Aucune donnée n'est créée : la tuile « Taux d'occupation » n'est jamais
 * calculée, quel que soit le semis.
 */

const FENETRE = { width: 1280, height: 900 };

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(FENETRE);
  await ouvrirUneSession(page);
});

test("« Non calculé » est rendu plus petit que le grand chiffre des autres tuiles", async ({
  page,
}) => {
  await page.goto("/tableau-de-bord");

  const tuile = page.locator('[data-bloc="kpi-occupation"]');
  await expect(tuile).toBeVisible();

  const grandChiffre = tuile.locator(".text-\\[27px\\]").first();
  const nonCalcule = tuile.locator("[data-non-calcule]").first();
  await expect(nonCalcule).toBeVisible();

  const tailleEntourante = await grandChiffre.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
  const tailleNonCalcule = await nonCalcule.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );

  expect(tailleNonCalcule).toBeLessThan(tailleEntourante);
});

import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * GR16i (audit d'ergonomie du 26/09/2026, constat G18 ; DÉCISION D'ALEXIS
 * 27/09/2026 : « (obligatoire) » partout sur `/parc/nouvelle`, jamais un
 * astérisque — même forme que la création d'intervention).
 *
 * Aucune donnée n'est créée : l'écran de création, chargé une fois, porte
 * déjà les quatre champs obligatoires (modèle, n° de série, client, site) et
 * au moins un champ facultatif à comparer.
 */
test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("les quatre champs obligatoires de la fiche machine portent « (obligatoire) »", async ({
  page,
}) => {
  await page.goto("/parc/nouvelle");

  const suffixe = fr["intervention.creation.obligatoire_suffixe"];

  await expect(page.locator('[data-selecteur="modele_id"]')).toContainText(
    suffixe,
  );
  await expect(page.locator('[data-selecteur="client_id"]')).toContainText(
    suffixe,
  );
  await expect(page.locator('[data-selecteur="site_id"]')).toContainText(
    suffixe,
  );
  await expect(
    page.locator('label:has(input[name="numero_serie"])'),
  ).toContainText(suffixe);
});

test("les champs facultatifs de la fiche machine ne portent pas « (obligatoire) »", async ({
  page,
}) => {
  await page.goto("/parc/nouvelle");

  const suffixe = fr["intervention.creation.obligatoire_suffixe"];

  await expect(
    page.locator('label:has(input[name="reference_interne"])'),
  ).not.toContainText(suffixe);
  await expect(
    page.locator('label:has(input[name="localisation"])'),
  ).not.toContainText(suffixe);
});

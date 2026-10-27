import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * 9G6-FORMULAIRES, point 7 — « Corriger la fiche machine » au gabarit de la
 * création : « (facultatif) », « Annuler », action collée au téléphone, aide
 * du n° de série lisible (sans chevron brut).
 *
 * **LA SCÈNE — LUE, JAMAIS MODIFIÉE**, même règle que
 * `tests/e2e/fiche-machine-vgp.spec.ts` : `NUS-SPL-2022-0007` est une
 * machine du SEMIS, atteinte par la même navigation (jamais un identifiant
 * recopié à la main). Ce spec ne soumet jamais le formulaire — seul le
 * RENDU est en cause ici, pas `modifierMachineDans`.
 */
const MACHINE_DU_SEMIS = "NUS-SPL-2022-0007";

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("« Annuler » ramène à la fiche, les champs non obligatoires portent « (facultatif) », l'aide du n° de série ne porte plus de chevron brut", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/vgp");
  await page.locator("a", { hasText: MACHINE_DU_SEMIS }).first().click();
  await expect(page.locator('[data-bloc="machine-page"]')).toBeVisible();
  const urlFiche = page.url();

  await page.getByRole("link", { name: fr["machine.fiche.corriger"] }).click();
  await expect(page).toHaveURL(/\/parc\/[0-9a-f-]{36}\/modifier/);

  const facultatif = fr["intervention.creation.facultatif_suffixe"];
  await expect(
    page.getByText(`${fr["machine.champ.localisation"]} ${facultatif}`),
  ).toBeVisible();

  // LE TEXTE EXACT DE `machine.modifier.numero_serie_aide` SUFFIT À PROUVER
  // LE POINT 7 (chevron brut retiré) : c'est une clé NEUVE, distincte de
  // `machine.champ.numero_serie_aide` (encore un chevron, pour la création).
  const aide = page.getByText(fr["machine.modifier.numero_serie_aide"]);
  await expect(aide).toBeVisible();

  const annuler = page.getByRole("link", {
    name: fr["machine.modifier.annuler"],
  });
  await expect(annuler).toBeVisible();
  await expect(annuler).toHaveAttribute("href", new URL(urlFiche).pathname);
});

test("capture 375 px — l'action d'enregistrement reste atteignable, collée au bas de l'écran", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/vgp");
  await page
    .locator("a:visible", { hasText: MACHINE_DU_SEMIS })
    .first()
    .click();
  await expect(page.locator('[data-bloc="machine-page"]')).toBeVisible();

  await page
    .getByRole("link", { name: fr["machine.action.corriger_court"] })
    .click();
  await expect(page).toHaveURL(/\/parc\/[0-9a-f-]{36}\/modifier/);

  const bouton = page.getByRole("button", {
    name: fr["machine.action.enregistrer"],
  });
  await expect(bouton).toBeVisible();
  // L'ENROBAGE FIXÉ EN BAS, SOUS 901 PX (`BarreActionCollee`) — jamais le
  // bouton lui-même, dont la classe reste `ActionPrimaire` à l'identique.
  const enrobage = bouton.locator("xpath=..");
  await expect(enrobage).toHaveClass(/fixed/);
});

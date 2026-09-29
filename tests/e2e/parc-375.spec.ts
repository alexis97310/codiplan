import { expect, test } from "@playwright/test";

import { ouvrirUneSession } from "./setup/session";

/**
 * PV-06 / PV-11 — `/parc` À 375 PX (audit du 28/09/2026,
 * TP-A6-TRIS-MISE-EN-PAGE, 30/09/2026).
 *
 * ## Ce que ce fichier éprouve
 *
 * `DetailHero` (`components/ui/maitre-detail.tsx`) rendait une rangée
 * `flex justify-between` sans repli ni `min-w-0`, dans une carte posée sous
 * `overflow-hidden` (`app/(back-office)/parc/page.tsx`) : à 375 px, l'action
 * « Fiche complète » était rognée hors du cadre, et la page ne défilait
 * pas pour la retrouver — mesuré, jamais supposé, sur `scrollWidth`.
 *
 * Le lien vers le registre des VGP, retiré du bas de la page (PV-11 : `/vgp`
 * est déjà une entrée de la barre, `nav.vgp`), ne doit plus s'y trouver.
 *
 * Lecture SEULE sur la scène de démonstration déjà semée (I9) — aucune
 * donnée n'est forgée par cette épreuve, et aucun compte n'est mesuré.
 */

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("à 375 px, aucun élément ne déborde de la fenêtre, sélection comprise", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/parc");
  await expect(page.locator('[data-bloc="maitre-detail"]')).toBeVisible();

  const scrollWidthAvant = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(scrollWidthAvant).toBeLessThanOrEqual(375);

  // LA SÉLECTION EST CE QUI RÉVÈLE LE DÉFAUT MESURÉ : `apercu-hero` ne rend
  // rien tant qu'aucune ligne n'est choisie.
  const premiereLigne = page.locator('[data-bloc="liste-machines"] a').first();
  await expect(premiereLigne).toBeVisible();
  await premiereLigne.click();
  await expect(page.locator('[data-bloc="apercu-hero"]')).toBeVisible();

  const scrollWidthApres = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(scrollWidthApres).toBeLessThanOrEqual(375);
});

test("le lien vers le registre des VGP a quitté le bas de la page (PV-11, doublon de nav.vgp)", async ({
  page,
}) => {
  await page.goto("/parc");
  await expect(page.locator('[data-bloc="maitre-detail"]')).toBeVisible();
  await expect(page.locator('a[href="/vgp"]')).toHaveCount(0);
});

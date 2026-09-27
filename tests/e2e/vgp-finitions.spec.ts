import { expect, test } from "@playwright/test";

import { ouvrirUneSession } from "./setup/session";

/**
 * GR17-M9 (audit GR du 26/09/2026, constat M9) — LE REGISTRE VGP SANS RETOUR
 * REDONDANT, LE BANDEAU DES INDÉTERMINÉS SOULIGNÉ, « ÉCHÉANCE DÉPASSÉE » UNE
 * SEULE FOIS.
 *
 * ## Le constat
 *
 * `/vgp` portait un lien « ‹ Retour au parc » dans son en-tête qu'aucune
 * épreuve ni docblock ne justifiait — la barre de navigation atteint déjà
 * `/parc`. Le bandeau des familles indéterminées (`/vgp/a-determiner`) portait
 * les jetons de lien orange sans le soulignement qui les distingue du texte
 * courant. Et la colonne Échéance répétait « Échéance dépassée » alors que le
 * badge d'état, dans la colonne voisine, le dit déjà.
 *
 * ## Lecture seule
 *
 * Aucune donnée n'est créée : ce spec lit `/vgp` tel que le semis le rend.
 */

const FENETRE = { width: 1280, height: 900 };

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(FENETRE);
  await ouvrirUneSession(page);
  await page.goto("/vgp");
});

test("l'en-tête de /vgp ne porte plus de lien vers /parc", async ({ page }) => {
  const enTete = page.locator("header").first();
  await expect(enTete).toBeVisible();
  await expect(enTete.locator('a[href="/parc"]')).toHaveCount(0);
});

test("le bandeau des familles à déterminer est souligné et se termine par une flèche", async ({
  page,
}) => {
  const bandeau = page.locator('a[href="/vgp/a-determiner"]').first();
  await expect(bandeau).toBeVisible();

  const decoration = await bandeau.evaluate(
    (element) => getComputedStyle(element).textDecorationLine,
  );
  expect(decoration).toContain("underline");

  const texte = (await bandeau.innerText()).trim();
  expect(texte.endsWith("→")).toBe(true);
});

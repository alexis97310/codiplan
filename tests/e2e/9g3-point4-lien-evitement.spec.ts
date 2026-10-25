import { expect, test } from "@playwright/test";

import { ouvrirUneSession } from "./setup/session";

/**
 * 9G3-TITRES-CIBLES-ACTIONS, POINT 4 — LE LIEN D'ÉVITEMENT NE CACHE PLUS LE
 * `<h1>` SOUS LE BANDEAU COLLANT. `<main id="contenu">`
 * (`components/mise-en-page/page.tsx`) porte désormais `scroll-mt-[52px]`
 * (`BandeauMobile`) et `min-[901px]:scroll-mt-[64px]` (`BandeauBureau`).
 *
 * Aucune scène propre : l'assertion porte sur le CHROME, pas sur une
 * donnée, comme `9dv-tp-nav4-telephone-glossaire.spec.ts`.
 */
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("à 1280 px, activer le lien d'évitement depuis plus bas laisse le <h1> sous BandeauBureau (64 px), jamais derrière", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/interventions");
  // SCROLLÉ D'ABORD — le lien lui-même est `focus:fixed` (ancré au
  // viewport, atteignable depuis n'importe quel défilement) ; c'est
  // ACTIVER sa cible, `#contenu`, qui déclenche le défilement natif du
  // focus — rien à mesurer si la page n'a jamais bougé.
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.locator('a[href="#contenu"]').focus();
  await page.keyboard.press("Enter");
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toBeVisible();
  const boite = await h1.boundingBox();
  expect(boite).not.toBeNull();
  expect(boite!.y).toBeGreaterThanOrEqual(64);
});

test("à 375 px, activer le lien d'évitement depuis plus bas laisse le <h1> sous BandeauMobile (52 px), jamais derrière", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/interventions");
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.locator('a[href="#contenu"]').focus();
  await page.keyboard.press("Enter");
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toBeVisible();
  const boite = await h1.boundingBox();
  expect(boite).not.toBeNull();
  expect(boite!.y).toBeGreaterThanOrEqual(52);
});

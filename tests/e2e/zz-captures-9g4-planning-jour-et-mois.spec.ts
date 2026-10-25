import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9G4-PLANNING-JOUR-ET-MOIS — AVANT/APRÈS EN UN SEUL
 * FICHIER (même patron que `captures-pgd3-mois-charge.spec.ts`) : ce fichier
 * est lancé une fois sur `origin/main` (AVANT), une fois sur le code livré
 * (APRÈS). Captures en VIEWPORT (pas `fullPage`), à 375 et 1280 px.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9G4 ?? "";

async function capturer(
  page: import("@playwright/test").Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: false,
  });
}

test("capture — bouton « Transmettre toutes les planifiées prêtes », à 375px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await ouvrirUneSession(page);
  await page.goto("/planning?vue=jour");
  await expect(page.locator("main")).toBeVisible();
  const bouton = page.locator("[data-laissees-transmission]");
  if ((await bouton.count()) > 0) {
    await bouton.scrollIntoViewIfNeeded();
  }
  await capturer(page, "transmettre-toutes-375", 375);
});

for (const largeur of [1280, 375] as const) {
  test(`capture — vue Jour, à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await ouvrirUneSession(page);
    await page.goto("/planning?vue=jour");
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "jour", largeur);
  });

  test(`capture — vue Mois, à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await ouvrirUneSession(page);
    await page.goto("/planning?vue=mois");
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "mois", largeur);
  });

  test(`capture — vue 2 semaines, à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await ouvrirUneSession(page);
    await page.goto("/planning?vue=deux_semaines");
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "deux-semaines", largeur);
  });
}

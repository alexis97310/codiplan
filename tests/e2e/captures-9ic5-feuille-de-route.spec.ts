import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LES CAPTURES DE 9IC5-FEUILLE-DE-ROUTE — la page (admin) et le menu avec
 * l'entrée, à 1280 et à 375 px.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = join(
  process.cwd(),
  "docs/propositions/9IC5-FEUILLE-DE-ROUTE/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({ path: join(DOSSIER, `${nom}.png`) });
}

test.beforeEach(async ({ page }) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
});

test("1280 px — le menu, avec l'entrée « Feuille de route »", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/planning");
  const lien = page.getByRole("link", { name: fr["nav.feuille_de_route"] });
  await expect(lien).toBeVisible();
  await capturer(page, "menu-1280");
});

test("1280 px — la page « Feuille de route »", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/feuille-de-route");
  await expect(
    page.getByRole("heading", { name: fr["feuille_de_route.titre"] }),
  ).toBeVisible();
  await capturer(page, "page-1280");
});

test("375 px — le menu (tiroir « Plus »), avec l'entrée « Feuille de route »", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/planning");
  await page
    .getByRole("navigation", { name: fr["nav.libelle"] })
    .getByRole("button", { name: fr["nav.barre_basse.plus"] })
    .click();
  const colonne = page.locator("#colonne-navigation");
  await expect(colonne).toBeVisible();
  await expect(
    colonne.getByRole("link", { name: fr["nav.feuille_de_route"] }),
  ).toBeVisible();
  await capturer(page, "menu-375");
});

test("375 px — la page « Feuille de route »", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/feuille-de-route");
  await expect(
    page.getByRole("heading", { name: fr["feuille_de_route.titre"] }),
  ).toBeVisible();
  await capturer(page, "page-375");
});

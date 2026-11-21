import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LES CAPTURES AVANT/APRÈS de 9L30-FEUILLE-DE-ROUTE-22-11 — la page « Feuille
 * de route », page entière, à 1280 et à 375 px, avant puis après la remise à
 * l'état du 22/11/2026 du contenu.
 *
 * Lancé deux fois (recette « captures AVANT/APRÈS » : la session de mémoire),
 * `MOMENT` choisit le préfixe des fichiers produits.
 */
test.describe.configure({ mode: "serial" });

const MOMENT = process.env.MOMENT_CAPTURE === "apres" ? "apres" : "avant";

const DOSSIER = join(
  process.cwd(),
  "docs/propositions/9L30-FEUILLE-DE-ROUTE-22-11/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${MOMENT}-${nom}.png`),
    fullPage: true,
  });
}

test.beforeEach(async ({ page }) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
});

test("1280 px — la page « Feuille de route », page entière", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto("/feuille-de-route");
  await expect(
    page.getByRole("heading", { name: fr["feuille_de_route.titre"] }),
  ).toBeVisible();
  await capturer(page, "1280");
});

test("375 px — la page « Feuille de route », page entière", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/feuille-de-route");
  await expect(
    page.getByRole("heading", { name: fr["feuille_de_route.titre"] }),
  ).toBeVisible();
  await capturer(page, "375");
});

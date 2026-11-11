import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LES CAPTURES AVANT/APRÈS de 9K25A-FEUILLE-DE-ROUTE-AUDIT-TECHNICIEN — la
 * page « Feuille de route », à 1280 et à 375 px, avant puis après l'ajout de
 * la section « Application technicien — audit du 10/11/2026 ».
 *
 * Lancé deux fois (recette « captures AVANT/APRÈS » : la session de mémoire),
 * `MOMENT` choisit le préfixe des fichiers produits.
 */
test.describe.configure({ mode: "serial" });

const MOMENT = process.env.MOMENT_CAPTURE === "apres" ? "apres" : "avant";

const DOSSIER = join(
  process.cwd(),
  "docs/propositions/9K25A-FEUILLE-DE-ROUTE-AUDIT-TECHNICIEN/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({ path: join(DOSSIER, `${MOMENT}-${nom}.png`) });
}

test.beforeEach(async ({ page }) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
});

test("1280 px — la page « Feuille de route »", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1600 });
  await page.goto("/feuille-de-route");
  await expect(
    page.getByRole("heading", { name: fr["feuille_de_route.titre"] }),
  ).toBeVisible();
  await capturer(page, "1280");
});

test("375 px — la page « Feuille de route »", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 1600 });
  await page.goto("/feuille-de-route");
  await expect(
    page.getByRole("heading", { name: fr["feuille_de_route.titre"] }),
  ).toBeVisible();
  await capturer(page, "375");
});

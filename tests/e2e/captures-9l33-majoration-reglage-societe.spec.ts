import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LES CAPTURES AVANT/APRÈS de 9L33-MAJORATION-REGLAGE-SOCIETE — la page
 * `/parametres/societe`, page entière, à 1280 et à 375 px, avant puis après
 * l'ajout de la carte « Majoration hors ouverture ».
 *
 * Même recette que `captures-9l30-feuille-de-route-22-11.spec.ts` : lancé
 * deux fois, `MOMENT_CAPTURE` choisit le préfixe des fichiers produits. Le
 * titre de la page (`societe.logo_titre`) existe avant et après ce ticket —
 * aucune clé neuve n'est référencée ici, pour que le passage AVANT (sur le
 * code non modifié) type-vérifie sans casser sur une clé qui n'existe pas
 * encore.
 */
test.describe.configure({ mode: "serial" });

const MOMENT = process.env.MOMENT_CAPTURE === "apres" ? "apres" : "avant";

const DOSSIER = join(
  process.cwd(),
  "docs/propositions/9L33-MAJORATION-REGLAGE-SOCIETE/captures",
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

test("1280 px — la page « Paramètres › Société », page entière", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto("/parametres/societe");
  await expect(
    page.getByRole("heading", { name: fr["societe.logo_titre"] }),
  ).toBeVisible();
  await capturer(page, "1280");
});

test("375 px — la page « Paramètres › Société », page entière", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/parametres/societe");
  await expect(
    page.getByRole("heading", { name: fr["societe.logo_titre"] }),
  ).toBeVisible();
  await capturer(page, "375");
});

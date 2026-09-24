import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE SELECTEURS-1 (24/09/2026) — même recette que
 * `captures-parcours-1.spec.ts` : rien n'est écrit sans une variable
 * d'environnement qui nomme le dossier, pour que l'exécution ordinaire de
 * `pnpm test:e2e` n'écrive jamais de fichier.
 *
 * Les TROIS écrans touchés par SELECTEURS-1, à 375 et 1280 px, sélecteur
 * ouvert avec ses résultats puis valeur choisie.
 */

test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_SELECTEURS_1 ?? "";
const LARGEURS = [
  { largeur: 375, hauteur: 800, suffixe: "375" },
  { largeur: 1280, hauteur: 900, suffixe: "1280" },
] as const;

async function capturer(
  page: Page,
  nom: string,
  suffixe: string,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}--${suffixe}.png`),
    fullPage: true,
  });
}

/**
 * Ouvre le sélecteur `nom` (simple focus, sans texte — la liste non filtrée
 * suffit à montrer l'état « ouvert avec résultats »), capture, choisit le
 * premier résultat, capture à nouveau.
 */
async function capturerOuvertPuisChoisi(
  page: Page,
  nom: string,
  ecran: string,
  suffixe: string,
): Promise<void> {
  const bloc = page.locator(`[data-selecteur="${nom}"]`);
  await bloc.locator('input[type="text"]').click();
  const premiere = bloc.locator('ul[role="listbox"] li[role="option"]').first();
  await expect(premiere).toBeVisible();
  await capturer(page, `${ecran}--${nom}--ouvert`, suffixe);
  await premiere.click();
  await capturer(page, `${ecran}--${nom}--choisi`, suffixe);
}

for (const { largeur, hauteur, suffixe } of LARGEURS) {
  test.describe(`à ${suffixe} px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: hauteur });
      await ouvrirUneSession(page);
    });

    test(`sites/nouveau — le sélecteur de client`, async ({ page }) => {
      await page.goto("/sites/nouveau");
      await capturerOuvertPuisChoisi(
        page,
        "client_id",
        "sites-nouveau",
        suffixe,
      );
    });

    test(`interventions/nouvelle — le sélecteur de site`, async ({ page }) => {
      await page.goto("/interventions/nouvelle");
      await capturerOuvertPuisChoisi(
        page,
        "site",
        "interventions-nouvelle",
        suffixe,
      );
    });

    test(`parc/nouvelle — les sélecteurs de client, de site et de modèle`, async ({
      page,
    }) => {
      await page.goto("/parc/nouvelle");
      await capturerOuvertPuisChoisi(
        page,
        "client_id",
        "parc-nouvelle",
        suffixe,
      );
      await capturerOuvertPuisChoisi(page, "site_id", "parc-nouvelle", suffixe);
      await capturerOuvertPuisChoisi(
        page,
        "modele_id",
        "parc-nouvelle",
        suffixe,
      );
    });
  });
}

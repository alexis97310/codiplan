import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { reperesDeLaScene } from "./setup/reperes";
import { choisirPremierResultat } from "./setup/selecteur-recherche";
import { MARDI, cleDeJour, jourDeLaScene } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE PARCOURS-1 (38-PARCOURS-1) — APRÈS uniquement.
 *
 * *L'AVANT n'a pas été produit* : la recette éprouvée (rejouer le même spec
 * sur `main` inchangé) demande un checkout séparé et une base séparée, hors
 * du budget de ce lot — écrit en passation plutôt que simulé.
 */

test.describe.configure({ mode: "serial" });

const FENETRE = { width: 1280, height: 900 };
const DOSSIER = process.env.CAPTURES_PARCOURS_1 ?? "";

async function capturer(page: Page, nom: string): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}--1280.png`),
    fullPage: true,
  });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(FENETRE);
  await ouvrirUneSession(page);
});

test("capture — le formulaire de création", async ({ page }) => {
  await page.goto("/interventions/nouvelle");
  await capturer(page, "interventions-nouvelle");
});

test("capture — la fiche d'une intervention à planifier (bloc Planifier), le refus sans durée, la vue jour après planification", async ({
  page,
}) => {
  await page.goto("/interventions/nouvelle");
  await choisirPremierResultat(page, "site");
  await page.locator('select[name="type"]').selectOption("curatif");
  await page
    .locator('textarea[name="description"]')
    .fill("Compresseur en panne — capture 38-PARCOURS-1");
  await page
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+$/);
  await capturer(page, "interventions-id-a-planifier");

  const reperes = await reperesDeLaScene();
  const mardi = jourDeLaScene(reperes, MARDI);

  const formulaire = page.locator("form", {
    has: page.getByRole("heading", {
      name: fr["intervention.action.planifier"],
    }),
  });
  await formulaire
    .locator('input[name="date_planifiee"]')
    .fill(cleDeJour(mardi));
  await formulaire.locator('input[name="heure_debut"]').fill("09:00");
  // La durée manque, DÉLIBÉRÉMENT — contourner `required` pour capturer le
  // refus du serveur, pas seulement l'ergonomie du formulaire.
  await formulaire.evaluate((form) => {
    for (const nom of ["duree_min", "technicien_id"]) {
      form.querySelector(`[name="${nom}"]`)?.removeAttribute("required");
    }
  });
  await formulaire
    .getByRole("button", { name: fr["intervention.action.planifier"] })
    .click();
  await page.waitForLoadState("networkidle");
  await capturer(page, "interventions-id-refus-sans-duree");

  const reprise = page.locator("form", {
    has: page.getByRole("heading", {
      name: fr["intervention.action.planifier"],
    }),
  });
  await reprise.locator('input[name="date_planifiee"]').fill(cleDeJour(mardi));
  await reprise.locator('input[name="heure_debut"]').fill("09:00");
  await reprise.locator('input[name="duree_min"]').fill("60");
  const options = reprise.locator(
    'select[name="technicien_id"] option:not([value=""])',
  );
  const technicien = await options.first().getAttribute("value");
  await reprise
    .locator('select[name="technicien_id"]')
    .selectOption(technicien ?? "");
  await reprise
    .getByRole("button", { name: fr["intervention.action.planifier"] })
    .click();
  await page.waitForLoadState("networkidle");

  await page.goto(`/planning?vue=jour&jour=${cleDeJour(mardi)}`);
  await capturer(page, "planning-vue-jour-apres-planification");
});

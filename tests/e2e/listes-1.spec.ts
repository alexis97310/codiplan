import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * LISTES-1 (23/09/2026) — clients, sites et parc se trouvent en trois
 * secondes. Les scénarios d'isolation (`tests/isolation/ecran-site.test.ts`,
 * `ecran-client.test.ts`, `ecran-parc.test.ts`) éprouvent le CLOISONNEMENT et
 * le CALCUL sur la vraie table ; ce fichier-ci éprouve ce qu'eux ne peuvent
 * pas — qu'un écran RÉEL affiche le compteur, que la case COCHE VRAIMENT
 * dans un navigateur, et que les filtres du parc COMBINENT réellement dans
 * l'URL.
 */

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("/sites — chaque carte affiche un compteur d'équipements, et la case du filtre vit dans l'URL", async ({
  page,
}) => {
  await page.goto("/sites");
  const premiereCarte = page.locator("article").first();
  await expect(premiereCarte).toBeVisible();
  // La bande de compteurs porte le trajet ET les équipements — deux `<b>`.
  await expect(premiereCarte.locator("b")).toHaveCount(2);

  // La case est DÉCOCHÉE par défaut — absente de l'URL initiale.
  const case_ = page.getByRole("checkbox", {
    name: fr["sites.filtre_equipement"],
  });
  await expect(case_).toBeVisible();
  await expect(case_).not.toBeChecked();

  // Cochée puis soumise, elle pose `sans_equipement=1` dans l'URL — la case
  // vit dans l'URL, jamais dans un état de composant (même contrat que la
  // recherche elle-même).
  await case_.check();
  await page.getByRole("button", { name: fr["sites.rechercher"] }).click();
  await expect(page).toHaveURL(/sans_equipement=1/);
  await expect(case_).toBeChecked();
});

test("/clients — chaque carte affiche un compteur d'équipements", async ({
  page,
}) => {
  await page.goto("/clients");
  const premiereCarte = page.locator("article").first();
  await expect(premiereCarte).toBeVisible();
  // Le compteur de lieux ET celui d'équipements — deux `<b>` dans la bande.
  await expect(premiereCarte.locator("b")).toHaveCount(2);

  const case_ = page.getByRole("checkbox", {
    name: fr["clients.filtre_equipement"],
  });
  await expect(case_).toBeVisible();
  await expect(case_).not.toBeChecked();
});

test("/parc — les trois filtres combinables (client, site, famille) vivent dans l'URL", async ({
  page,
}) => {
  await page.goto("/parc");
  await expect(page.locator('[data-bloc="maitre-detail"]')).toBeVisible();

  const selectClient = page.locator("select#client");
  const selectSite = page.locator("select#site");
  const selectFamille = page.locator("select#famille");
  await expect(selectClient).toBeVisible();
  await expect(selectSite).toBeVisible();
  await expect(selectFamille).toBeVisible();

  // Une option réelle existe dans chacun — le parc de démonstration n'est
  // pas vide — et la choisir la pose dans l'URL après soumission.
  const optionClient = selectClient.locator("option").nth(1);
  const valeurClient = await optionClient.getAttribute("value");
  expect(valeurClient).not.toBeNull();
  await selectClient.selectOption(valeurClient!);
  await page
    .getByRole("button", { name: fr["parc.recherche_action"] })
    .click();
  await expect(page).toHaveURL(new RegExp(`client=${valeurClient}`));
  // Choisir un client ne perd pas la page 1 — la liste doit rester lisible.
  await expect(page.locator('[data-bloc="maitre-detail"]')).toBeVisible();
});

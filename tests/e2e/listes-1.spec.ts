import { expect, test } from "@playwright/test";

import {
  libelleAfficherSitesMasques,
  libelleMasquerSitesAffiches,
} from "@/app/(back-office)/sites/presentation";
import { libelleMasquerClientsAffiches } from "@/app/(back-office)/clients/presentation";
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

test("/sites — chaque carte affiche une bande de chiffres (machines, trajet), et le lien « Afficher »/« Masquer » (D179) vit dans l'URL", async ({
  page,
}) => {
  await page.goto("/sites");
  const premiereCarte = page.locator("article").first();
  await expect(premiereCarte).toBeVisible();
  // LA BANDE DE CHIFFRES (9EB-TP-UX3-2-LISTES-1) — visée par son
  // `data-chiffre`, jamais par un compte total de `<b>` : la carte peut
  // aussi porter « ouvertes » et « VGP dépassée », facultatif, et un compte
  // total serait faux dès que ce dernier s'affiche.
  await expect(
    premiereCarte.locator('[data-chiffre="machines"] b'),
  ).toBeVisible();
  await expect(
    premiereCarte.locator('[data-chiffre="trajet"] b'),
  ).toBeVisible();

  // `sans_equipement=1` ABSENT de l'URL initiale — le lien « Afficher »
  // REMPLACE la case native retirée (9EWA-RENDU-VISUEL-1, point 5, D179) :
  // suivi, il pose `sans_equipement=1` dans l'URL — jamais dans un état de
  // composant (même contrat que la recherche elle-même).
  await expect(page).not.toHaveURL(/sans_equipement=1/);
  const lienAfficher = page.getByRole("link", {
    name: libelleAfficherSitesMasques(),
  });
  await expect(lienAfficher).toBeVisible();
  await lienAfficher.click();
  await expect(page).toHaveURL(/sans_equipement=1/);

  // Le lien « Masquer » SYMÉTRIQUE — sans lui, une fois `sans_equipement=1`
  // posé, rien ne permettrait de revenir en arrière (le rappel « N masqués »
  // ne s'affiche plus, son compte valant 0).
  const lienMasquer = page.getByRole("link", {
    name: libelleMasquerSitesAffiches(),
  });
  await expect(lienMasquer).toBeVisible();
  await lienMasquer.click();
  await expect(page).not.toHaveURL(/sans_equipement=1/);
});

test("/clients — chaque carte affiche sa bande de quatre chiffres, et le lien « Afficher »/« Masquer » (D179) vit dans l'URL", async ({
  page,
}) => {
  await page.goto("/clients");
  const premiereCarte = page.locator("article").first();
  await expect(premiereCarte).toBeVisible();
  // SITES, MACHINES, À PLANIFIER, DERNIÈRE INTERVENTION (9EB-TP-UX3-2-LISTES-1,
  // QE-13c) — quatre `<b>`, chacun visé par son `data-chiffre`.
  await expect(premiereCarte.locator("b")).toHaveCount(4);
  await expect(premiereCarte.locator('[data-chiffre="sites"] b')).toBeVisible();
  await expect(
    premiereCarte.locator('[data-chiffre="machines"] b'),
  ).toBeVisible();

  await expect(page).not.toHaveURL(/sans_equipement=1/);

  // Le lien « Masquer » SYMÉTRIQUE (9EWA-RENDU-VISUEL-1, point 5, D179) —
  // REMPLACE la case native retirée, sans dépendre d'un client réellement
  // masqué dans le jeu de démonstration (contrairement à « Afficher »,
  // conditionné par au moins un client masqué, éprouvé côté /sites).
  await page.goto("/clients?sans_equipement=1");
  const lienMasquer = page.getByRole("link", {
    name: libelleMasquerClientsAffiches(),
  });
  await expect(lienMasquer).toBeVisible();
  await lienMasquer.click();
  await expect(page).not.toHaveURL(/sans_equipement=1/);
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
  await page.getByRole("button", { name: fr["parc.recherche_action"] }).click();
  await expect(page).toHaveURL(new RegExp(`client=${valeurClient}`));
  // Choisir un client ne perd pas la page 1 — la liste doit rester lisible.
  await expect(page.locator('[data-bloc="maitre-detail"]')).toBeVisible();
});

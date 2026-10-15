import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, type Page, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_RM_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9EWD-PARAMETRES-HUB-MAQUETTE — LES PASTILLES-DÉCOMPTE DU HUB, À LA LETTRE
 * DE LA MAQUETTE (décision n° 97 d'Alexis, 13/10/2026).
 *
 * Trois faits que `lib/navigation/decomptes-parametrage.ts` doit tenir :
 *   1. une pastille ORANGE mène à la liste EXACTE qu'elle compte ;
 *   2. une porte FERMÉE n'a ni carte ni pastille (RM, qui n'administre pas
 *      l'équipe — D153) ;
 *   3. une pastille sans alerte est GRISE et n'est jamais un lien.
 *
 * Écrans en LECTURE, même compte que `9dq-tp-nav1-hub-agences.spec.ts`.
 */

const DOSSIER = join(
  process.cwd(),
  "docs/propositions/9EWD-PARAMETRES-HUB-MAQUETTE/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}.png`),
    fullPage: true,
  });
}

test("LE DÉCOMPTE ORANGE DES IMPORTS MÈNE À LA LISTE EXACTE QU'IL COMPTE", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/parametres");

  const main = page.locator("main");
  const pastille = main.locator('a[href="/imports?vue=a-appliquer"]');
  await expect(pastille).toBeVisible();
  // La pastille n'est PAS le même lien que la carte « Imports Excel » —
  // deux ancres de même `href` seraient introuvables par un décompte exact
  // (droits-rm-rs.spec.ts). Scopé à `main` : la barre porte aussi un lien
  // `/imports`.
  await expect(main.locator('a[href="/imports"]')).toHaveCount(1);

  await pastille.click();
  await expect(page).toHaveURL("/imports?vue=a-appliquer");
  await expect(page.getByText(fr["auth.refus_droit"])).toHaveCount(0);
});

test("UNE PASTILLE SANS ALERTE EST GRISE, ET N'EST JAMAIS UN LIEN (Prestations)", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/parametres");

  const main = page.locator("main");
  const carte = main.locator('a[href="/parametres/prestations"]');
  await expect(carte).toBeVisible();
  // La pastille grise suit la carte, hors du lien : aucune ancre neuve vers
  // `/parametres/prestations` ne doit apparaître (sinon le compteur
  // ci-dessus romprait).
  await expect(carte).toHaveCount(1);
  // LA PASTILLE ELLE-MÊME N'EST JAMAIS UN LIEN QUAND ELLE N'ALERTE PAS
  // (M:4366) : le `<li>` qui porte la carte ne porte AUCUNE autre ancre —
  // ni vers `/parametres/prestations`, ni vers quoi que ce soit d'autre.
  const carteEtSaPastille = main.locator(
    'li:has(a[href="/parametres/prestations"])',
  );
  await expect(carteEtSaPastille.locator("a")).toHaveCount(1);

  // LA PASTILLE EXISTE bel et bien, et c'est un `<span>` — jamais une ancre
  // (M:4366). Sans cette assertion, le test ci-dessus resterait vert même si
  // la pastille disparaissait purement et simplement de l'écran.
  const pastille = carteEtSaPastille.locator("span.bg-app-gris-fond");
  await expect(pastille).toBeVisible();
  await expect(pastille).toHaveCount(1);
});

test("UNE PORTE FERMÉE (RM) N'A NI CARTE NI PASTILLE (Équipe)", async ({
  page,
}) => {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_RM_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/planning/);

  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.goto("/parametres");
  await expect(page.locator('a[href="/parametres/equipe"]')).toHaveCount(0);
  await expect(
    page.locator('a[href="/parametres/equipe?acces=a-ouvrir"]'),
  ).toHaveCount(0);
  await capturer(page, "hub-rm-1280");

  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/parametres");
  await expect(page.locator('a[href="/parametres/equipe"]')).toHaveCount(0);
  await capturer(page, "hub-rm-375");
});

test("RIEN NE DÉBORDE À 375 PX, NI POUR L'ADMINISTRATEUR NI POUR RM", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/parametres");
  await expect(page.locator("main")).toBeVisible();
  const scrollWidthAdmin = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(scrollWidthAdmin).toBeLessThanOrEqual(375);

  await page.context().clearCookies();
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_RM_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/planning/);

  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/parametres");
  await expect(page.locator("main")).toBeVisible();
  const scrollWidthRm = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(scrollWidthRm).toBeLessThanOrEqual(375);
});

test("captures — le hub de l'administrateur, à 1280 et 375 px", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);

  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto("/parametres");
  await expect(page.locator("main")).toBeVisible();
  await capturer(page, "hub-admin-1280");

  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/parametres");
  await expect(page.locator("main")).toBeVisible();
  // RIEN NE DÉBORDE À 375 PX (même discipline que parc-375.spec.ts) —
  // mesuré sur `scrollWidth`, jamais supposé.
  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(scrollWidth).toBeLessThanOrEqual(375);
  await capturer(page, "hub-admin-375");
});

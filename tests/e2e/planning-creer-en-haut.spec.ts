import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * GR17-M6 (audit GR du 26/09/2026, constat M6) — « CRÉER UNE INTERVENTION »
 * REMONTE EN HAUT À DROITE DU PLANNING.
 *
 * ## Le défaut mesuré
 *
 * `actions` (`app/(back-office)/planning/page.tsx`) regroupait `Onglets`,
 * `Deplacement` ET le bouton primaire dans le même bloc. Le gabarit partagé
 * `Page` (`components/mise-en-page/page.tsx`) ne pose qu'UN SEUL bloc
 * d'actions, à côté du titre : dès que ce bloc ne tenait plus à côté du
 * titre, il passait ENTIER sous le titre, bouton primaire compris — le
 * bouton n'était alors plus « en haut à droite ». `Onglets` et `Deplacement`
 * vivent désormais dans une rangée propre, sous l'en-tête ; seul le bouton
 * reste dans `actions`.
 *
 * ## Ce que cette épreuve mesure
 *
 * À 1280 et 1440 px, vues Semaine puis Jour : le bouton reste sur la MÊME
 * ligne que le titre — jamais rejeté sous lui, `<h1>` ET sous-titre compris
 * — et son bord droit colle (à 1 px près) à celui du `<header>` du gabarit —
 * jamais celui du bandeau mobile, masqué à ces largeurs, d'où la
 * restriction du sélecteur à `main header`.
 *
 * **Adapté par l'audit de cohérence du 21/10/2026 (9G9B)** — `header`
 * (`components/mise-en-page/page.tsx`) porte désormais `items-start` sur
 * une rangée titre+actions séparée du sous-titre, plutôt que `items-end`
 * sur les trois : le bouton s'aligne maintenant en HAUT du `<h1>`, et reste
 * ENTIÈREMENT au-dessus du sous-titre (`rLien.bottom <= rSousTitre.top`)
 * plutôt que de simplement le chevaucher — une garantie plus stricte que
 * l'ancienne. `h1 + p` ne tient plus (le sous-titre n'est plus adjacent au
 * `<h1>`, il suit la rangée ENTIÈRE) : le sélecteur devient `header > p`,
 * l'enfant DIRECT de `<header>` — toujours restreint à lui seul, jamais au
 * `<p>` du dialogue fermé « Transmettre demain »
 * (`components/planning/transmettre-demain.tsx`), qui ne vit pas à ce
 * niveau.
 *
 * À 375 px : NON MESURÉ, si le titre et le bouton tiennent sur une seule
 * ligne — seule la présence du lien est vérifiée.
 */

const LARGEURS_BUREAU = [1280, 1440] as const;
const HAUTEUR = 900;

test.describe("« Créer une intervention » en haut à droite du planning", () => {
  test.beforeEach(async ({ page }) => {
    await ouvrirUneSession(page);
  });

  for (const largeur of LARGEURS_BUREAU) {
    for (const vue of ["semaine", "jour"] as const) {
      test(`à ${largeur} px, vue ${vue}`, async ({ page }) => {
        await page.setViewportSize({ width: largeur, height: HAUTEUR });
        await page.goto(`/planning?vue=${vue}`);

        const lien = page.getByRole("link", { name: fr["planning.creer"] });
        // LE SOUS-TITRE EST L'ENFANT `<p>` DIRECT DE `<header>`
        // (9E2-E2E-MAIN-ROUGE-LUNDI, adapté par 9G9B) — `main header p`,
        // trop large, résoudrait AUSSI le `<p>` du dialogue fermé
        // « Transmettre demain » (« Laissées, à compléter »,
        // `components/planning/transmettre-demain.tsx`), qui ne vit pas au
        // même niveau. `header > p` reste restreint au seul sous-titre, quel
        // que soit l'état du semis (jamais un `<p>` qui dépend du jour).
        // LA RANGÉE TITRE+ACTIONS — l'enfant `<div>` qui porte le `<h1>` ET
        // le bouton, côte à côte, `items-start` (9G9B, point 1).
        const rangee = page.locator("main header > div").first();
        const sousTitre = page.locator("main header > p");
        const entete = page.locator("main header");
        await expect(lien).toBeVisible();

        const [rLien, rRangee, rSousTitre, rEntete] = await Promise.all([
          lien.evaluate((element) => element.getBoundingClientRect()),
          rangee.evaluate((element) => element.getBoundingClientRect()),
          sousTitre.evaluate((element) => element.getBoundingClientRect()),
          entete.evaluate((element) => element.getBoundingClientRect()),
        ]);

        // Le bouton s'aligne EN HAUT avec la rangée titre+actions (9G9B,
        // point 1) — une garantie plus stricte que l'ancien simple
        // chevauchement du sous-titre : il reste ENTIÈREMENT au-dessus de
        // lui.
        expect(Math.abs(rLien.top - rRangee.top)).toBeLessThanOrEqual(1);
        expect(rLien.bottom).toBeLessThanOrEqual(rSousTitre.top);
        expect(Math.abs(rLien.right - rEntete.right)).toBeLessThanOrEqual(1);
      });
    }
  }

  test("à 375 px, le bouton reste présent", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: HAUTEUR });
    await page.goto("/planning");
    await expect(
      page.getByRole("link", { name: fr["planning.creer"] }),
    ).toBeVisible();
  });
});

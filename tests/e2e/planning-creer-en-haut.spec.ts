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
 * ligne que le titre — jamais rejeté sous lui, `<h1>` ET sous-titre compris,
 * comme le faisait le bloc à trois éléments d'avant ce lot — et son bord
 * droit colle (à 1 px près) à celui du `<header>` du gabarit — jamais celui
 * du bandeau mobile, masqué à ces largeurs, d'où la restriction du
 * sélecteur à `main header`.
 *
 * **Pourquoi la mesure vise le bas du SOUS-TITRE, pas celui du `<h1>`** —
 * mesuré au navigateur : `header` (`components/mise-en-page/page.tsx`, HORS
 * TERRITOIRE) porte `items-end`, et son sous-titre porte une marge basse
 * fixe de 20 px. Le bouton — même seul dans `actions` — reste donc aligné
 * sur le bas du bloc titre ENTIER (`<h1>` + sous-titre), quelques pixels
 * sous le bas du seul `<h1>` : c'est une contrainte du gabarit partagé,
 * inchangée par ce lot. Ce que ce lot RÉPARE, et que cette épreuve vérifie,
 * c'est que le bouton reste DANS cette même ligne d'en-tête — chevauchant
 * verticalement le sous-titre — au lieu d'être rejeté entièrement dessous,
 * dans une ligne séparée par le `gap-4` du gabarit (l'écart mesuré AVANT ce
 * lot, à trois éléments dans `actions`, dépassait 50 px ; il est ici sous les
 * 20 px de la seule marge du sous-titre).
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
        const sousTitre = page.locator("main header p");
        const entete = page.locator("main header");
        await expect(lien).toBeVisible();

        const [rLien, rSousTitre, rEntete] = await Promise.all([
          lien.evaluate((element) => element.getBoundingClientRect()),
          sousTitre.evaluate((element) => element.getBoundingClientRect()),
          entete.evaluate((element) => element.getBoundingClientRect()),
        ]);

        // Le bouton chevauche verticalement le sous-titre plutôt que d'être
        // rejeté entièrement dessous — voir le commentaire d'en-tête.
        expect(rLien.top).toBeLessThan(rSousTitre.bottom);
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

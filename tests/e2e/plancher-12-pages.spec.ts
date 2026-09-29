import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LE PLANCHER DE 12 PX, ÉPROUVÉ AU NAVIGATEUR (D138, TP-UX1-2).
 *
 * `tests/unit/ui/plancher-12-pages.test.ts` lit le texte source ; ces cinq
 * scénarios lisent le style CALCULÉ, sur un élément précis de chaque groupe
 * de commit — jamais par une classe, toujours par le rôle, le libellé ou un
 * attribut `data-` déjà présent. Lecture seule : aucune écriture en base,
 * scène de démonstration du semis uniquement.
 */

test.describe("plancher de 12 px — D138", () => {
  test("G1 — l'en-tête « Technicien » du planning, vue Semaine, à 1280 px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await ouvrirUneSession(page);
    await expect(page).toHaveURL(/\/planning/);

    const entete = page.getByRole("cell", {
      name: fr["planning.colonne_technicien"],
      exact: true,
    });
    await expect(entete).toHaveCSS("font-size", "12px");
  });

  test("G2 — le taux d'occupation « non calculé » du tableau de bord", async ({
    page,
  }) => {
    await ouvrirUneSession(page);
    await page.goto("/tableau-de-bord");

    const nonCalcule = page.locator(
      '[data-bloc="kpi-occupation"] [data-non-calcule]',
    );
    await expect(nonCalcule).toHaveCSS("font-size", "12px");
  });

  test("G3 — le libellé du filtre « Statut » du parc", async ({ page }) => {
    await ouvrirUneSession(page);
    await page.goto("/parc");

    const libelle = page.locator('label[for="statut"]');
    await expect(libelle).toHaveCSS("font-size", "12px");
  });

  test("G4 — l'explication des exceptions de calendrier, à /parametres/agences", async ({
    page,
  }) => {
    await ouvrirUneSession(page);
    await page.goto("/parametres/agences");

    const explication = page.getByText(fr["parametres.exception_explication"], {
      exact: true,
    });
    await expect(explication).toHaveCSS("font-size", "12px");
  });

  test("G5 — la pastille de statut d'une ligne, à /terrain", async ({
    page,
  }) => {
    // Session TERRAIN (technicien), comme `tests/e2e/terrain-largeur.spec.ts` :
    // le compte de démonstration ordinaire n'atteint pas cet écran.
    await page.goto("/connexion");
    await page
      .getByLabel(fr["connexion.email"])
      .fill(COMPTE_TECHNICIEN_EPREUVE);
    await page
      .getByLabel(fr["connexion.mot_de_passe"])
      .fill(MOT_DE_PASSE_EPREUVE);
    await page.getByRole("button", { name: fr["connexion.valider"] }).click();
    await expect(page).toHaveURL(/\/terrain$/);

    // Pas d'attribut `data-` ni de rôle propre à la pastille : sa position
    // est stable (dernier `span` du conteneur du badge, après le badge
    // « nouveau » optionnel), jamais son libellé — le statut de la première
    // ligne dépend du semis.
    const pastille = page
      .locator("main li")
      .first()
      .locator("span.gap-1\\.5 > span")
      .last();
    await expect(pastille).toHaveCSS("font-size", "12px");
  });
});

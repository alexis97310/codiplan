import { expect, type Locator, type Page, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * GR17-M3 (audit GR du 26/09/2026, constat M3) — LES TITRES DE DOMAINE DE LA
 * BARRE RESPIRENT.
 *
 * ## Le défaut mesuré
 *
 * `CLASSES_TITRE_DOMAINE` portait `mt-3 … first:mt-0` sur le TITRE lui-même
 * (`components/navigation/barre.tsx`). Un titre est toujours le premier
 * enfant de sa propre enveloppe (`Domaine`, un `<div>` par domaine) : `mt-3`
 * ne s'appliquait donc JAMAIS, `first:mt-0` s'appliquant à chaque titre sans
 * exception. « Absences » (dernière entrée d'« EXPLOITATION ») collait au
 * titre suivant, « CLIENTS & PARC ».
 *
 * ## Ce que cette épreuve mesure — un écart RELATIF, jamais une valeur absolue
 *
 * L'écart vertical entre le bas du dernier lien d'un domaine et le haut du
 * titre du domaine suivant doit dépasser l'écart entre deux liens
 * consécutifs d'un même domaine, mesuré dans la MÊME page. Aucune scène : la
 * barre ne dépend d'aucune donnée, seulement du rôle de la session
 * (`ouvrirUneSession` voit les quatorze entrées, D132).
 */

const FENETRE_BUREAU = { width: 1280, height: 900 };
const FENETRE_TELEPHONE = { width: 375, height: 812 };

async function mesurerEcarts(page: Page) {
  const nav = page.getByRole("navigation", { name: fr["nav.libelle"] });
  const rect = async (locator: Locator) =>
    locator.evaluate((element) => element.getBoundingClientRect());

  // Deux liens consécutifs du domaine « EXPLOITATION ».
  const premierLien = nav.getByRole("link", {
    name: fr["nav.tableau_de_bord"],
    exact: true,
  });
  const secondLien = nav.getByRole("link", {
    name: fr["nav.planning"],
    exact: true,
  });
  // Le dernier lien de ce même domaine, et le titre du domaine suivant.
  const dernierLienDuDomaine = nav.getByRole("link", {
    name: fr["nav.absences"],
    exact: true,
  });
  const titreDuDomaineSuivant = nav.getByText(fr["nav.groupe_clients_parc"], {
    exact: true,
  });

  const [r1, r2, rDernier, rTitre] = await Promise.all([
    rect(premierLien),
    rect(secondLien),
    rect(dernierLienDuDomaine),
    rect(titreDuDomaineSuivant),
  ]);

  return {
    ecartIntraDomaine: r2.top - r1.bottom,
    ecartEntreDomaines: rTitre.top - rDernier.bottom,
  };
}

test.describe("les titres de domaine de la barre respirent", () => {
  test.beforeEach(async ({ page }) => {
    await ouvrirUneSession(page);
  });

  test("à 1280 px", async ({ page }) => {
    await page.setViewportSize(FENETRE_BUREAU);
    await page.goto("/planning");
    await expect(
      page.getByRole("navigation", { name: fr["nav.libelle"] }),
    ).toBeVisible();

    const { ecartIntraDomaine, ecartEntreDomaines } = await mesurerEcarts(page);
    expect(ecartEntreDomaines).toBeGreaterThan(ecartIntraDomaine);
  });

  test("à 375 px, menu ☰ ouvert", async ({ page }) => {
    await page.setViewportSize(FENETRE_TELEPHONE);
    await page.goto("/planning");
    await page.getByRole("button", { name: fr["nav.ouvrir_le_menu"] }).click();
    await expect(
      page.getByRole("navigation", { name: fr["nav.libelle"] }),
    ).toBeVisible();

    const { ecartIntraDomaine, ecartEntreDomaines } = await mesurerEcarts(page);
    expect(ecartEntreDomaines).toBeGreaterThan(ecartIntraDomaine);
  });
});

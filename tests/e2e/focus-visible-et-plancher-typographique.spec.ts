import { expect, test } from "@playwright/test";

import { ouvrirUneSession } from "./setup/session";

/**
 * FOCUS VISIBLE (spec §3.9 :317, anneau de 3 px) ET PLANCHER DE 12 PX (D138)
 * — TP-UX1-1, lecture seule, aucune écriture en base.
 *
 * Deux vérifications, dans un seul scénario court : le style CALCULÉ porte
 * l'anneau de 3 px sur une entrée du menu puis sur un lien de contenu
 * (`components/ui`), et l'en-tête d'un tableau de la scène mesure 12 px —
 * pas les 10,5 px que la maquette dessine (D138, `tableau.tsx`).
 */

test("l'anneau de focus de 3 px porte sur le menu et sur un lien du contenu, et l'en-tête d'un tableau mesure 12 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await ouvrirUneSession(page);
  await page.goto("/tableau-de-bord");
  await expect(page.locator("main")).toBeVisible();

  // Tab jusqu'à une entrée du menu (la colonne de navigation, D121) — le
  // lien d'évitement puis la marque précèdent la première entrée.
  let dansLeMenu = false;
  for (let tentative = 0; tentative < 10 && !dansLeMenu; tentative++) {
    await page.keyboard.press("Tab");
    dansLeMenu = await page.evaluate(() => {
      const entree = document.querySelector("#colonne-navigation nav");
      return (
        entree !== null &&
        document.activeElement !== null &&
        entree.contains(document.activeElement)
      );
    });
  }
  expect(dansLeMenu, "aucune entrée du menu n'a reçu le focus").toBe(true);
  const anneauMenu = await page.evaluate(
    () => getComputedStyle(document.activeElement as Element).boxShadow,
  );
  expect(anneauMenu).toContain("3px");

  // Continue de tabuler jusqu'à un lien de CONTENU — un `Link` de
  // `components/ui` (`ActionPrimaire`, `Carte`) rendu par l'écran, jamais la
  // colonne de navigation.
  let dansLeContenu = false;
  for (let tentative = 0; tentative < 40 && !dansLeContenu; tentative++) {
    await page.keyboard.press("Tab");
    dansLeContenu = await page.evaluate(() => {
      const element = document.activeElement;
      return (
        element !== null &&
        element.tagName === "A" &&
        element.closest("main") !== null
      );
    });
  }
  expect(dansLeContenu, "aucun lien du contenu n'a reçu le focus").toBe(true);
  const anneauContenu = await page.evaluate(
    () => getComputedStyle(document.activeElement as Element).boxShadow,
  );
  expect(anneauContenu).toContain("3px");

  // Le plancher de 12 px (D138) sur l'en-tête d'un tableau de la scène — la
  // même forme (`Tableau`, `th`) que `tests/e2e/ecrans-largeur-utile.spec.ts`
  // mesure déjà, mais la valeur d'APRÈS TP-UX1-1.
  await page.goto("/parametres/forfaits");
  const entete = page.locator("main thead th").first();
  await expect(entete).toHaveCSS("font-size", "12px");
});

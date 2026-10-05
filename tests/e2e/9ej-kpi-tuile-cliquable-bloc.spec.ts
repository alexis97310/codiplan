import { expect, test, type Page } from "@playwright/test";

import { ouvrirUneSession } from "./setup/session";

/**
 * 9EJ-CORRECTIFS-AUDIT-TUILES-ID, partie A — LA TUILE CLIQUABLE EN BLOC.
 *
 * ## LE DÉFAUT MESURÉ
 *
 * Audit en direct du 05/10/2026 au soir, navigateur intégré d'Alexis,
 * production `eb17c838` : `components/ui/kpi.tsx` pose `<Link href={...}>`
 * comme racine d'une tuile cliquable sans jamais lui donner `display: block`
 * — un `<a>` est `inline` par défaut, et le filet de couleur (`before:`), le
 * bord et le chevron se dessinaient alors par LIGNE DE TEXTE plutôt que sur
 * toute la tuile. Mesuré sur `/vgp` : `getComputedStyle(a).display` valait
 * `"inline"` pour les trois tuiles cliquables (`kpi-sous-30-jours`,
 * `kpi-en-retard`, `kpi-sans-information`) et `"block"` pour les deux tuiles
 * inertes (`kpi-informations-recues`, `kpi-a-determiner`, des `<div>`).
 *
 * ## CE QUE CE FICHIER ÉPROUVE
 *
 * `/vgp` porte les cinq tuiles à la fois — le cas le plus riche du dépôt pour
 * ce défaut (`/tableau-de-bord` et `/interventions` n'en portent que deux
 * chacune).
 *
 * **Comparer les hauteurs en pixels s'est révélé FAUX** : les cinq libellés
 * n'ont pas la même longueur, et une tuile dont le texte tient sur une ligne
 * de plus mesure légitimement plus haut — rien à voir avec `display`. Le
 * signal qui tient, lui, est `getClientRects().length` : un élément `inline`
 * dont le contenu occupe plusieurs lignes se fragmente en UN RECTANGLE PAR
 * LIGNE (c'est très exactement ce qui dessinait le filet et le bord par ligne
 * de texte) ; un élément `block` ne rend jamais plus d'UN rectangle, quel que
 * soit le nombre de lignes de son contenu.
 */
test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/vgp");
});

const BLOCS_CLIQUABLES = [
  "kpi-sous-30-jours",
  "kpi-en-retard",
  "kpi-sans-information",
] as const;

const BLOCS_INERTES = ["kpi-informations-recues", "kpi-a-determiner"] as const;

/** Le nombre de fragments rendus par l'élément — 1 pour `block`, un par ligne pour `inline` wrappé. */
async function nombreDeRectangles(
  page: Page,
  selecteur: string,
): Promise<number> {
  return page
    .locator(selecteur)
    .evaluate((noeud) => noeud.getClientRects().length);
}

test("les trois tuiles cliquables sont `display: block`, comme les deux tuiles inertes", async ({
  page,
}) => {
  for (const bloc of BLOCS_CLIQUABLES) {
    const lien = page.locator(`[data-bloc="${bloc}"] a`);
    await expect(lien, `${bloc} — aucun <a>`).toBeVisible();
    await expect(lien).toHaveCSS("display", "block");
  }
  for (const bloc of BLOCS_INERTES) {
    const div = page.locator(`[data-bloc="${bloc}"] > div`);
    await expect(div, `${bloc} — aucune <div> racine`).toBeVisible();
    await expect(div).toHaveCSS("display", "block");
  }
});

test("chaque tuile cliquable rend UN SEUL rectangle, comme ses voisines inertes (D140, D125)", async ({
  page,
}) => {
  for (const bloc of BLOCS_CLIQUABLES) {
    const rectangles = await nombreDeRectangles(
      page,
      `[data-bloc="${bloc}"] a`,
    );
    expect(rectangles, `${bloc} se fragmente en ${rectangles} rectangles`).toBe(
      1,
    );
  }
  for (const bloc of BLOCS_INERTES) {
    const rectangles = await nombreDeRectangles(
      page,
      `[data-bloc="${bloc}"] > div`,
    );
    expect(rectangles, `${bloc} se fragmente en ${rectangles} rectangles`).toBe(
      1,
    );
  }
});

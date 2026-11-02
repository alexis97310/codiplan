import { expect, test, type Page } from "@playwright/test";

import { MARDI, cleDeJour, jourDeLaScene } from "./setup/scene";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9IC-CORRECTIFS-COURTS, point 4b — LE BANDEAU DU HAUT RESTE AU-DESSUS DE LA
 * COLONNE FIGÉE DU PLANNING, AU DÉFILEMENT **VERTICAL** DE LA PAGE (réserve
 * du solde 593 sur 9I2-SIGNATURE-TRAIT-ET-COLONNE-MOIS).
 *
 * ## Le défaut, structurellement
 *
 * `components/navigation/bandeau-bureau.tsx:32` est `sticky top-0 z-20` et
 * PRÉCÈDE le contenu de la page dans le DOM
 * (`app/(back-office)/layout.tsx` : `<BandeauBureau/>` puis
 * `<LargeurUtile>{children}</LargeurUtile>`). Les cellules figées du planning
 * (`sticky left-0 z-20`, vues Jour depuis 9H4, Mois et Semaine depuis 9I2,
 * `app/(back-office)/planning/page.tsx`) viennent APRÈS, dans le même
 * document. Deux éléments `position: sticky` à `z-index` ÉGAL se départagent
 * par l'ORDRE DU DOM — celui qui vient après peint par-dessus l'autre — donc
 * une cellule figée qui défile jusqu'à hauteur du bandeau passait PAR-DESSUS
 * lui plutôt que dessous. **Non vu à l'écran** (le défilement HORIZONTAL,
 * déjà éprouvé par `planning-jour-colonne-figee-empilement.spec.ts` et
 * `planning-mois-colonne-figee-empilement.spec.ts`, ne révèle jamais ce
 * défaut-là, qui est vertical).
 *
 * ## La mesure
 *
 * Le défilement vertical est RÉEL (`window.scrollBy`), pas une comparaison de
 * `z-index` prise isolément : on défile jusqu'à ce que le CENTRE vertical de
 * la cellule figée coïncide avec le CENTRE vertical du bandeau, puis on
 * interroge `document.elementFromPoint` à ce point — c'est la relation
 * visuelle entre les deux qui est le défaut, pas une valeur lue sur l'un des
 * deux séparément.
 */

/** Le `<header>` actuellement VISIBLE — `BandeauMobile` existe aussi dans le DOM, mais `display: none` sous 901 px. */
async function bandeauGagneSur(
  page: Page,
  selecteurCible: string,
): Promise<boolean> {
  return page.evaluate((selecteurCible) => {
    const bandeau = [...document.querySelectorAll("header")].find(
      (entete) => entete.getBoundingClientRect().height > 0,
    );
    const cible = document.querySelector(selecteurCible);
    if (bandeau === undefined || cible === null) {
      throw new Error("structure attendue absente");
    }

    const rectCible = cible.getBoundingClientRect();
    const xCible = rectCible.left + rectCible.width / 2;
    const yBandeauAvant =
      bandeau.getBoundingClientRect().top +
      bandeau.getBoundingClientRect().height / 2;
    window.scrollBy(0, rectCible.top + rectCible.height / 2 - yBandeauAvant);

    // Relu APRÈS le défilement : `sticky` garde le bandeau en place, mais
    // repartir de sa position fraîche évite toute dérive d'un sous-pixel.
    const yBandeauApres =
      bandeau.getBoundingClientRect().top +
      bandeau.getBoundingClientRect().height / 2;
    const auPoint = document.elementFromPoint(xCible, yBandeauApres);
    return auPoint !== null && bandeau.contains(auPoint);
  }, selecteurCible);
}

test.describe("le bandeau du haut gagne sur la colonne figée, au défilement vertical", () => {
  test.beforeEach(async ({ page }) => {
    // COURT, EXPRÈS : force un défilement vertical réel même avec peu de
    // lignes — la largeur (1280 px) reste celle des autres épreuves du
    // planning.
    await page.setViewportSize({ width: 1280, height: 420 });
    await ouvrirUneSession(page);
  });

  test("vue Jour", async ({ page }) => {
    const reperes = await reperesDeLaScene();
    const jour = jourDeLaScene(reperes, MARDI);
    await page.goto(`/planning?vue=jour&jour=${cleDeJour(jour)}`);

    const colonneFigee = page.locator('tbody th[scope="row"]').first();
    await expect(colonneFigee).toBeVisible();

    expect(await bandeauGagneSur(page, 'tbody th[scope="row"]')).toBe(true);
  });

  test("vue Mois", async ({ page }) => {
    const reperes = await reperesDeLaScene();
    const jour = jourDeLaScene(reperes, MARDI);
    await page.goto(`/planning?vue=mois&jour=${cleDeJour(jour)}`);

    const colonneFigee = page
      .locator('[data-maquette-bloc="tableau-mois"] td.sticky')
      .first();
    await expect(colonneFigee).toBeVisible();

    expect(
      await bandeauGagneSur(
        page,
        '[data-maquette-bloc="tableau-mois"] td.sticky',
      ),
    ).toBe(true);
  });

  test("vue Semaine", async ({ page }) => {
    const reperes = await reperesDeLaScene();
    await page.goto(
      `/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`,
    );

    const colonneFigee = page
      .locator('[data-maquette-bloc="tableau-charge-semaine"] td.sticky')
      .first();
    await expect(colonneFigee).toBeVisible();

    expect(
      await bandeauGagneSur(
        page,
        '[data-maquette-bloc="tableau-charge-semaine"] td.sticky',
      ),
    ).toBe(true);
  });
});

/**
 * `BandeauDeplacementDiffere` (`components/planning/pose.tsx` ~l.1460,
 * `absolute inset-0.5 z-20`) — MÊME défaut structurel, MÊME CSS en cause,
 * mesuré ici par la valeur résolue plutôt que par la géométrie complète : le
 * déclencher exige un glisser-déposer réel suivi d'une fenêtre d'attente de
 * 10 s (`PG-B5-ANNULER-DEPLACEMENT`, voir `planning-annuler-deplacement.
 * spec.ts`), qui ne mesurerait rien de plus sur CE point précis que la
 * relation déjà prouvée géométriquement ci-dessus pour les trois vues — même
 * précédent que `planning-jour-colonne-figee-empilement.spec.ts` (« compare
 * directement les z-index résolus plutôt que de reproduire la géométrie du
 * défilement pixel par pixel »). Le bandeau du haut porte désormais `z-30` :
 * strictement supérieur à `z-20`, pour CET élément comme pour les trois
 * tableaux ci-dessus, par construction — aucune comparaison de `z-index` ne
 * peut plus se nouer à égalité.
 */
test("le bandeau du haut porte un z-index strictement supérieur à celui de BandeauDeplacementDiffere", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await ouvrirUneSession(page);
  const reperes = await reperesDeLaScene();
  await page.goto(`/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`);

  const bandeau = page.locator("header").filter({ visible: true }).first();
  await expect(bandeau).toBeVisible();
  const zBandeau = await bandeau.evaluate((element) =>
    Number(getComputedStyle(element).zIndex),
  );
  expect(Number.isNaN(zBandeau)).toBe(false);
  // `BandeauDeplacementDiffere` pose `z-20` en dur (`pose.tsx`) — comparé ici
  // à la valeur littérale plutôt qu'à un élément monté (voir le docblock),
  // précisément parce que le monter exigerait le glisser-déposer complet.
  expect(zBandeau).toBeGreaterThan(20);
});

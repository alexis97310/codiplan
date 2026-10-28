import { expect, test, type Page } from "@playwright/test";

import { jourSuivant } from "@/lib/calendar/fuseau";

import { reperesDeLaScene } from "./setup/reperes";
import { MARDI, cleDeJour, jourDeLaScene } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * DÉFILE LE CADRE HORIZONTAL JUSQU'À CE QUE LE CENTRE HORIZONTAL DE LA
 * COLONNE FIGÉE COÏNCIDE AVEC LE CENTRE HORIZONTAL DE `cible`, PUIS RELÈVE
 * CE QUI EST PEINT AU-DESSUS AU CENTRE VERTICAL DE `cible` ELLE-MÊME — jamais
 * au centre vertical de la colonne figée, dont la ligne peut être bien plus
 * HAUTE que `cible` (le nom du technicien porte plusieurs lignes ; un badge
 * ou un lien de case n'en tient qu'une, en haut de la ligne). Un point pris
 * au centre de la colonne figée peut tomber sous `cible` sans jamais la
 * croiser, et rendrait vrai pour la mauvaise raison.
 */
async function colonneFigeeGagneSur(
  page: Page,
  selecteurTableau: string,
  selecteurCible: string,
): Promise<boolean> {
  return page.evaluate(
    ({ selecteurTableau, selecteurCible }) => {
      const table = document.querySelector(selecteurTableau);
      if (table === null) {
        throw new Error("tableau absent");
      }
      const cible = table.querySelector(selecteurCible);
      const ligne = cible?.closest("tr");
      const colonneFigee = ligne?.querySelector("td.sticky");
      const conteneur = table.closest(".overflow-x-auto");
      if (
        cible === null ||
        cible === undefined ||
        colonneFigee === null ||
        colonneFigee === undefined ||
        conteneur === null ||
        conteneur === undefined
      ) {
        throw new Error("structure attendue absente");
      }
      const rectFigee = colonneFigee.getBoundingClientRect();
      const rectCible = cible.getBoundingClientRect();
      const cibleX = rectFigee.left + rectFigee.width / 2;
      const cibleY = rectCible.top + rectCible.height / 2;
      const delta = rectCible.left + rectCible.width / 2 - cibleX;
      (conteneur as HTMLElement).scrollLeft += delta;
      const auPoint = document.elementFromPoint(cibleX, cibleY);
      return (
        auPoint !== null &&
        (auPoint === colonneFigee || colonneFigee.contains(auPoint))
      );
    },
    { selecteurTableau, selecteurCible },
  );
}

/**
 * 9I2-SIGNATURE-TRAIT-ET-COLONNE-MOIS, point 2 — LA COLONNE DES TECHNICIENS
 * RESTE AU-DESSUS DES BADGES DE LA GRILLE, VUE MOIS, QUELLE QUE SOIT LA
 * POSITION DU DÉFILEMENT.
 *
 * Même défaut que celui corrigé en vue Jour par 9H4-FINITIONS-AVANT-AUDIT
 * (point 5, voir `planning-jour-colonne-figee-empilement.spec.ts`) : la
 * colonne figée (`<td class="sticky left-0">`) posait `z-[1]`, et le badge du
 * nombre d'interventions d'une case (`relative z-10`) passait AU-DESSUS
 * d'elle plutôt que dessous, une fois la grille défilée vers la droite.
 *
 * `SCENE.obstacle` et `SCENE.chevauchante` (Ducos, MARDI, écrites une fois
 * par `global.ts`, jamais mutées ailleurs — voir le docblock de `scene.ts`)
 * posent ensemble DEUX interventions le même jour pour le même technicien :
 * la case du mardi de Ducos porte donc un badge non nul, visible sans aucune
 * autre préparation (la démonstration peut en ajouter d'autres le même
 * jour — seul « au moins une » importe ici, jamais le chiffre exact).
 *
 * La mesure déplace RÉELLEMENT le défilement horizontal du cadre (jamais une
 * comparaison de `z-index` seule) jusqu'à ce que le CENTRE de la colonne
 * figée coïncide avec le centre du badge, puis interroge
 * `document.elementFromPoint` à ce point — c'est la relation visuelle entre
 * les deux qui est le défaut, pas une valeur de `z-index` prise isolément.
 */

test("vue Mois — la colonne figée des techniciens gagne sur le badge d'une case, une fois défilée en face de lui", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();
  const jourMardi = jourDeLaScene(reperes, MARDI);
  const cleMardi = cleDeJour(jourMardi);

  await page.setViewportSize({ width: 1280, height: 900 });
  await ouvrirUneSession(page);
  // `jour` CALE LE MOIS AFFICHÉ (même paramètre que la navigation « mois
  // suivant/précédent » plus bas dans ce fichier) — le mardi de la scène
  // (lundi SANS jour passé, voir `scene.ts`) peut tomber dans le mois SUIVANT
  // celui d'aujourd'hui, si la semaine civile courante a déjà commencé.
  await page.goto(`/planning?vue=mois&jour=${cleMardi}`);

  const cellule = page.locator(
    `[data-mois-jour="${cleMardi}"][data-mois-technicien="${reperes.technicienDucos}"]`,
  );
  await expect(cellule).toBeVisible();
  const badge = cellule.locator('[class*="z-10"]');
  await expect(badge).toBeVisible();
  // TÉMOIN : au moins les deux interventions de la scène sur ce jour
  // (obstacle + chevauchante) donnent un badge non nul — la démonstration
  // peut en ajouter d'autres le même jour, sans que ça change la mesure.
  await expect(badge).toHaveText(/^[1-9][0-9]*$/);

  const gagne = await colonneFigeeGagneSur(
    page,
    '[data-maquette-bloc="tableau-mois"]',
    `[data-mois-jour="${cleMardi}"][data-mois-technicien="${reperes.technicienDucos}"] [class*="z-10"]`,
  );
  expect(gagne).toBe(true);
});

/**
 * VUE SEMAINE — MESURÉE, ET TOUCHÉE AUSSI.
 *
 * Même colonne figée (`<td class="sticky left-0">`, ~l.3000). La vue Semaine
 * ne porte aucun badge numéroté — chaque case affiche la carte entière de
 * l'intervention (`BlocPosable`), dont le conteneur n'est que `relative`
 * SANS AUCUN `z-index` EXPLICITE (`components/planning/pose.tsx` ~l.1133),
 * et NE PASSE DONC PAS au-dessus d'un `z-index` explicite — pas de défaut
 * là. Mais la MÊME case (`CasePosable`) pose aussi « + Créer ici »
 * (`a[data-creer-ici]`, `pose.tsx` ~l.1409) en `position: absolute; z-10`
 * dès qu'elle est cliquée vide, ouverte, non bloquée — avec exactement le
 * même défaut que le badge du Mois : posée `z-[1]` avant ce ticket, la
 * colonne figée passait DESSOUS ce lien, une fois la grille défilée.
 *
 * *Mesurée AVEC la même géométrie que la vue Mois ci-dessus (centre horizontal
 * de la colonne, centre VERTICAL de la cible, jamais de la ligne entière) —
 * une première mesure prise au centre vertical de la colonne figée (plus
 * haute que la case, qui ne tient qu'une ligne) rendait vrai pour la mauvaise
 * raison : le point tombait sous le nom du technicien, jamais sur le lien.*
 * Cette épreuve révèle la case (loin dans le futur, pour être sûre qu'elle
 * est vide) puis mesure : la colonne figée doit gagner.
 */
test("vue Semaine — la colonne figée des techniciens gagne aussi sur « + Créer ici », une fois défilée en face", async ({
  page,
}) => {
  const RANG_SEMAINES = 30;
  const reperes = await reperesDeLaScene();
  const lundiLoin = jourSuivant(reperes.lundi, RANG_SEMAINES * 7);
  const jourMardiLoin = jourSuivant(
    jourDeLaScene(reperes, MARDI),
    RANG_SEMAINES * 7,
  );
  const cleMardiLoin = cleDeJour(jourMardiLoin);

  await page.setViewportSize({ width: 1280, height: 900 });
  await ouvrirUneSession(page);
  await page.goto(`/planning?vue=semaine&semaine=${cleDeJour(lundiLoin)}`);

  const case_ = page.locator(
    `td[data-depot-jour="${cleMardiLoin}"][data-depot-technicien="${reperes.technicienDucos}"]`,
  );
  await expect(case_).toBeVisible();
  await expect(case_.locator("a[data-tiroir-declencheur]")).toHaveCount(0);
  await case_.click();
  const lien = case_.locator("a[data-creer-ici]");
  await expect(lien).toBeVisible();

  const gagne = await colonneFigeeGagneSur(
    page,
    '[data-maquette-bloc="tableau-charge-semaine"]',
    `td[data-depot-jour="${cleMardiLoin}"][data-depot-technicien="${reperes.technicienDucos}"] a[data-creer-ici]`,
  );
  expect(gagne).toBe(true);
});

import type { Locator, Page } from "@playwright/test";

/**
 * GLISSER UN BLOC SUR UNE CASE — à la SOURIS, jamais par des événements forgés.
 *
 * ## Pourquoi pas `locator.dragTo`
 *
 * *Mesuré le 11/09/2026, trois façons de glisser le même bloc sur la même case,
 * dans la même exécution :*
 *
 * | Façon | Requêtes `POST` observées |
 * |---|---|
 * | `locator.dragTo(cible)` | **0** |
 * | souris réelle, avec mouvements intermédiaires | **1** |
 * | `dispatchEvent` de `dragstart`/`dragover`/`drop` | 1 |
 *
 * `dragTo` n'engage pas le glisser-déposer HTML5 de Chromium : il ne produit
 * aucun événement, et le scénario serait passé à côté de tout.
 *
 * ## Pourquoi pas non plus des événements forgés
 *
 * Ils marchent — et ils prouvent moins. Un `dispatchEvent` montre que les
 * GESTIONNAIRES répondent ; il ne montre pas que le navigateur engage un
 * glissé sur ce `draggable`-là, ni qu'il autorise le dépôt sur cette case-là.
 * *Une épreuve qui contourne le mécanisme qu'elle mesure ne mesure que
 * soi-même.* La souris, elle, traverse tout.
 *
 * ## Les mouvements intermédiaires ne sont pas une précaution
 *
 * Chromium n'engage un glissé qu'après un déplacement franchissant son seuil,
 * puis n'accepte un dépôt qu'après au moins un `dragover` sur la cible. D'où
 * deux déplacements découpés en pas, et non un saut.
 */
/** Le milieu de la partie VISIBLE d'une boîte, ou `null` si rien n'est visible. */
function pointVisible(
  boite: { x: number; y: number; width: number; height: number },
  fenetre: { width: number; height: number },
): { x: number; y: number } | null {
  const gauche = Math.max(boite.x, 0);
  const droite = Math.min(boite.x + boite.width, fenetre.width);
  const haut = Math.max(boite.y, 0);
  const bas = Math.min(boite.y + boite.height, fenetre.height);
  if (droite - gauche < 4 || bas - haut < 4) {
    return null;
  }
  return { x: (gauche + droite) / 2, y: (haut + bas) / 2 };
}

/**
 * AGRANDIT LA FENÊTRE POUR QU'ELLE CONTIENNE LES DEUX BOÎTES ENTIÈRES, sans
 * aucun défilement — ou renvoie `false` si la page ne s'y prête pas
 * (63-STABILITE-4).
 *
 * *Mesuré le 25/09/2026 : une file d'attente que d'autres scènes du dépôt
 * font grandir en parallèle peut séparer une carte de la case qu'elle vise
 * de PLUS d'une fenêtre entière — aucun défilement unique, si généreuse
 * soit la fenêtre choisie, ne les réunit alors.* Défiler PENDANT le glissé
 * a été essayé et mesuré INOPÉRANT : une fois le glissé HTML5 natif engagé
 * (après `mouse.down`), Chromium ignore `window.scrollBy` — la position
 * mesurée après quatre-vingts tentatives était identique à la première,
 * PAS d'un seul pixel de mieux. Le glissé, une fois commencé, ne tolère
 * aucun défilement : la fenêtre doit donc déjà contenir les deux boîtes
 * AVANT `mouse.down`, jamais après.
 *
 * Une fenêtre de test n'est pas un écran physique : rien n'empêche de la
 * rendre aussi haute que la page l'exige, LE TEMPS DE CE GLISSÉ SEUL — la
 * fonction appelante restaure la taille d'origine ensuite.
 */
async function agrandirPourContenirLesDeux(
  page: Page,
  source: Locator,
  cible: Locator,
  fenetreOrigine: { width: number; height: number },
): Promise<boolean> {
  await page.evaluate(() => window.scrollTo(0, 0));
  const [avantSource, avantCible] = await Promise.all([
    source.boundingBox(),
    cible.boundingBox(),
  ]);
  if (avantSource === null || avantCible === null) {
    return false;
  }
  const haut = Math.min(avantSource.y, avantCible.y);
  const bas = Math.max(
    avantSource.y + avantSource.height,
    avantCible.y + avantCible.height,
  );
  // MARGE, PAS PRÉCISION : `pointVisible` exige 4 px de boîte visible de
  // chaque côté, une hauteur pile ajustée y échouerait par arrondi.
  const hauteurRequise = Math.ceil(bas - haut) + 40;
  // BORNÉE, MÊME ICI : un test dont la scène a dérivé au point de réclamer
  // une fenêtre de plusieurs centaines de milliers de pixels ne prouve
  // plus rien qu'un défilement borné n'aurait déjà refusé plus proprement.
  const PLAFOND = 60_000;
  if (hauteurRequise > PLAFOND) {
    return false;
  }
  await page.setViewportSize({
    width: fenetreOrigine.width,
    height: Math.max(hauteurRequise, fenetreOrigine.height),
  });
  await page.evaluate((dy) => window.scrollBy(0, dy), haut - 20);
  return true;
}

export async function glisser(
  page: Page,
  source: Locator,
  cible: Locator,
): Promise<void> {
  // AMENER LES DEUX À L'ÉCRAN D'ABORD, et VISER LEUR PARTIE VISIBLE.
  //
  // *Mesuré le 11/09/2026 : la case visée faisait 336 px de haut dans une
  // fenêtre de 720, et son CENTRE tombait hors de la fenêtre.* Puis, une fois
  // la source amenée à l'écran, c'est le HAUT de la case qui passait au-dessus
  // du bord : une boîte partiellement visible a un centre invisible. **Un point
  // hors fenêtre n'est pas une erreur pour la souris : c'est un geste qui n'a
  // pas lieu, et qui ne dit rien** — le scénario échouait alors sur l'absence
  // de refus, c'est-à-dire en accusant la règle au lieu du geste.
  //
  // UN SEUL DÉFILEMENT, VERS LE MILIEU DES DEUX — jamais deux appels
  // successifs à `scrollIntoViewIfNeeded`. Mesuré le 23/09/2026
  // (PARCOURS-1-REPRISE) : amener la CIBLE à l'écran, puis la SOURCE,
  // ressort la cible de l'écran quand les deux sont loin l'une de l'autre —
  // la case visée se retrouvait à `y:-146.6`, strictement hors fenêtre, la
  // source (la file d'attente) ayant grossi avec chaque scénario du dépôt
  // qui pose une intervention à planifier sans la planifier ensuite. Un
  // défilement UNIQUE vers le MILIEU des deux centres donne aux deux la
  // même chance d'être visibles ensemble.
  const fenetreOrigine = page.viewportSize() ?? { width: 1280, height: 720 };
  await cible.scrollIntoViewIfNeeded();
  let fenetre = fenetreOrigine;
  const avantSource = await source.boundingBox();
  const avantCible = await cible.boundingBox();
  if (avantSource === null || avantCible === null) {
    throw new Error(
      "Le glissé vise un élément sans boîte : la source ou la case n'est pas " +
        "dans la page, et le scénario mesurerait un geste qui n'a pas eu lieu.",
    );
  }
  const milieu =
    (avantSource.y +
      avantSource.height / 2 +
      (avantCible.y + avantCible.height / 2)) /
    2;
  const decalage = milieu - fenetre.height / 2;
  if (Math.abs(decalage) > 1) {
    await page.evaluate((dy) => window.scrollBy(0, dy), decalage);
  }

  let depart = await source.boundingBox();
  let arrivee = await cible.boundingBox();
  if (depart === null || arrivee === null) {
    throw new Error(
      "Le glissé vise un élément sans boîte : la source ou la case n'est pas " +
        "dans la page, et le scénario mesurerait un geste qui n'a pas eu lieu.",
    );
  }
  let fenetreAgrandie = false;
  if (
    pointVisible(depart, fenetre) === null ||
    pointVisible(arrivee, fenetre) === null
  ) {
    // LE DÉFILEMENT UNIQUE NE SUFFIT PAS (63-STABILITE-4) : la source et la
    // case sont séparées de plus d'une fenêtre entière — mesuré sur une file
    // d'attente que d'autres scènes du dépôt font grandir en parallèle.
    // Défiler PENDANT le glissé a été essayé et mesuré inopérant sur un
    // glissé HTML5 natif engagé (voir `agrandirPourContenirLesDeux`) : la
    // fenêtre doit donc déjà contenir les deux boîtes AVANT `mouse.down`.
    fenetreAgrandie = await agrandirPourContenirLesDeux(
      page,
      source,
      cible,
      fenetreOrigine,
    );
    if (fenetreAgrandie) {
      fenetre = page.viewportSize() ?? fenetreOrigine;
      depart = await source.boundingBox();
      arrivee = await cible.boundingBox();
    }
  }
  if (depart === null || arrivee === null) {
    throw new Error(
      "Le glissé vise un élément sans boîte : la source ou la case n'est pas " +
        "dans la page, et le scénario mesurerait un geste qui n'a pas eu lieu.",
    );
  }
  const prise = pointVisible(depart, fenetre);
  const pose = pointVisible(arrivee, fenetre);
  if (prise === null || pose === null) {
    if (fenetreAgrandie) {
      await page.setViewportSize(fenetreOrigine);
    }
    // Un ÉCHEC BRUYANT plutôt qu'un geste muet : sans cela, le scénario
    // accuserait la règle métier de ne pas avoir refusé.
    throw new Error(
      "Le glissé ne trouve aucun point visible sur la source ou sur la case : " +
        `source ${JSON.stringify(depart)}, case ${JSON.stringify(arrivee)}, ` +
        `fenêtre ${JSON.stringify(fenetre)}.`,
    );
  }

  try {
    await page.mouse.move(prise.x, prise.y);
    await page.mouse.down();
    // Les mouvements découpés ne sont pas une précaution : Chromium n'engage
    // un glissé qu'après un déplacement franchissant son seuil, puis
    // n'accepte un dépôt qu'après au moins un `dragover` sur la cible.
    await page.mouse.move(pose.x, pose.y, { steps: 20 });
    await page.mouse.move(pose.x + 2, pose.y + 2, { steps: 10 });
    await page.mouse.up();
  } finally {
    // LA FENÊTRE AGRANDIE NE SURVIT PAS À CE GLISSÉ : un scénario qui
    // capture un écran ou vérifie une position APRÈS l'appel ne doit rien
    // voir d'autre que la fenêtre qu'il avait lui-même choisie.
    if (fenetreAgrandie) {
      await page.setViewportSize(fenetreOrigine);
    }
  }
}

import type { ElementHandle, Locator, Page } from "@playwright/test";

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
/**
 * Le milieu de la partie VISIBLE d'une boîte, ou `null` si rien n'est visible.
 *
 * `hautMin` exclut le bandeau fixe du haut (voir `hauteurChromeFixe`) : une
 * boîte dont le haut dépasse sous le bord de la fenêtre n'est pas pour
 * autant visible jusqu'à `y:0` si un bandeau `sticky top-0` y reste plaqué
 * en permanence — mesuré le 06/10/2026 (9DU-TP-NAV3-RECHERCHE-RAIL : le
 * bandeau du bureau, absent avant ce lot, recouvre désormais cette bande).
 */
export function pointVisible(
  boite: { x: number; y: number; width: number; height: number },
  fenetre: { width: number; height: number },
  hautMin: number,
): { x: number; y: number } | null {
  const gauche = Math.max(boite.x, 0);
  const droite = Math.min(boite.x + boite.width, fenetre.width);
  const haut = Math.max(boite.y, hautMin);
  const bas = Math.min(boite.y + boite.height, fenetre.height);
  if (droite - gauche < 4 || bas - haut < 4) {
    return null;
  }
  return { x: (gauche + droite) / 2, y: (haut + bas) / 2 };
}

/**
 * HAUTEUR DU BANDEAU FIXE DU HAUT, s'il y en a un — le bas du premier
 * `<header>` `sticky`/`fixed` plaqué à `top:0` sur (quasi) toute la largeur
 * de la fenêtre (`BandeauMobile`, `BandeauBureau` : convention commune des
 * deux, `components/navigation/bandeau-{mobile,bureau}.tsx`). 0 si aucun —
 * cherché par le DOM et un calcul, jamais par un sélecteur d'écran, pour ne
 * rien savoir d'une page en particulier.
 */
export async function hauteurChromeFixe(page: Page): Promise<number> {
  return page.evaluate(() => {
    let max = 0;
    for (const el of document.querySelectorAll<HTMLElement>("header")) {
      const style = getComputedStyle(el);
      if (style.position !== "sticky" && style.position !== "fixed") {
        continue;
      }
      const rect = el.getBoundingClientRect();
      if (rect.top > 1 || rect.height === 0) {
        continue;
      }
      if (rect.width < window.innerWidth * 0.5) {
        continue;
      }
      max = Math.max(max, rect.bottom);
    }
    return max;
  });
}

/**
 * LE POINT VISÉ ATTEINT-IL VRAIMENT L'ÉLÉMENT ?
 *
 * `pointVisible` ne juge que les BORDS DE LA FENÊTRE — il ne sait rien de la
 * colonne « Technicien », `sticky left-0` (PLANNING-2), qui reste PLAQUÉE au
 * bord gauche du cadre défilant quelle que soit sa position de défilement
 * (PG-C3-CARTES-COLONNES, colonnes de jour à 150 px minimum). *Mesuré le
 * 29/09/2026 : une source jugée « visible » par `pointVisible` (son centre
 * tombait à `x:665`, dans les bornes de la fenêtre) était en réalité
 * ENTIÈREMENT RECOUVERTE par cette colonne sticky (qui occupe `x:599` à
 * `x:769`) — `cible.scrollIntoViewIfNeeded()` avait fait défiler le cadre
 * assez loin pour amener la case visée à l'écran, mais pas assez peu pour
 * laisser la source hors de la colonne. Aucun `dragstart` ne partait : la
 * souris posait sa prise sur un tout autre élément, et aucune exception ne
 * le disait puisque `pointVisible` ne voit que la fenêtre.* Cette fonction
 * interroge le DOM directement, comme un vrai clic le ferait :
 * `elementFromPoint` doit résoudre l'élément LUI-MÊME, ou l'un de ses
 * descendants (une carte posée dedans compte).
 */
async function pointAtteint(
  element: Locator,
  x: number,
  y: number,
): Promise<boolean> {
  return element.evaluate(
    (noeud, [px, py]) => {
      const trouve = document.elementFromPoint(px, py);
      return trouve !== null && (trouve === noeud || noeud.contains(trouve));
    },
    [x, y] as const,
  );
}

/**
 * LE CADRE DÉFILANT HORIZONTALEMENT LE PLUS PROCHE DE LA CIBLE (`overflow-x`,
 * `CadreDefilant` — `components/ui/cadre-defilant.tsx`), ou `null` si la
 * cible n'en a aucun (vue Jour, sans colonnes de largeur fixe). Cherché par
 * le DOM, jamais par un sélecteur d'écran : ce fichier ne doit rien savoir de
 * la vue Semaine en particulier.
 */
async function conteneurDefilantDe(
  cible: Locator,
): Promise<ElementHandle<HTMLElement> | null> {
  const handle = await cible.evaluateHandle((element) => {
    let noeud: HTMLElement | null = (element as HTMLElement).parentElement;
    while (noeud !== null) {
      const style = getComputedStyle(noeud);
      if (
        (style.overflowX === "auto" || style.overflowX === "scroll") &&
        noeud.scrollWidth > noeud.clientWidth + 1
      ) {
        return noeud;
      }
      noeud = noeud.parentElement;
    }
    return null;
  });
  return handle.asElement() as ElementHandle<HTMLElement> | null;
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
 * **LA LARGEUR ENTRE AUSSI DEPUIS PG-C3-CARTES-COLONNES** (29/09/2026) : les
 * colonnes de jour à 150 px minimum (QG-1) font défiler la grille Semaine
 * horizontalement dans `CadreDefilant`, et la colonne « Technicien »,
 * `sticky left-0`, RECOUVRE alors ce qu'il reste défilé derrière elle dès
 * que la source et la cible sont trop loin l'une de l'autre pour tenir
 * ensemble. Élargir la fenêtre pour supprimer le débordement du cadre
 * RÉSOUT le problème à la racine plutôt que de le contourner pendant le
 * glissé : *mesuré le 29/09/2026, à 2200 px de large, un cadre dont le
 * contenu naturel mesure 1070 px ne déborde plus du tout — source et cible,
 * même à quatre colonnes d'écart, tiennent ensemble sans que l'une recouvre
 * l'autre.*
 *
 * Une fenêtre de test n'est pas un écran physique : rien n'empêche de la
 * rendre aussi grande que la page l'exige, LE TEMPS DE CE GLISSÉ SEUL — la
 * fonction appelante restaure la taille d'origine ensuite.
 */
async function agrandirPourContenirLesDeux(
  page: Page,
  source: Locator,
  cible: Locator,
  fenetreOrigine: { width: number; height: number },
  chromeHaut: number,
): Promise<boolean> {
  await page.evaluate(() => window.scrollTo(0, 0));

  // LARGEUR : le débordement du cadre défilant de la cible, mesuré avant
  // tout redimensionnement — jamais la position des boîtes, qui dépend déjà
  // de la largeur EN COURS de la fenêtre.
  const conteneur = await conteneurDefilantDe(cible);
  let largeurRequise = fenetreOrigine.width;
  if (conteneur !== null) {
    const debordement = await conteneur.evaluate(
      (el) => el.scrollWidth - el.clientWidth,
    );
    if (debordement > 1) {
      largeurRequise = fenetreOrigine.width + debordement + 40;
    }
  }

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
  // Le bandeau fixe du haut (`chromeHaut`) réduit d'autant la bande
  // réellement disponible : sans lui ajouter ici, la fenêtre agrandie reste
  // juste assez haute pour les deux boîtes mais pas pour le bandeau qui les
  // recouvre en plus (09DU-TP-NAV3-RECHERCHE-RAIL).
  const hauteurRequise = Math.ceil(bas - haut) + 40 + chromeHaut;
  // BORNÉE, MÊME ICI : un test dont la scène a dérivé au point de réclamer
  // une fenêtre de plusieurs centaines de milliers de pixels ne prouve
  // plus rien qu'un défilement borné n'aurait déjà refusé plus proprement.
  const PLAFOND = 60_000;
  if (hauteurRequise > PLAFOND || largeurRequise > PLAFOND) {
    return false;
  }
  await page.setViewportSize({
    width: Math.max(largeurRequise, fenetreOrigine.width),
    height: Math.max(hauteurRequise, fenetreOrigine.height),
  });
  // LE CADRE NE DÉBORDE PLUS (largeur élargie exprès) : le ramener à
  // `scrollLeft: 0` retire le décalage que le premier `scrollIntoViewIfNeeded`
  // avait pu lui poser avant l'agrandissement.
  if (conteneur !== null) {
    await conteneur.evaluate((el) => {
      el.scrollLeft = 0;
    });
  }
  // `haut` doit tomber juste SOUS le bandeau fixe, pas à `y:20` absolu.
  await page.evaluate((dy) => window.scrollBy(0, dy), haut - chromeHaut - 20);
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
  const chromeHaut = await hauteurChromeFixe(page);
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

  // « VISIBLE » NE SUFFIT PAS (voir `pointAtteint`) : même quand les deux
  // boîtes tombent dans les bornes de la fenêtre, l'une peut recouvrir
  // l'autre derrière la colonne « Technicien » sticky. Le seul juge fiable
  // est le DOM lui-même, au point que la souris viserait.
  let prise = pointVisible(depart, fenetre, chromeHaut);
  let pose = pointVisible(arrivee, fenetre, chromeHaut);
  let atteignable =
    prise !== null &&
    pose !== null &&
    (await pointAtteint(source, prise.x, prise.y)) &&
    (await pointAtteint(cible, pose.x, pose.y));

  let fenetreAgrandie = false;
  if (!atteignable) {
    // LE DÉFILEMENT UNIQUE NE SUFFIT PAS (63-STABILITE-4, puis
    // PG-C3-CARTES-COLONNES) : la source et la case sont séparées de plus
    // d'une fenêtre entière, OU l'une recouvre l'autre derrière la colonne
    // « Technicien » sticky. Défiler PENDANT le glissé a été essayé et
    // mesuré inopérant sur un glissé HTML5 natif engagé (voir
    // `agrandirPourContenirLesDeux`) : la fenêtre doit donc déjà contenir
    // les deux boîtes AVANT `mouse.down`.
    fenetreAgrandie = await agrandirPourContenirLesDeux(
      page,
      source,
      cible,
      fenetreOrigine,
      chromeHaut,
    );
    if (fenetreAgrandie) {
      fenetre = page.viewportSize() ?? fenetreOrigine;
      depart = await source.boundingBox();
      arrivee = await cible.boundingBox();
      if (depart !== null && arrivee !== null) {
        prise = pointVisible(depart, fenetre, chromeHaut);
        pose = pointVisible(arrivee, fenetre, chromeHaut);
        atteignable =
          prise !== null &&
          pose !== null &&
          (await pointAtteint(source, prise.x, prise.y)) &&
          (await pointAtteint(cible, pose.x, pose.y));
      }
    }
  }

  if (depart === null || arrivee === null || prise === null || pose === null) {
    if (fenetreAgrandie) {
      await page.setViewportSize(fenetreOrigine);
    }
    throw new Error(
      "Le glissé vise un élément sans boîte : la source ou la case n'est pas " +
        "dans la page, et le scénario mesurerait un geste qui n'a pas eu lieu.",
    );
  }
  if (!atteignable) {
    if (fenetreAgrandie) {
      await page.setViewportSize(fenetreOrigine);
    }
    // Un ÉCHEC BRUYANT plutôt qu'un geste muet : sans cela, le scénario
    // accuserait la règle métier de ne pas avoir refusé.
    throw new Error(
      "Le glissé ne trouve aucun point qui atteigne réellement la source ET " +
        `la case, même après agrandissement : source ${JSON.stringify(depart)}, ` +
        `case ${JSON.stringify(arrivee)}, fenêtre ${JSON.stringify(fenetre)}.`,
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

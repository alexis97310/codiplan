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
  await cible.scrollIntoViewIfNeeded();
  await source.scrollIntoViewIfNeeded();
  const fenetre = page.viewportSize() ?? { width: 1280, height: 720 };
  const depart = await source.boundingBox();
  const arrivee = await cible.boundingBox();
  if (depart === null || arrivee === null) {
    throw new Error(
      "Le glissé vise un élément sans boîte : la source ou la case n'est pas " +
        "dans la page, et le scénario mesurerait un geste qui n'a pas eu lieu.",
    );
  }
  const prise = pointVisible(depart, fenetre);
  const pose = pointVisible(arrivee, fenetre);
  if (prise === null || pose === null) {
    // Un ÉCHEC BRUYANT plutôt qu'un geste muet : sans cela, le scénario
    // accuserait la règle métier de ne pas avoir refusé.
    throw new Error(
      "Le glissé ne trouve aucun point visible sur la source ou sur la case : " +
        `source ${JSON.stringify(depart)}, case ${JSON.stringify(arrivee)}, ` +
        `fenêtre ${JSON.stringify(fenetre)}.`,
    );
  }

  await page.mouse.move(prise.x, prise.y);
  await page.mouse.down();
  // Les mouvements découpés ne sont pas une précaution : Chromium n'engage un
  // glissé qu'après un déplacement franchissant son seuil, puis n'accepte un
  // dépôt qu'après au moins un `dragover` sur la cible.
  await page.mouse.move(pose.x, pose.y, { steps: 20 });
  await page.mouse.move(pose.x + 2, pose.y + 2, { steps: 10 });
  await page.mouse.up();
}

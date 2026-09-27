/**
 * L'INDICE DE DÉFILEMENT — fonction pure (9AS-CG3, 28/09/2026).
 *
 * Sépare le calcul (testable sans DOM) du composant qui l'observe
 * (`components/ui/cadre-defilant.tsx`). Tolérance de 1 px : `scrollLeft` et
 * `scrollWidth - clientWidth` sont des flottants arrondis différemment selon
 * le navigateur, et une tolérance nulle ferait clignoter l'indice de gauche
 * à la fin exacte d'un défilement.
 */

const TOLERANCE_PX = 1;

export function indicesDeDefilement({
  scrollLeft,
  scrollWidth,
  clientWidth,
}: {
  readonly scrollLeft: number;
  readonly scrollWidth: number;
  readonly clientWidth: number;
}): { readonly gauche: boolean; readonly droite: boolean } {
  const debordement = scrollWidth - clientWidth;
  if (debordement <= TOLERANCE_PX) {
    return { gauche: false, droite: false };
  }
  return {
    gauche: scrollLeft > TOLERANCE_PX,
    droite: scrollLeft < debordement - TOLERANCE_PX,
  };
}

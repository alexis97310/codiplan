/**
 * LA RÈGLE « QUAND RAFRAÎCHIR » (9F4H5-TERRAIN-VIVANT, point 2) — LA PART
 * PURE, éprouvée sans navigateur (D-13). `components/terrain/
 * rafraichissement-auto.tsx` l'appelle à chaque signal (visibilité, retour
 * du réseau, minuterie).
 *
 * Trois conditions, et les trois à la fois : visible (un onglet caché ne
 * sert à rien à rafraîchir), en ligne (hors réseau, I4, rien à aller
 * chercher), et aucune activité terrain en cours (point 2 : jamais pendant
 * qu'un geste s'envoie ou qu'une saisie du rapport est en attente).
 */
export function doitRafraichir(params: {
  readonly visible: boolean;
  readonly enLigne: boolean;
  readonly activiteEnCours: boolean;
}): boolean {
  return params.visible && params.enLigne && !params.activiteEnCours;
}

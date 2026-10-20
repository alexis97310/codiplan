/**
 * UNE ACTIVITÉ TERRAIN EN COURS, PARTAGÉE (9F4H5-TERRAIN-VIVANT, point 2) —
 * le rafraîchissement automatique (`components/terrain/rafraichissement-
 * auto.tsx`) ne doit JAMAIS se déclencher pendant qu'un geste est en cours
 * d'envoi (compteur, « Envoyer ») ni pendant une saisie dans le rapport
 * (debounce en attente, ou envoi en cours) : un rafraîchissement au mauvais
 * instant redessinerait la page sous un geste qui n'a pas fini.
 *
 * ## UN ENSEMBLE DE JETONS, JAMAIS UN SEUL COMPTEUR
 *
 * Plusieurs activités peuvent se superposer (le compteur ET le rapport, par
 * exemple) ; un simple booléen ou un compteur à incrémenter/décrémenter se
 * désynchronise au premier appel en double ou manquant. Un ensemble de
 * jetons est idempotent : démarrer deux fois le MÊME jeton, ou le terminer
 * alors qu'il est déjà absent, ne fait jamais basculer l'état par erreur.
 */

const jetons = new Set<string>();

/** Une activité commence (ou continue, si déjà en cours) sous ce jeton. */
export function demarrerActiviteTerrain(jeton: string): void {
  jetons.add(jeton);
}

/** Une activité se termine sous ce jeton — sans effet si elle n'était pas en cours. */
export function terminerActiviteTerrain(jeton: string): void {
  jetons.delete(jeton);
}

/** Une activité terrain est-elle en cours, sous N'IMPORTE QUEL jeton ? */
export function activiteTerrainEnCours(): boolean {
  return jetons.size > 0;
}

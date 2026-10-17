/**
 * LA CLÉ DU BROUILLON LOCAL — partagée par `components/terrain/rapport-
 * automatique.tsx` (qui l'écrit et l'efface après un « Terminer » accepté en
 * ligne) et `lib/terrain/envoi-file.ts` (qui l'efface après un « terminer »
 * envoyé depuis la file, 9F4H3-HORS-RESEAU-ENVOYER point 2) — une seule
 * fonction, pour que les deux ne divergent jamais sur le format de la clé
 * (§9, 01/09).
 */
export function cleBrouillon(interventionId: string): string {
  return `codiplan.terrain.${interventionId}.brouillon`;
}

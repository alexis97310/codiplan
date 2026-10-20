/**
 * L'HEURE ENVOYÉE AU SERVEUR, CALÉE SUR LA SIENNE (9F4H5A-HEURE-CALEE-
 * SERVEUR, décision n° 132 d'Alexis, 20/10/2026 ; D214).
 *
 * `demarrerLeCompteur` et `terminerIntervention` PEUVENT fermer/ouvrir un
 * essai EN LIGNE à l'heure du SERVEUR quand le téléphone est en avance
 * (9F4H4D) — mais `arreterLeCompteur` n'a AUCUNE colonne d'identité, et
 * reste borné QUEL QUE SOIT `depuisFile` (`lib/interventions/compteur.ts`,
 * `verifierInstantAppareil`, D115-1) : un `instant_appareil` de plus de
 * 5 minutes dans le futur est REFUSÉ même en ligne, pour ne pas casser son
 * rejeu par l'instant exact.
 *
 * Plutôt que d'assouplir cette borne serveur, le TÉLÉPHONE cale ce qu'il
 * ENVOIE : `instantAppareilCale` corrige `instantAppareil` par l'écart
 * mesuré une seule fois au montage (`decalageHorloge`,
 * `lib/terrain/compteur-vivant.ts`) — mais seulement si cet écart dépasse
 * une minute, pour ne jamais sur-corriger une horloge déjà juste à la
 * seconde. En dessous du seuil, ou hors ligne (`decalageHorlogeMs` nul,
 * aucune heure serveur connue), l'heure du téléphone part telle quelle.
 */

const SEUIL_CORRECTION_MS = 60_000;

export function instantAppareilCale(params: {
  readonly instantAppareil: Date;
  readonly decalageHorlogeMs: number;
}): Date {
  if (Math.abs(params.decalageHorlogeMs) <= SEUIL_CORRECTION_MS) {
    return params.instantAppareil;
  }
  return new Date(params.instantAppareil.getTime() + params.decalageHorlogeMs);
}

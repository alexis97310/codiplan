/**
 * LE CALCUL DU COMPTEUR QUI DÉFILE (9F4H5-TERRAIN-VIVANT, point 1) — LA PART
 * PURE, éprouvée sans navigateur (D-13). `components/terrain/compteur-
 * vivant.tsx` l'appelle chaque seconde.
 *
 * ## POURQUOI UN DÉCALAGE D'HORLOGE
 *
 * Le départ du segment (`depart`) peut venir du SERVEUR (un compteur démarré
 * en ligne) et être relu par un téléphone dont l'horloge avance ou retarde.
 * `decalageHorloge` mesure l'écart, une seule fois, entre l'heure du serveur
 * au moment du rendu et celle de l'appareil au même instant ; `secondesEcoulees`
 * l'applique ensuite à chaque tic, pour que le compteur suive l'horloge du
 * SERVEUR plutôt que celle, possiblement fausse, du téléphone.
 *
 * Hors réseau (aucune session, aucune heure serveur connue), `instantServeur`
 * est `null` et le décalage est nul : le départ est alors l'heure de
 * l'appareil lui-même (`instantLocal` du geste en file), et il n'y a rien à
 * corriger contre — c'est déjà l'heure qu'on affiche comme telle.
 *
 * ## `instantAppareil`, ET POURQUOI CE FICHIER EST EXEMPTÉ DU GARDIEN L0-08
 *
 * Même raisonnement que `lib/db/uuid.ts`/`lib/terrain/uuid-appareil.ts`
 * (voir leur exemption dans `tests/unit/calendar/sans-date-courante-
 * implicite.test.ts`) : ce que ce fichier lit de l'horloge est un INSTANT,
 * jamais interprété localement — aucun champ calendaire, aucun `getHours`,
 * aucun formatage ; seulement une soustraction en millisecondes pour une
 * DURÉE. Le gardien traque l'interprétation locale d'une heure sans fuseau,
 * pas la lecture de l'horloge elle-même. `instantAppareil` est le POINT DE
 * PASSAGE UNIQUE : `components/terrain/compteur-vivant.tsx` l'appelle et
 * n'a besoin d'aucune exemption à lui.
 */

/** L'heure de l'appareil, maintenant — un instant, jamais une lecture locale. */
export function instantAppareil(): Date {
  return new Date();
}

/** Écart, en millisecondes, entre l'heure du serveur et celle de l'appareil. */
export function decalageHorloge(
  instantServeur: Date | null,
  maintenantAppareil: Date,
): number {
  return instantServeur === null
    ? 0
    : instantServeur.getTime() - maintenantAppareil.getTime();
}

/**
 * Le total vivant, en secondes : les minutes déjà fermées, plus l'écoulé du
 * segment en cours — jamais négatif, même si l'horloge de l'appareil recule
 * ou que `maintenant` précède `depart` (lie-fi, segment tout juste ouvert).
 */
export function secondesEcoulees(params: {
  readonly depart: Date;
  readonly minutesFermees: number;
  readonly decalageHorlogeMs: number;
  readonly maintenant: Date;
}): number {
  const ecoule =
    (params.maintenant.getTime() +
      params.decalageHorlogeMs -
      params.depart.getTime()) /
    1000;
  return Math.max(0, params.minutesFermees * 60 + ecoule);
}

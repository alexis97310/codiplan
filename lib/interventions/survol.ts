/**
 * LE SURVOL D'UNE CASE PENDANT UN GLISSER-DÉPOSER (PG-B4-SURVOL-CASES,
 * spécification §3.11).
 *
 * ## Le défaut qu'elle répare
 *
 * Absences et fermetures hebdomadaires sont déjà DESSINÉES sur la grille
 * (PLANNING-1) ; le refus, lui, ne se lisait qu'APRÈS le dépôt
 * (`components/planning/pose.tsx`, `interpreterReponseDepot`). Cette
 * fonction donne, PENDANT le glissé, un indice tiré des mêmes données déjà
 * chargées par la page — rien de plus.
 *
 * ## Elle NE REMPLACE PAS LE SERVEUR
 *
 * `jugerPose` (`lib/interventions/depot.ts`) reste seul juge à l'écriture
 * (R2-19). Cette fonction est PURE et ne lit qu'un instantané déjà en main :
 * aucune requête pendant le glissé, aucune garantie que son verdict survive
 * jusqu'au dépôt (une absence peut être déclarée par un autre onglet entre
 * temps, par exemple) — un INDICE, jamais une décision.
 *
 * ## CE QU'ELLE NE SAIT PAS, ELLE NE L'INVENTE PAS
 *
 * L'habilitation exigée par un site n'est PAS chargée par la page du
 * planning aujourd'hui (elle ne l'est qu'à la pose, côté serveur,
 * `verdictHabilitationSous`) : `donneesChargees.habilitationManquante` vaut
 * alors `null`, et cette fonction rend `possible: true` plutôt qu'un refus
 * qu'aucune donnée ne soutient — un DONT-KNOW n'est pas un refus (§9, 20/08).
 * Le jour où la page chargera cette donnée, il suffira de ne plus passer
 * `null`.
 */

/** Les quatre motifs de refus que le survol peut annoncer. */
export type MotifRefusSurvol =
  "absent" | "ferie" | "agence_fermee" | "habilitation_manquante";

export type EtatDeSurvol =
  | { readonly possible: true }
  | { readonly possible: false; readonly motif: MotifRefusSurvol };

/** L'intervention en cours de glissé — le minimum qu'un futur contrôle sur site en aurait besoin. */
export type CarteSurvolee = {
  readonly interventionId: string;
  readonly dureeMin: number | null;
};

/**
 * CE QU'UNE CASE PORTE DÉJÀ, SANS AUCUNE REQUÊTE — construit une fois par
 * `app/(back-office)/planning/page.tsx` depuis les mêmes données qui
 * dessinent déjà la grille (`construireGrille`, `construireJournee`,
 * `etatFerieDuJour`), jamais recalculé ici.
 */
export type CaseSurvolee = {
  /** L'agenda de cette personne est-il bloqué ce jour-là (RG-PLA-06) ? */
  readonly bloquee: boolean;
  /**
   * Le jour est-il ouvert — pour cette personne (vue Semaine) ou pour
   * l'agence affichée (vue Jour, à l'heure de la case) ? `null` veut dire
   * « inconnu », jamais « fermé » (même convention que `CaseDeGrille.ouverte`) :
   * une case dont l'ouverture est inconnue reste `possible`.
   */
  readonly ouverte: boolean | null;
  /**
   * Le jour est-il un FÉRIÉ nommé (`jourParticulier`), par opposition à un
   * jour de fermeture hebdomadaire ordinaire ? Seule la vue Semaine porte
   * cette distinction jour par jour ; la vue Jour, qui n'affiche qu'un seul
   * jour à la fois, la porte une fois pour toute la grille.
   */
  readonly ferie: boolean;
};

export type DonneesChargeesPourSurvol = {
  /**
   * `true` si le site exige une habilitation que le technicien visé n'a pas,
   * `false` si les habilitations sont chargées et en règle, `null` si la
   * page ne les a pas chargées — voir l'entête. Toujours `null` aujourd'hui.
   */
  readonly habilitationManquante: boolean | null;
};

/**
 * L'ÉTAT D'UNE CASE SURVOLÉE — jamais une case regardée seule, toujours une
 * case regardée AVEC la carte qu'on est en train d'y déposer.
 *
 * Ordre des motifs : ABSENCE d'abord — même précédence que `classeDeCase`
 * (`app/(back-office)/planning/page.tsx`), où une agenda bloqué l'emporte sur
 * un jour fermé — puis FÉRIÉ, puis fermeture ordinaire, puis habilitation.
 */
export function etatDeLaCase(
  _carte: CarteSurvolee,
  caseVisee: CaseSurvolee,
  donneesChargees: DonneesChargeesPourSurvol,
): EtatDeSurvol {
  if (caseVisee.bloquee) {
    return { possible: false, motif: "absent" };
  }
  if (caseVisee.ferie) {
    return { possible: false, motif: "ferie" };
  }
  if (caseVisee.ouverte === false) {
    return { possible: false, motif: "agence_fermee" };
  }
  if (donneesChargees.habilitationManquante === true) {
    return { possible: false, motif: "habilitation_manquante" };
  }
  return { possible: true };
}

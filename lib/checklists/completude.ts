/**
 * LA COMPLÉTUDE D'UNE CHECKLIST (9K18-CHECKLIST-DOMAINE) — FONCTION PURE,
 * dont CK7 (9K23-CHECKLIST-BLOCAGE-TERMINER) se sert pour bloquer
 * « Terminer » sur `obligatoiresManquants`. Un NON CONFORME ne bloque PAS
 * « Terminer » PAR LE SEUL FAIT D'ÊTRE NON CONFORME (décision d'Alexis du
 * 29/10/2026, réponse « A » ; D235, D240) : ce module se contente de le
 * COMPTER, jamais de le juger sur ce seul critère.
 *
 * **AMENDEMENT D264 (16/11/2026, 9L08E) : un NON CONFORME SANS SUITE bloque
 * désormais, par un calcul SÉPARÉ.** `suitesNonConformesManquantes` nomme
 * chaque point non conforme dont `non_conformite_suite` reste vide — jamais
 * mêlé à `obligatoiresManquants`, qui garde son sens d'origine (un point
 * OBLIGATOIRE sans AUCUNE réponse). Un point non obligatoire, répondu non
 * conforme sans suite, entre dans cette seconde liste sans jamais entrer
 * dans la première.
 */

export type PointPourCompletude = {
  readonly id: string;
  readonly section: string;
  readonly libelle: string;
  readonly obligatoire: boolean;
};

/**
 * `nonConforme` est précalculé par l'APPELANT (le dépôt) à partir de
 * `valeur_conforme === 'non_conforme'` — cette fonction reste pure et ne
 * connaît ni les cinq types de réponse ni leurs colonnes. Même chose pour
 * `suiteDonnee`, précalculé depuis `non_conformite_suite !== null` (D264) —
 * ignoré tant que `nonConforme` est faux.
 */
export type ReponsePourCompletude = {
  readonly checklistPointId: string;
  readonly nonConforme: boolean;
  readonly suiteDonnee: boolean;
};

export type PointObligatoireManquant = {
  readonly id: string;
  readonly section: string;
  readonly libelle: string;
};

export type EtatCompletude = {
  readonly totalPoints: number;
  readonly pointsRepondus: number;
  readonly nonConformes: number;
  readonly obligatoiresManquants: readonly PointObligatoireManquant[];
  /** D264 — chaque point non conforme dont la suite à donner reste vide. */
  readonly suitesNonConformesManquantes: readonly PointObligatoireManquant[];
};

export function etatDeCompletude(
  points: readonly PointPourCompletude[],
  reponses: readonly ReponsePourCompletude[],
): EtatCompletude {
  const reponduParPoint = new Map(
    reponses.map((reponse) => [reponse.checklistPointId, reponse]),
  );

  const nonConformes = reponses.filter((reponse) => reponse.nonConforme).length;

  const obligatoiresManquants = points
    .filter((point) => point.obligatoire && !reponduParPoint.has(point.id))
    .map((point) => ({
      id: point.id,
      section: point.section,
      libelle: point.libelle,
    }));

  const suitesNonConformesManquantes = points
    .filter((point) => {
      const reponse = reponduParPoint.get(point.id);
      return reponse?.nonConforme === true && !reponse.suiteDonnee;
    })
    .map((point) => ({
      id: point.id,
      section: point.section,
      libelle: point.libelle,
    }));

  return {
    totalPoints: points.length,
    pointsRepondus: points.filter((point) => reponduParPoint.has(point.id))
      .length,
    nonConformes,
    obligatoiresManquants,
    suitesNonConformesManquantes,
  };
}

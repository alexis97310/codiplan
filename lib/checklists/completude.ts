/**
 * LA COMPLÉTUDE D'UNE CHECKLIST (9K18-CHECKLIST-DOMAINE) — FONCTION PURE,
 * dont CK7 (le blocage de « Terminer » sur un point obligatoire manquant,
 * hors territoire ici) se servira. Un NON CONFORME ne bloque JAMAIS
 * « Terminer » (décision d'Alexis du 29/10/2026, réponse « A » ; D235) : ce
 * module se contente de le COMPTER, jamais de le juger.
 */

export type PointPourCompletude = {
  readonly id: string;
  readonly libelle: string;
  readonly obligatoire: boolean;
};

/**
 * `nonConforme` est précalculé par l'APPELANT (le dépôt) à partir de
 * `valeur_conforme === 'non_conforme'` — cette fonction reste pure et ne
 * connaît ni les cinq types de réponse ni leurs colonnes.
 */
export type ReponsePourCompletude = {
  readonly checklistPointId: string;
  readonly nonConforme: boolean;
};

export type PointObligatoireManquant = {
  readonly id: string;
  readonly libelle: string;
};

export type EtatCompletude = {
  readonly totalPoints: number;
  readonly pointsRepondus: number;
  readonly nonConformes: number;
  readonly obligatoiresManquants: readonly PointObligatoireManquant[];
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
    .map((point) => ({ id: point.id, libelle: point.libelle }));

  return {
    totalPoints: points.length,
    pointsRepondus: points.filter((point) => reponduParPoint.has(point.id))
      .length,
    nonConformes,
    obligatoiresManquants,
  };
}

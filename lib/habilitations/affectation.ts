/**
 * RG-PLA-04 — L'AFFECTATION EST BLOQUÉE, ET NON SIGNALÉE (ticket L1-04 ; D9).
 *
 * > « L'affectation est **bloquée** si le site exige une habilitation marquée
 * > **bloquante** que le technicien n'a pas, ou dont la date d'expiration est
 * > antérieure à la date d'intervention. Une exigence non bloquante produit un
 * > **avertissement**. »
 *
 * Le ticket L1-04 disait « signalée » ; la règle dit « bloquée ». **La règle
 * l'emporte**, et D9 l'a écrit noir sur blanc en corrigeant le ticket.
 *
 * ## Pourquoi cette décision vit ici et non en base
 *
 * Elle dépend d'une **date d'intervention** que la base ne connaît pas — il n'y
 * a pas encore d'intervention, c'est le lot 2. Une contrainte qui prétendrait
 * décider sans cette date serait une garantie décorative. Ce que la base tient à
 * L1-04 est la DONNÉE ; ce module tient la RÈGLE, et le lot 2 les mettra
 * ensemble.
 *
 * ## La forme du verdict, et ce qu'elle refuse de faire
 *
 * Il rend les DEUX listes — ce qui bloque et ce qui avertit — plutôt qu'un
 * booléen. Un booléen aurait obligé l'appelant à refaire le tri pour afficher
 * un motif, et *un refus a le droit d'être lisible* (D50). Il ne construit
 * aucun message d'écran : les libellés vivent dans `lib/i18n/fr.ts`.
 */

/** Une exigence portée par le site, telle que la base la rend. */
export type ExigenceDuSite = {
  readonly habilitation_id: string;
  readonly bloquant: boolean;
};

/** Une habilitation détenue par le technicien, telle que la base la rend. */
export type HabilitationDetenue = {
  readonly habilitation_id: string;
  /** `null` = n'expire pas. Ce n'est PAS « expirée ». */
  readonly date_expiration: Date | null;
};

/** Pourquoi une exigence n'est pas satisfaite. */
export type MotifManquant = "absente" | "expiree";

/** Une exigence non satisfaite, et ce qui lui manque. */
export type ExigenceNonSatisfaite = {
  readonly habilitation_id: string;
  readonly motif: MotifManquant;
};

/** Le verdict de RG-PLA-04 sur une affectation. */
export type VerdictAffectation = {
  /** `true` si au moins une exigence BLOQUANTE n'est pas satisfaite. */
  readonly bloquee: boolean;
  /** Les exigences bloquantes non satisfaites — vide si l'affectation passe. */
  readonly bloquantes: readonly ExigenceNonSatisfaite[];
  /** Les exigences non bloquantes non satisfaites : un avertissement. */
  readonly avertissements: readonly ExigenceNonSatisfaite[];
};

/**
 * Une habilitation détenue est-elle valable À LA DATE D'INTERVENTION ?
 *
 * La comparaison porte sur le JOUR, pas sur l'instant : une habilitation qui
 * expire le jour de l'intervention est valable ce jour-là. La règle dit
 * « antérieure à la date d'intervention », et une date d'expiration égale ne
 * l'est pas.
 */
function valableLe(
  detenue: HabilitationDetenue,
  dateIntervention: Date,
): boolean {
  if (detenue.date_expiration === null) {
    return true;
  }
  return jour(detenue.date_expiration) >= jour(dateIntervention);
}

/** Le jour civil d'un instant, en UTC — les colonnes sont de type `DATE`. */
function jour(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Applique RG-PLA-04 à une affectation.
 *
 * @param exigences ce que le SITE exige.
 * @param detenues ce que le TECHNICIEN détient.
 * @param dateIntervention la date à laquelle l'intervention est posée.
 */
export function verdictAffectation(
  exigences: readonly ExigenceDuSite[],
  detenues: readonly HabilitationDetenue[],
  dateIntervention: Date,
): VerdictAffectation {
  const bloquantes: ExigenceNonSatisfaite[] = [];
  const avertissements: ExigenceNonSatisfaite[] = [];

  for (const exigence of exigences) {
    const detenue = detenues.find(
      (candidate) => candidate.habilitation_id === exigence.habilitation_id,
    );

    let motif: MotifManquant | null = null;
    if (detenue === undefined) {
      motif = "absente";
    } else if (!valableLe(detenue, dateIntervention)) {
      motif = "expiree";
    }

    if (motif === null) {
      continue;
    }

    const manquante: ExigenceNonSatisfaite = {
      habilitation_id: exigence.habilitation_id,
      motif,
    };
    if (exigence.bloquant) {
      bloquantes.push(manquante);
    } else {
      avertissements.push(manquante);
    }
  }

  return {
    bloquee: bloquantes.length > 0,
    bloquantes,
    avertissements,
  };
}

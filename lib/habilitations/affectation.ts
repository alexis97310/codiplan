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

/**
 * Une exigence portée par le site, telle que la base la rend.
 *
 * **Le CODE voyage avec l'identifiant** *(L3-02, D73)*. Il ne sert pas à la
 * règle — la comparaison porte sur l'identifiant et sur lui seul — mais au
 * REFUS, qui doit dire « habilitation BR absente » et jamais un UUID. *Le faire
 * résoudre par l'appelant après coup aurait été une seconde lecture d'un même
 * critère : il aurait fallu re-parcourir les exigences pour retrouver quel code
 * va avec quel identifiant, et deux parcours d'une même liste divergent en
 * silence le jour où l'un filtre* (§9, 01/09).
 */
export type ExigenceDuSite = {
  readonly habilitation_id: string;
  readonly code: string;
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

/**
 * Une exigence non satisfaite, et ce qui lui manque.
 *
 * **C'est une SOMME, pas un objet à champ facultatif** *(L3-02)*. D73 veut lire
 * « habilitation CACES **expirée le 12/08/2026** » : la date fait partie du
 * motif, elle ne l'accompagne pas. *Un `expiraitLe?: Date` aurait laissé écrire
 * une absence datée et une expiration sans date — deux états qui n'existent
 * pas, et que rien n'aurait refusés.* Ici le type les refuse à la compilation,
 * et c'est la même forme que la cible d'un document (lot 8, D87).
 *
 * C'est aussi D56 tenu à la lettre : *un nombre dont la signification dépend
 * d'une autre colonne ne voyage jamais seul.* Une date d'expiration seule ne
 * dit ni de quelle habilitation elle parle, ni qu'elle est dépassée.
 */
export type ExigenceNonSatisfaite =
  | {
      readonly habilitation_id: string;
      readonly code: string;
      readonly motif: "absente";
    }
  | {
      readonly habilitation_id: string;
      readonly code: string;
      readonly motif: "expiree";
      /** Le jour où elle a cessé d'être valable. Jamais `null` ici. */
      readonly expiraitLe: Date;
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
 * LE JOUR OÙ UNE HABILITATION DÉTENUE A CESSÉ D'ÊTRE VALABLE, ou `null` si elle
 * l'est encore à la date d'intervention.
 *
 * *Elle rendait un booléen, et l'appelant devait ensuite RETROUVER la date pour
 * la dire* — ce qui obligeait à affirmer au compilateur ce qu'elle seule
 * savait. **Rendre la date plutôt qu'un oui/non supprime l'affirmation** : le
 * type qui sort porte la preuve de ce qu'il avance, et il n'y a plus de
 * conversion forcée dans ce fichier.
 *
 * La comparaison porte sur le JOUR, pas sur l'instant : une habilitation qui
 * expire le jour de l'intervention est valable ce jour-là. La règle dit
 * « antérieure à la date d'intervention », et une date d'expiration égale ne
 * l'est pas.
 */
function expireeLe(
  detenue: HabilitationDetenue,
  dateIntervention: Date,
): Date | null {
  if (detenue.date_expiration === null) {
    // `NULL` ne veut pas dire « expirée » : une habilitation sans échéance
    // n'est jamais en retard.
    return null;
  }
  return jour(detenue.date_expiration) < jour(dateIntervention)
    ? detenue.date_expiration
    : null;
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

    const commune = {
      habilitation_id: exigence.habilitation_id,
      code: exigence.code,
    } as const;
    const expiree =
      detenue === undefined ? null : expireeLe(detenue, dateIntervention);

    let manquante: ExigenceNonSatisfaite | null = null;
    if (detenue === undefined) {
      manquante = { ...commune, motif: "absente" };
    } else if (expiree !== null) {
      manquante = { ...commune, motif: "expiree", expiraitLe: expiree };
    }

    if (manquante === null) {
      continue;
    }

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

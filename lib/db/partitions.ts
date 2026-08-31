/**
 * Les partitions du journal d'audit — DEUX contrôles, et ils ne disent pas la
 * même chose (ticket L0-10).
 *
 * Le journal est partitionné par mois dès sa création : la conservation se
 * réglera en DÉTACHANT des périodes, jamais en supprimant des lignes, si bien
 * qu'aucun rôle n'a jamais besoin de gagner `DELETE`. Un découpage mensuel doit
 * en revanche être ENTRETENU, et c'est là qu'il faut deux contrôles plutôt
 * qu'un.
 *
 * **Le PRÉVENTIF — reste-t-il assez de partitions devant ?** C'est le contrôle
 * d'horizon, exactement celui des jours fériés (D46, complément 3) : une
 * donnée datée se périme en silence, et une table partitionnée dont l'horizon
 * s'épuise ne dit rien tant qu'elle n'a pas été franchie.
 *
 * **Le DÉTECTIF — la partition par défaut est-elle vide ?** Et c'est le point
 * qui ne se déduit pas du premier. Le préventif protège du problème ; il ne
 * prouve pas qu'il ne s'est pas produit. Si une partition a manqué — parce que
 * le contrôle n'a pas tourné, parce qu'on a repoussé son échec, parce qu'une
 * ligne portait un horodatage inattendu —, l'écriture, elle, a RÉUSSI : la
 * partition par défaut l'a rattrapée, et rien d'autre ne s'en souvient. **Une
 * ligne rangée par défaut est la seule trace qui subsiste après coup.**
 *
 * Les deux sont donc indissociables, et pour la même raison qu'un test de refus
 * a besoin de son jumeau (CLAUDE.md §9) : une garantie qu'on ne peut pas
 * constater après coup n'est pas une garantie, c'est une intention.
 *
 * **Et le rattrapage n'est pas gratuit** : une fois qu'une ligne du mois M est
 * tombée par défaut, la partition de M ne peut PLUS être créée — PostgreSQL
 * refuse une partition dont la plage recouvre des lignes déjà rangées par
 * défaut. Il faut les déplacer à la main. Le détectif ne signale donc pas une
 * imperfection : il signale une réparation qui devient plus coûteuse chaque
 * jour.
 *
 * Ce module ne touche pas la base : il porte les comparaisons. `scripts/`
 * fournit la lecture, les tests unitaires l'exercent sur des états fabriqués.
 */

/**
 * Avance minimale exigée, en mois. Douze, comme l'horizon des jours fériés
 * (`MOIS_D_AVANCE_EXIGES`) et pour la même raison : c'est la profondeur à
 * laquelle on planifie, donc la distance à laquelle une écriture peut porter un
 * horodatage.
 */
export const MOIS_D_AVANCE_EXIGES_PARTITIONS = 12;

/** L'état des partitions du journal, tel que la base le rapporte. */
export type EtatPartitions = {
  /** Mois courant en UTC, clé `AAAA-MM`, lu sur l'horloge de la BASE. */
  moisCourant: string;
  /** Mois couverts par une partition mensuelle, clés `AAAA-MM` UTC, triées. */
  moisCouverts: readonly string[];
  /** La partition par défaut existe-t-elle ? */
  defautPresente: boolean;
  /** Lignes rangées dans la partition par défaut. */
  lignesParDefaut: number;
};

/** Rang absolu d'un mois `AAAA-MM`, pour compter sans arithmétique de dates. */
function rangDuMois(cle: string): number {
  const [annee, mois] = cle.split("-");
  return Number(annee) * 12 + (Number(mois) - 1);
}

/**
 * Nombre de mois CONSÉCUTIFS couverts à partir du mois courant, celui-ci
 * compris. Zéro si le mois courant lui-même n'est pas couvert.
 *
 * La consécutivité compte, et c'est délibéré : un trou au milieu de l'horizon
 * est pire qu'un horizon court, parce qu'il ne se voit pas dans un décompte.
 * Compter les partitions plutôt que la suite laisserait passer « treize
 * partitions, dont celle du mois prochain manque ».
 */
export function moisConsecutifsCouverts(etat: EtatPartitions): number {
  const rangs = new Set(etat.moisCouverts.map(rangDuMois));
  const depart = rangDuMois(etat.moisCourant);

  let couverts = 0;
  while (rangs.has(depart + couverts)) {
    couverts += 1;
  }
  return couverts;
}

/**
 * Contrôle PRÉVENTIF — reste-t-il assez de partitions devant ?
 *
 * Deux motifs d'échec, et le premier est le plus grave : le mois COURANT non
 * couvert signifie que les écritures d'aujourd'hui tombent déjà par défaut.
 */
export function ecartsHorizonPartitions(
  etat: EtatPartitions,
  moisExiges: number = MOIS_D_AVANCE_EXIGES_PARTITIONS,
): string[] {
  const couverts = moisConsecutifsCouverts(etat);

  if (couverts === 0) {
    return [
      `le mois courant (${etat.moisCourant}) n'est couvert par AUCUNE ` +
        "partition mensuelle : les écritures d'aujourd'hui tombent déjà dans " +
        "la partition par défaut, et la partition de ce mois ne pourra plus " +
        "être créée sans les déplacer. Exécuter `pnpm partitions:etendre`, " +
        "puis traiter les lignes déjà rangées par défaut.",
    ];
  }

  // `couverts` inclut le mois courant ; l'avance est ce qui vient APRÈS lui.
  const avance = couverts - 1;
  if (avance < moisExiges) {
    return [
      `l'horizon des partitions du journal d'audit ne couvre que ${avance} ` +
        `mois d'avance (${moisExiges} exigés) : le dernier mois couvert sans ` +
        `trou est ${dernierMoisCouvert(etat)}. Une partition manquante ne se ` +
        "signale que par la première ligne qui tombe par défaut, et cette " +
        "ligne-là interdit ensuite de créer la partition du mois concerné. " +
        "Exécuter `pnpm partitions:etendre`.",
    ];
  }

  return [];
}

/** Dernier mois de la suite ininterrompue, pour le message d'échec. */
export function dernierMoisCouvert(etat: EtatPartitions): string {
  const couverts = moisConsecutifsCouverts(etat);
  if (couverts === 0) {
    return "(aucun)";
  }
  const rang = rangDuMois(etat.moisCourant) + couverts - 1;
  const annee = Math.floor(rang / 12);
  const mois = (rang % 12) + 1;
  return `${annee}-${String(mois).padStart(2, "0")}`;
}

/**
 * Contrôle DÉTECTIF — la partition par défaut doit être VIDE.
 *
 * Son absence est un échec au même titre que son contenu, et pour la raison
 * inverse : sans elle, une écriture hors plage ne tomberait pas par défaut,
 * elle serait REFUSÉE — et comme le déclencheur d'audit s'exécute dans la
 * transaction de l'écriture métier, ce n'est pas le journal qui échouerait,
 * c'est l'intervention qu'on essayait de clôturer.
 */
export function ecartsPartitionDefaut(etat: EtatPartitions): string[] {
  if (!etat.defautPresente) {
    return [
      "le journal d'audit n'a PLUS de partition par défaut. Sans elle, une " +
        "écriture dont l'horodatage sort des partitions existantes est " +
        "refusée par PostgreSQL — et comme le déclencheur d'audit s'exécute " +
        "dans la transaction de l'écriture métier, c'est l'écriture métier " +
        "qui échoue. Le filet se remet, il ne se retire pas.",
    ];
  }

  if (etat.lignesParDefaut > 0) {
    return [
      `${etat.lignesParDefaut} ligne(s) d'audit sont rangées dans la ` +
        "partition PAR DÉFAUT du journal. C'est la preuve qu'une partition " +
        "mensuelle a manqué au moment de l'écriture : celle-ci a réussi, et " +
        "cette ligne est le seul signal qui en subsiste. Deux conséquences — " +
        "la partition du mois concerné ne peut PLUS être créée tant que ces " +
        "lignes y sont, et la conservation ne pourra pas les détacher avec " +
        "leur période. Les déplacer vers la partition de leur mois, puis " +
        "chercher pourquoi le contrôle préventif n'a pas mordu à temps.",
    ];
  }

  return [];
}

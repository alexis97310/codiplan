/**
 * LES RELEVÉS DE COMPTEUR, RÉORDONNÉS ET CONTRÔLÉS (L2-03 ; question 3.12).
 *
 * ## Ce que 3.12 tranche, et ce qu'elle laisse
 *
 * *« Réordonnés par `horodatage_terrain`, jamais par ordre d'arrivée. Le
 * contrôle de non-régression s'applique après réordonnancement. »*
 *
 * **L'ordre d'arrivée n'est pas l'ordre des faits**, et c'est tout l'objet : un
 * technicien relève un compteur à 8 h dans un atelier sans réseau, un autre à
 * 10 h dans un atelier couvert, et le second arrive le premier. *Contrôler dans
 * l'ordre d'arrivée signalerait une régression là où il n'y en a aucune — et
 * n'en verrait pas une là où elle est.*
 *
 * ## Ce que la question ne dit PAS, et qui est tranché ici
 *
 * Elle dit qu'un contrôle s'applique ; **elle ne dit pas ce qu'il fait d'un
 * relevé qui régresse.** Deux voies : le refuser, ou le conserver en le
 * signalant.
 *
 * **Il est CONSERVÉ et SIGNALÉ**, pour deux raisons qui se renforcent. D'abord
 * I5 : *le travail terrain n'est jamais perdu*, et un relevé est du travail
 * terrain. Ensuite le métier : **un compteur remplacé repart de zéro**, et
 * c'est un fait ordinaire en maintenance — *refuser la régression rendrait
 * impossible de saisir le premier relevé d'un compteur neuf, c'est-à-dire de
 * dire la vérité.*
 *
 * *Ce que cela coûte, nommé : une anomalie signalée réclame un œil. Refuser
 * aurait coûté la donnée elle-même, ce qui est pire et irréversible.*
 *
 * ## Ce module ne touche à aucune base
 *
 * Il reçoit des relevés et rend un verdict. *L'appelant seul sait sous quel
 * contexte cloisonné il les a lus*, et la synchronisation hors ligne (lot 3)
 * saura les lui donner dans le désordre.
 */

/** Ce qu'on relève : des heures, des cycles, des kilomètres (chapitre 11). */
export type TypeDeCompteur = "heures" | "cycles" | "km";

export type Releve = {
  readonly id: string;
  readonly machineId: string;
  readonly type: TypeDeCompteur;
  /** La valeur lue sur le compteur. Un entier : un compteur ne compte pas des moitiés. */
  readonly valeur: number;
  /**
   * **QUAND LE RELEVÉ A ÉTÉ FAIT**, sur le terrain — jamais quand il est arrivé
   * au serveur (3.12, 3.9). *C'est la seule date qui ordonne les faits.*
   */
  readonly horodatageTerrain: Date;
};

/** Ce qu'un relevé est, une fois les autres connus. */
export type VerdictReleve = {
  readonly id: string;
  /** `true` quand la valeur est inférieure à celle du relevé précédent du MÊME compteur. */
  readonly regression: boolean;
  /** La valeur précédente, quand il y en a une — *un écart se lit avec ses deux termes* (D56). */
  readonly precedente?: number;
};

/**
 * Ordonne les relevés par leur horodatage TERRAIN.
 *
 * **À horodatage égal, l'ordre est celui de l'identifiant**, et ce n'est pas un
 * détail : les identifiants sont des UUID v7 (I10), *donc ordonnés dans le temps
 * de leur création*. Deux relevés faits à la même seconde se départagent donc
 * par l'ordre où ils ont été saisis — le seul qui reste, et il est stable. *Un
 * tri instable rendrait le verdict dépendant de l'ordre d'arrivée, ce que 3.12
 * refuse précisément.*
 */
export function ordonnerParTerrain(
  releves: readonly Releve[],
): readonly Releve[] {
  return [...releves].sort((a, b) => {
    const ecart = a.horodatageTerrain.getTime() - b.horodatageTerrain.getTime();
    return ecart !== 0 ? ecart : a.id.localeCompare(b.id);
  });
}

/**
 * Le verdict de chaque relevé, APRÈS réordonnancement (3.12).
 *
 * **Chaque couple (machine, type) est une suite à part.** *Un compteur d'heures
 * et un compteur de cycles ne se comparent pas*, et deux machines encore moins —
 * les mélanger ferait de chaque nouvelle machine une régression.
 *
 * Le verdict est rendu **pour tous les relevés**, y compris ceux qui n'ont pas
 * de précédent : *un rapport qui ne rendrait que les anomalies laisserait son
 * lecteur incapable de distinguer « aucune anomalie » de « rien n'a été
 * contrôlé ».*
 */
export function verdictsDesReleves(
  releves: readonly Releve[],
): readonly VerdictReleve[] {
  const derniereValeur = new Map<string, number>();
  return ordonnerParTerrain(releves).map((releve) => {
    // Le séparateur est un caractère qu'aucun identifiant ne porte : sans lui,
    // deux suites distinctes pourraient composer la même clé.
    const suite = [releve.machineId, releve.type].join("|");
    const precedente = derniereValeur.get(suite);
    derniereValeur.set(suite, releve.valeur);
    return {
      id: releve.id,
      regression: precedente !== undefined && releve.valeur < precedente,
      ...(precedente === undefined ? {} : { precedente }),
    };
  });
}

/**
 * Les seuls relevés qui régressent — *une commodité de lecture, pas une seconde
 * règle* : elle DÉRIVE de `verdictsDesReleves` et ne recalcule rien.
 */
export function regressions(
  releves: readonly Releve[],
): readonly VerdictReleve[] {
  return verdictsDesReleves(releves).filter((verdict) => verdict.regression);
}

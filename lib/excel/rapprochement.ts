import { PREFIXE_SERIE_INCONNUE } from "@/lib/machines/saisie";

/**
 * LE RAPPROCHEMENT D'UN IMPORT — ce qu'une ligne DÉSIGNE, et ce qu'elle ne
 * désigne pas (ticket L1-08b, invariant I6).
 *
 * ## LE PRINCIPE QUI GOUVERNE TOUT CE FICHIER
 *
 * **Un import ne décide jamais seul.** Il propose, il compte, il montre ce
 * qu'il n'a pas su rattacher, et quelqu'un confirme. *Un import silencieux qui
 * « a bien marché » est un import dont personne ne sait ce qu'il a perdu.*
 *
 * Aucune fonction d'ici n'écrit, n'applique ni ne décide : elles CLASSENT, et
 * le rapport de I6 dit à un humain ce qu'elles ont classé.
 *
 * ## LES QUATRE CONTRAINTES SONT MESURÉES, JAMAIS SUPPOSÉES
 *
 * Elles viennent du fichier de suivi réel de l'exploitation, pas d'une
 * hypothèse sur ce qu'un fichier contient d'habitude :
 *
 * | Mesure | Ce qu'elle impose |
 * |---|---|
 * | 292 machines, **aucun numéro de série en double** | la série est une clé sûre *quand elle existe* |
 * | **4 %** sans série exploitable | la clé doit tolérer l'absence **sans fabriquer de doublon** |
 * | année de fabrication sur **96 / 292** | facultative, et son absence n'est pas une anomalie |
 * | **1 996** lignes d'historique, **72 % rattachées à aucune machine** | elles se reprennent **NON RATTACHÉES** |
 * | onglet Clients : **652 lignes** pour **55 codes réels** | une ligne de gabarit n'est ni une donnée ni un vide |
 *
 * *Écarter les 72 % perdrait les trois quarts de l'historique — c'est le point
 * sur lequel l'exploitation ne cède pas, et c'est pourquoi « non rattachée »
 * est une ISSUE et jamais un rejet.*
 */

/* ────────────────────────────────────────────────────────────────────────
 * 1. LA CLÉ DE RAPPROCHEMENT — et ce qu'elle refuse de fabriquer
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Ce qu'une ligne de parc porte pour se faire reconnaître.
 *
 * `reference` est la référence interne du fichier source — la colonne par
 * laquelle l'exploitation désigne une machine quand la plaque est illisible.
 * Elle n'est pas obligatoire : c'est justement le cas que la clé doit traiter.
 */
export type LigneDeParc = {
  readonly numeroSerie?: string;
  readonly reference?: string;
  /** Le rang de la ligne dans l'onglet. Sert de dernier recours, et il est DIT. */
  readonly rang: number;
};

export type CleDeRapprochement =
  | {
      /** La série existe et rapproche : c'est le cas des 96 % mesurés. */
      readonly forme: "serie";
      readonly cle: string;
      readonly complet: true;
    }
  | {
      /**
       * Pas de série exploitable, mais une référence interne : la fiche est
       * IDENTIFIABLE et INCOMPLÈTE. La clé porte le préfixe de D6/L2-01, si
       * bien qu'elle ne peut pas entrer en collision avec une vraie série.
       */
      readonly forme: "reference";
      readonly cle: string;
      readonly complet: false;
    }
  | {
      /**
       * Ni série ni référence. **La ligne reste UNE ligne** — elle ne se
       * confond avec aucune autre —, et la clé le dit en portant son rang.
       *
       * *C'est ici que la contrainte mord : deux lignes sans série ne sont pas
       * la même machine.* Une clé qui rendrait la même valeur pour toutes les
       * lignes muettes les fusionnerait, et l'import perdrait des machines en
       * silence — ce qui est pire que de les rejeter.
       */
      readonly forme: "rang";
      readonly cle: string;
      readonly complet: false;
    };

/** Le blanc, les tirets et les « n/a » de saisie ne sont pas une valeur. */
const RIEN = new Set(["", "-", "--", "n/a", "na", "nc", "?", "sans", "néant"]);

function utile(valeur: string | undefined): string | null {
  if (valeur === undefined) {
    return null;
  }
  const propre = valeur.trim();
  if (propre === "" || RIEN.has(propre.toLowerCase())) {
    return null;
  }
  return propre;
}

/**
 * LA CLÉ D'UNE LIGNE DE PARC — trois formes, et aucune ne se confond.
 *
 * **Les trois espaces de clés sont DISJOINTS par construction**, et c'est la
 * seule chose qui garantisse l'absence de doublon fabriqué : une série nue, une
 * référence préfixée par `SN-INCONNU-` (D6), un rang préfixé par `LIGNE-`. Une
 * série ne peut pas ressembler à un rang, un rang ne peut pas ressembler à une
 * référence. *Le prouver tient en une assertion ; l'espérer ne tient à rien.*
 *
 * **Et une série qui porte DÉJÀ le préfixe est traitée comme une référence** :
 * c'est ce qu'écrit une fiche saisie par le terrain (L2-01), et la relire comme
 * une série ferait passer une fiche incomplète pour une fiche complète.
 */
export function cleDeRapprochement(ligne: LigneDeParc): CleDeRapprochement {
  const serie = utile(ligne.numeroSerie);
  const reference = utile(ligne.reference);

  if (serie !== null && !serie.startsWith(PREFIXE_SERIE_INCONNUE)) {
    return { forme: "serie", cle: serie, complet: true };
  }

  // Une série déjà préfixée porte sa référence à l'intérieur : on la garde
  // telle quelle plutôt que de la recomposer, sinon deux passages du même
  // fichier produiraient deux clés différentes pour la même machine.
  if (serie !== null) {
    return { forme: "reference", cle: serie, complet: false };
  }

  if (reference !== null) {
    return {
      forme: "reference",
      cle: `${PREFIXE_SERIE_INCONNUE}${reference}`,
      complet: false,
    };
  }

  return { forme: "rang", cle: `LIGNE-${ligne.rang}`, complet: false };
}

/* ────────────────────────────────────────────────────────────────────────
 * 2. CE QU'UNE LIGNE EST — donnée, gabarit, ou vide
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * **652 lignes pour 55 codes réels** : l'onglet porte un gabarit étendu bien
 * au-delà de ce qu'il contient. Les 597 autres ne sont pas des rejets — ce
 * serait un rapport de 597 erreurs pour un fichier sain, c'est-à-dire la panne
 * par le bruit (§9, 11/09) —, et ce ne sont pas non plus des données.
 */
export type NatureDeLigne = "donnee" | "gabarit" | "vide";

/**
 * Une ligne est-elle une donnée, un reste de gabarit, ou rien ?
 *
 * **La distinction ne se devine pas d'un décompte de cellules vides**, et c'est
 * le piège : une ligne de données mal remplie ressemble à un gabarit. Ce qui
 * décide est la présence d'au moins une valeur dans les colonnes qui
 * IDENTIFIENT — celles sans lesquelles la ligne ne désigne rien.
 *
 * - au moins une colonne identifiante remplie → **donnée**, même incomplète ;
 * - aucune identifiante, mais quelque chose ailleurs → **gabarit** : une
 *   formule recopiée, une unité, un reste de mise en forme ;
 * - rien nulle part → **vide**.
 *
 * *Le gabarit et le vide se comptent séparément parce qu'ils ne se corrigent
 * pas pareil : l'un est un modèle trop étendu, l'autre n'est rien. Et les
 * confondre reviendrait à ne plus savoir si un fichier est court ou mal rempli.*
 */
export function natureDeLigne(
  ligne: Readonly<Record<string, string | undefined>>,
  colonnesIdentifiantes: readonly string[],
): NatureDeLigne {
  const identifiante = colonnesIdentifiantes.some(
    (colonne) => utile(ligne[colonne]) !== null,
  );
  if (identifiante) {
    return "donnee";
  }
  const quelqueChose = Object.values(ligne).some(
    (valeur) => utile(valeur) !== null,
  );
  return quelqueChose ? "gabarit" : "vide";
}

/* ────────────────────────────────────────────────────────────────────────
 * 3. L'HISTORIQUE — 72 % ne se rattachent à rien, et se reprennent quand même
 * ──────────────────────────────────────────────────────────────────────── */

export type IssueDeRattachement =
  | { readonly issue: "rattachee"; readonly cle: string }
  | {
      /**
       * **Reprise, et NON rattachée.** Ce n'est ni un rejet ni une erreur :
       * c'est l'état de 72 % des 1 996 lignes d'historique mesurées. *Les
       * écarter perdrait les trois quarts de l'historique.*
       */
      readonly issue: "non_rattachee";
      /** Ce que la ligne portait, pour que le rapport puisse le montrer. */
      readonly designation: string | null;
    };

/**
 * Rattache une ligne d'historique à une machine connue, ou dit qu'elle ne l'est
 * pas — et ne la rejette JAMAIS.
 *
 * **Le rapprochement se fait sur la clé, pas sur un texte approchant.** Une
 * ressemblance produirait des rattachements faux, et un rattachement faux est
 * pire qu'une absence de rattachement : il attribue une facture à la mauvaise
 * machine, et plus personne ne saura que c'était un rapprochement automatique.
 * *Le rapprochement assisté — celui qui PROPOSE et qu'un humain confirme — est
 * un geste d'écran, pas une fonction de cette couche.*
 */
export function rattacherAuParc(
  designationDeLaMachine: string | undefined,
  clesConnues: ReadonlySet<string>,
): IssueDeRattachement {
  const designation = utile(designationDeLaMachine);
  if (designation !== null && clesConnues.has(designation)) {
    return { issue: "rattachee", cle: designation };
  }
  return { issue: "non_rattachee", designation };
}

/* ────────────────────────────────────────────────────────────────────────
 * 4. LE DÉCOMPTE — ce que le rapport de I6 montre avant qu'on applique
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Ce qu'un import PROPOSE, avant toute écriture (I6, RG-IMP-01).
 *
 * **Chaque nombre a un nom, et « non rattaché » en est un.** Le ranger sous
 * « rejeté » ou l'omettre ferait disparaître les trois quarts de l'historique
 * d'un rapport qui aurait l'air complet — le §9 du 06/09 exactement : *un
 * chiffre juste, dans un rapport vrai, qui fait conclure faux.*
 */
export type Proposition = {
  readonly creations: number;
  readonly modifications: number;
  /** Rejetées AVEC leur motif : ce sont les seules qui n'entreront pas. */
  readonly rejets: number;
  /** Reprises SANS rattachement. Elles entrent — c'est tout le point. */
  readonly nonRattachees: number;
  /** Lignes de gabarit, comptées et NON rejetées. */
  readonly gabarits: number;
  readonly vides: number;
  /**
   * Les fiches qui entreront INCOMPLÈTES — série illisible ou absente. Elles
   * alimentent la file de complétion de L2-01, elles ne sont pas un défaut.
   */
  readonly incompletes: number;
};

/** Une proposition à zéro, pour être remplie sans qu'aucun champ s'oublie. */
export function propositionVide(): Proposition {
  return {
    creations: 0,
    modifications: 0,
    rejets: 0,
    nonRattachees: 0,
    gabarits: 0,
    vides: 0,
    incompletes: 0,
  };
}

/**
 * Le total des lignes que la proposition explique.
 *
 * **Ce n'est pas un ornement : c'est le TÉMOIN du rapport.** Un import qui
 * n'expliquerait pas chaque ligne du fichier en aurait perdu sans le dire, et
 * *un décompte nul ressemble toujours à un sans-faute* (§9, 30/08). L'appelant
 * compare ce total au nombre de lignes lues ; l'écart est un écart.
 *
 * `nonRattachees` et `incompletes` ne sont **pas** additionnées : ce sont des
 * QUALIFICATIONS de lignes déjà comptées ailleurs, pas des catégories de plus.
 * *Les additionner ferait un total supérieur au fichier, et le témoin dirait
 * faux dans le sens rassurant.*
 */
export function lignesExpliquees(proposition: Proposition): number {
  return (
    proposition.creations +
    proposition.modifications +
    proposition.rejets +
    proposition.gabarits +
    proposition.vides
  );
}

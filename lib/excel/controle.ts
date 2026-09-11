import { type FeuilleLue } from "./classeur";
import {
  analyserMarqueur,
  apparierColonnes,
  codeDuMarqueur,
  type Anomalie,
  type Appariement,
  type Cellule,
  type ColonneAttendue,
  type Marqueur,
} from "./format";
import {
  cleDeClient,
  cleDeRapprochement,
  type CleDeRapprochement,
  lignesExpliquees,
  natureDeLigne,
  propositionVide,
  type NatureDeLigne,
  type Proposition,
} from "./rapprochement";

/**
 * LE CONTRÔLE PRÉALABLE D'UN IMPORT (ticket L1-08c ; I6, RG-IMP-01, D31, D90).
 *
 * ## CE QUE CE MODULE EST, ET LA MOITIÉ QU'IL N'EST PAS
 *
 * I6 : *« Un import Excel produit d'abord un rapport — créations, modifications,
 * rejets motivés —, puis attend une validation explicite. »* **Ce module est le
 * "d'abord". Il n'écrit RIEN, il ne connaît aucune base, et il ne sait pas
 * appliquer.** L'application et l'annulation viennent avec le journal des lots,
 * et le journal des lots viendra avec l'écran qui le lit.
 *
 * C'est aussi ce qui donne enfin un APPELANT à la liaison au classeur : *une
 * suite qui éprouve tous les maillons n'éprouve pas la chaîne* (§9, 08/09), et
 * la chaîne est ici classeur → grammaire → rapprochement → rapport.
 *
 * ## L'ORDRE DES REFUS N'EST PAS INDIFFÉRENT
 *
 * Trois refus **précèdent toute ligne**, et c'est délibéré : le marqueur de
 * version, l'en-tête en double, la colonne obligatoire absente. *« Ce n'est pas
 * une ligne qui manque, c'est le fichier qui n'est pas celui qu'on croit »* —
 * le signaler ligne à ligne produirait trois cents rejets identiques là où une
 * phrase suffit. Le rapport s'arrête donc là, avec sa raison, et ne compte rien.
 *
 * ## LE TOTAL EXPLIQUE CHAQUE LIGNE LUE, ET C'EST LE TÉMOIN
 *
 * `lignesExpliquees` compare le rapport au nombre de lignes réellement
 * parcourues. **Un import qui n'expliquerait pas chaque ligne du fichier en
 * aurait perdu sans le dire**, et un décompte nul ressemble toujours à un
 * sans-faute (§9, 30/08). L'écart est rendu, pas tu.
 *
 * ## CE QUI N'EST PAS ICI, ET NE DOIT PAS Y ÊTRE
 *
 * **Le rapprochement assisté** — celui qui PROPOSE un rattachement qu'un humain
 * confirme. Il est un geste d'écran ; ici le rapprochement se fait sur la CLÉ et
 * jamais sur une ressemblance, *un rattachement faux étant pire qu'une absence
 * de rattachement*.
 */

/** Où le modèle d'import place ses trois lignes de tête (D31). */
export const LIGNE_MARQUEUR = 0;
export const LIGNE_ENTETES = 1;
export const PREMIERE_LIGNE_DONNEES = 2;

/** Ce qu'un type d'import attend d'une feuille. */
export type ModeleDImport = {
  /** Le type porté par le marqueur `CODIPLAN-<type>-v<n>` (D31). */
  readonly type: string;
  /** La version que ce code sait lire. */
  readonly version: number;
  readonly colonnes: readonly ColonneAttendue[];
  /**
   * Les colonnes sans lesquelles une ligne ne DÉSIGNE rien. Elles décident de
   * la nature d'une ligne — donnée, gabarit ou vide —, et elles ne se
   * confondent pas avec les colonnes obligatoires : *une ligne de données mal
   * remplie ressemble à un gabarit, et c'est le piège.*
   */
  readonly identifiantes: readonly string[];
  /**
   * CE QU'UNE LIGNE DÉSIGNE — et **c'est le MODÈLE qui le dit**, jamais le
   * contrôle (L1-08f).
   *
   * *Mesuré avant d'être réparé* : le contrôle calculait lui-même la clé des
   * MACHINES — série, référence, rang — pour tout type d'import. Sur un modèle
   * « clients », qui n'a ni série ni référence, toutes les lignes tombaient
   * donc sur la clé de dernier recours `LIGNE-<rang>` et **toutes étaient des
   * CRÉATIONS** : mesuré sur deux clients que le parc connaissait déjà, clés
   * rendues `LIGNE-3` et `LIGNE-4`, *2 créations, 0 modification*. Un second
   * import du même fichier aurait créé autant de doublons — c'est-à-dire
   * exactement ce que RG-IMP-05 interdit.
   *
   * **Aucun défaut n'est prévu, et c'est délibéré** : un modèle qui oublierait
   * de dire ce qu'il désigne recevrait la clé des machines en silence, ce qui
   * est la faute qu'on vient de retirer. *Sans défaut, l'oubli ne compile pas.*
   */
  readonly cle: CleDeLigne;
};

/**
 * La fonction qui dit ce qu'une ligne désigne, pour un type d'import donné.
 * `rang` est celui qu'un humain lit dans le tableur (1 = première ligne) : la
 * clé de dernier recours le porte, et elle doit désigner la même ligne que le
 * rapport.
 */
export type CleDeLigne = (
  valeurs: Readonly<Record<string, string | undefined>>,
  rang: number,
) => CleDeRapprochement;

/**
 * LA CLÉ DES MACHINES, telle qu'elle était calculée dans le contrôle — série,
 * référence, rang (L1-08c). Elle n'a pas changé d'un caractère : *elle a
 * changé de MAIN*, du contrôle vers le modèle qui la réclame.
 */
export function cleMachineDepuis(
  colonneSerie?: string,
  colonneReference?: string,
): CleDeLigne {
  return (valeurs, rang) =>
    cleDeRapprochement({
      numeroSerie:
        colonneSerie === undefined ? undefined : valeurs[colonneSerie],
      reference:
        colonneReference === undefined ? undefined : valeurs[colonneReference],
      rang,
    });
}

/**
 * LA CLÉ DES CLIENTS — RG-IMP-05 : le **code externe** s'il existe, à défaut la
 * **raison sociale normalisée** (D29).
 */
export function cleClientDepuis(
  colonneCodeExterne: string,
  colonneRaisonSociale: string,
): CleDeLigne {
  return (valeurs, rang) =>
    cleDeClient({
      codeExterne: valeurs[colonneCodeExterne],
      raisonSociale: valeurs[colonneRaisonSociale],
      rang,
    });
}

/** Une anomalie SITUÉE — le rapport doit pouvoir montrer où. */
export type AnomalieSituee = Anomalie & {
  /** Le rang de la ligne dans la feuille, tel qu'un humain le lit (1 = A1). */
  readonly ligne: number;
  readonly colonne?: string;
};

/**
 * CE QU'UNE LIGNE DE DONNÉES A ÉTÉ DÉCIDÉE — et ce que le rapport RETIENT.
 *
 * ## Pourquoi cela n'existait pas, et ce que cela coûtait
 *
 * *Mesuré le 11/09/2026 : le contrôle décidait ligne à ligne — nature, clé,
 * création ou modification — puis **jetait tout** et ne rendait que des
 * décomptes.* I6 veut qu'un import « produise d'abord un rapport, puis attende
 * une validation explicite » : **l'application ne peut appliquer que ce que le
 * rapport a montré**, et un rapport qui ne retient rien ne peut rien faire
 * appliquer. Le chapitre 11 le dit d'ailleurs par la bande — `import_lot.statut`
 * vaut `controle`, `applique` ou `annule` : le lot EXISTE dès le contrôle.
 *
 * ## Et cela retire une divergence plutôt que d'en ajouter une
 *
 * Les décomptes étaient incrémentés **à côté** des décisions, dans la même
 * boucle : deux lectures d'un même critère, qui divergent en silence (§9,
 * 01/09). Ils sont désormais **DÉRIVÉS** des lignes retenues — la décision est
 * prise une fois, et le rapport la compte. *Un décompte qui ne peut plus
 * contredire ce qu'il compte n'est plus un décompte à surveiller.*
 */
export type LigneControlee = {
  /** Le rang tel qu'un humain le lit (1 = première ligne de la feuille). */
  readonly rang: number;
  readonly nature: NatureDeLigne;
  /**
   * Ce que la ligne DÉSIGNE, quand elle désigne quelque chose. Absente pour un
   * gabarit et pour une ligne vide : *ils ne désignent rien, et leur inventer
   * une clé les ferait entrer dans l'espace des clés réelles.*
   */
  readonly cle?: CleDeRapprochement;
  /** Ce que l'application fera de cette ligne — le mot du chapitre 11. */
  readonly action: "creation" | "modification" | "gabarit" | "vide" | "rejet";
  /**
   * LA RAISON DU REJET, et elle est OBLIGATOIRE dès que l'action l'est — la
   * base tient la même équivalence, dans les deux sens (L1-08e).
   *
   * *Un rejet sans motif est un rejet que personne ne pourra rejuger*, et un
   * motif sans rejet est une ligne qu'on croit refusée alors qu'elle passera.
   */
  readonly rejetMotif?: string;
  /**
   * La ligne, colonne par colonne, telle qu'elle a été lue. **C'est ce que
   * l'application écrira**, et c'est aussi ce qu'un rapport annoté doit pouvoir
   * remontrer (RG-IMP-03).
   */
  readonly valeurs: Readonly<Record<string, string | undefined>>;
};

/**
 * CE QUE LA BASE CONNAÎT DÉJÀ, et ce qu'elle ne sait pas trancher (L1-08g).
 *
 * **Deux ensembles et non un seul**, parce que RG-IMP-05 pose trois cas et non
 * deux : *« en cas d'ambiguïté, la ligne part en rejet pour arbitrage humain
 * plutôt qu'en création silencieuse d'un doublon »*. Un `Set<string>` nu ne
 * pouvait pas porter le troisième — la limite était écrite à L1-08f, et c'est
 * elle que ce type retire.
 *
 * **Aucun défaut n'est prévu pour `ambigues`.** Un appelant qui ne sait pas
 * répondre doit le dire en passant un ensemble vide, et c'est une affirmation :
 * *« ce parc ne porte aucune ambiguïté »*. Un défaut ferait de cette
 * affirmation un oubli, et l'oubli retomberait du côté permissif — une création
 * silencieuse là où RG-IMP-05 veut un rejet.
 */
export type ParcConnu = {
  /** Les clés que la base porte déjà : une ligne qui les touche MODIFIE. */
  readonly cles: ReadonlySet<string>;
  /**
   * Les clés que PLUSIEURS fiches du parc se partagent. *L'ambiguïté est un
   * fait du parc, jamais du fichier* : deux clients de même raison sociale
   * normalisée rendent indécidable ce qu'une ligne désigne.
   */
  readonly ambigues: ReadonlySet<string>;
};

/**
 * Ce que le parc dit d'une clé — et le rejet PRÉCÈDE les deux autres cas.
 *
 * *L'ordre est une décision* : une clé ambiguë est aussi une clé connue, et
 * tester « connue » d'abord la rendrait modifiable — c'est-à-dire écraserait
 * l'une des deux fiches au hasard, ce que RG-IMP-05 refuse précisément.
 */
function decider(
  cle: string,
  parc: ParcConnu,
): Pick<LigneControlee, "action" | "rejetMotif"> {
  if (parc.ambigues.has(cle)) {
    return { action: "rejet", rejetMotif: MOTIF_AMBIGUITE };
  }
  return { action: parc.cles.has(cle) ? "modification" : "creation" };
}

/**
 * Le motif d'un rejet pour ambiguïté. C'est un CODE, jamais du texte : les
 * libellés sont au dictionnaire, la coupure de L0-11 s'appliquant au rapport
 * qu'un humain lit.
 */
export const MOTIF_AMBIGUITE = "cle_ambigue";

/** Les décomptes, DÉRIVÉS des lignes retenues — jamais comptés à côté d'elles. */
export function proposerDepuisLesLignes(
  lignes: readonly LigneControlee[],
): Proposition {
  let proposition = propositionVide();
  for (const ligne of lignes) {
    switch (ligne.action) {
      case "vide":
        proposition = { ...proposition, vides: proposition.vides + 1 };
        break;
      case "gabarit":
        // **Comptées et NON rejetées.** 652 lignes pour 55 codes réels sur
        // l'onglet Clients : les rejeter ferait 597 erreurs sur un fichier sain.
        proposition = { ...proposition, gabarits: proposition.gabarits + 1 };
        break;
      case "rejet":
        // **Le rejet S'ADDITIONNE** — il n'est pas une qualification comme
        // `incompletes` : une ligne rejetée n'entrera pas, et le total doit
        // continuer d'expliquer chaque ligne lue.
        proposition = { ...proposition, rejets: proposition.rejets + 1 };
        break;
      default:
        proposition = {
          ...proposition,
          creations:
            proposition.creations + (ligne.action === "creation" ? 1 : 0),
          modifications:
            proposition.modifications +
            (ligne.action === "modification" ? 1 : 0),
          // **`incompletes` QUALIFIE une ligne déjà comptée** — elle ne s'ajoute
          // pas au total. Les additionner ferait un total supérieur au fichier,
          // et le témoin dirait faux dans le sens rassurant.
          incompletes:
            proposition.incompletes + (ligne.cle?.complet === false ? 1 : 0),
        };
    }
  }
  return proposition;
}

/** Ce que le contrôle rend, et il rend TOUJOURS l'une des deux formes. */
export type Controle =
  | {
      /** Le fichier n'est pas lisible : rien n'a été compté, et c'est dit. */
      readonly lisible: false;
      readonly anomalies: readonly AnomalieSituee[];
    }
  | {
      readonly lisible: true;
      readonly proposition: Proposition;
      /**
       * LES LIGNES RETENUES, dans l'ordre du fichier. C'est ce que
       * l'application appliquera : *elle ne peut appliquer que ce que le
       * rapport a montré* (I6).
       */
      readonly lignes: readonly LigneControlee[];
      /** Les colonnes du fichier que le modèle ignore — AVERTISSEMENT (D31). */
      readonly inconnues: readonly string[];
      readonly anomalies: readonly AnomalieSituee[];
      /** Les lignes réellement parcourues, pour confronter le total. */
      readonly lignesLues: number;
      /**
       * Le TÉMOIN : le total du rapport explique-t-il chaque ligne lue ?
       * Un `false` ici est un défaut de ce module, jamais du fichier.
       */
      readonly totalExplique: boolean;
    };

/** Le texte d'une cellule, élagué, ou `undefined`. */
function texte(cellule: Cellule | undefined): string | undefined {
  const brut = cellule?.texte?.trim();
  if (brut !== undefined && brut !== "") {
    return brut;
  }
  // Un nombre saisi dans une colonne d'identification — un numéro de série
  // purement numérique — est une valeur, pas un vide. Le rendre sous sa forme
  // textuelle est la seule lecture possible ici ; la grammaire ne prétend pas
  // savoir si l'auteur voulait un nombre.
  return cellule?.nombre === undefined ? undefined : String(cellule.nombre);
}

/** La ligne, en dictionnaire nom de colonne → texte. */
function enDictionnaire(
  cellules: readonly (Cellule | undefined)[],
  appariement: Appariement,
): Record<string, string | undefined> {
  const dictionnaire: Record<string, string | undefined> = {};
  for (const [nom, indice] of appariement.indices) {
    dictionnaire[nom] = texte(cellules[indice]);
  }
  return dictionnaire;
}

/**
 * Contrôle une feuille contre un modèle d'import, et rend le rapport de I6.
 *
 * `parc` est ce que la base connaît déjà : une clé qui s'y trouve est une
 * MODIFICATION, une clé absente est une CRÉATION, **une clé AMBIGUË est un
 * REJET** (RG-IMP-05). **Le parc est un paramètre et non une lecture** — ce
 * module ne touche à aucune base, et l'appelant seul sait sous quel contexte
 * cloisonné il l'a obtenu.
 */
export function controlerFeuille(
  feuille: FeuilleLue,
  modele: ModeleDImport,
  parc: ParcConnu,
): Controle {
  const anomalies: AnomalieSituee[] = [];

  // ── 1. LE MARQUEUR, avant tout le reste (D31) ────────────────────────────
  const marqueur: Marqueur = analyserMarqueur(
    feuille.lignes[LIGNE_MARQUEUR]?.[0],
    { type: modele.type, version: modele.version },
  );
  const codeMarqueur = codeDuMarqueur(marqueur);
  if (codeMarqueur !== null) {
    return {
      lisible: false,
      anomalies: [
        {
          code: codeMarqueur,
          // Ce que la cellule portait, quand le marqueur le sait — le rapport
          // doit pouvoir le montrer, et « illisible » sans la valeur illisible
          // n'aide personne à corriger son fichier.
          ...valeurDuMarqueur(marqueur),
          ligne: LIGNE_MARQUEUR + 1,
        },
      ],
    };
  }

  // ── 2. LES EN-TÊTES ──────────────────────────────────────────────────────
  const appariement = apparierColonnes(
    feuille.lignes[LIGNE_ENTETES] ?? [],
    modele.colonnes,
  );
  if (appariement.anomalies.length > 0) {
    // *« Ce n'est pas une ligne qui manque, c'est le fichier qui n'est pas celui
    // qu'on croit »* : on s'arrête, et on ne compte AUCUNE ligne. Un rapport qui
    // compterait des créations sous une colonne obligatoire absente proposerait
    // d'écrire des fiches amputées.
    return {
      lisible: false,
      anomalies: appariement.anomalies.map((anomalie) => ({
        ...anomalie,
        ligne: LIGNE_ENTETES + 1,
      })),
    };
  }

  // ── 3. LES LIGNES ────────────────────────────────────────────────────────
  //
  // La décision est prise UNE FOIS et RETENUE ; les décomptes en sont dérivés.
  // *Les incrémenter à côté serait une seconde lecture d'un même critère.*
  const lignes: LigneControlee[] = [];

  for (
    let rang = PREMIERE_LIGNE_DONNEES;
    rang < feuille.lignes.length;
    rang += 1
  ) {
    const cellules = feuille.lignes[rang] ?? [];
    const valeurs = enDictionnaire(cellules, appariement);
    const nature: NatureDeLigne = natureDeLigne(valeurs, modele.identifiantes);

    if (nature === "vide" || nature === "gabarit") {
      // Ni l'une ni l'autre ne DÉSIGNE quoi que ce soit : leur inventer une clé
      // les ferait entrer dans l'espace des clés réelles.
      lignes.push({ rang: rang + 1, nature, action: nature, valeurs });
      continue;
    }

    // **C'est le MODÈLE qui dit ce que la ligne désigne** (L1-08f). Le rang
    // passé est celui qu'un humain lit : la clé de dernier recours le porte, et
    // il doit désigner la même ligne dans le rapport.
    const cle = modele.cle(valeurs, rang + 1);

    lignes.push({
      rang: rang + 1,
      nature,
      cle,
      ...decider(cle.cle, parc),
      valeurs,
    });
  }

  const proposition = proposerDepuisLesLignes(lignes);
  return {
    lisible: true,
    proposition,
    lignes,
    inconnues: appariement.inconnues,
    anomalies,
    // *Les lignes RETENUES sont les lignes LUES* : la boucle en pousse une par
    // rang parcouru, gabarits et vides compris. Le témoin ci-dessous cesse donc
    // de pouvoir mentir par omission — il ne peut plus rougir que si les
    // décomptes s'écartent des lignes, ce qui est le défaut qu'il surveille.
    lignesLues: lignes.length,
    totalExplique: lignesExpliquees(proposition) === lignes.length,
  };
}

/**
 * Ce que le marqueur portait, quand son état le sait.
 *
 * **Les quatre refus de D31 sont DISTINCTS, et ce qu'ils savent l'est aussi** :
 * « illisible » connaît le texte trouvé, « autre type » connaît le type,
 * « version antérieure » et « postérieure » connaissent le numéro. « Absent »
 * ne connaît rien, et lui inventer une valeur vide ferait croire à une cellule
 * lue là où il n'y avait pas de cellule.
 */
function valeurDuMarqueur(marqueur: Marqueur): { valeur?: string } {
  switch (marqueur.etat) {
    case "illisible":
      return { valeur: marqueur.valeur };
    case "autre_type":
      return { valeur: marqueur.type };
    case "version_anterieure":
    case "version_posterieure":
      return { valeur: String(marqueur.version) };
    default:
      return {};
  }
}

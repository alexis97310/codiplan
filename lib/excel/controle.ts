import { type FeuilleLue } from "./classeur";
import {
  analyserMarqueur,
  apparierColonnes,
  codeDuMarqueur,
  lireDate,
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
  /**
   * CE QUE LA SAISIE REFUSERAIT — et **le rapport doit le montrer AVANT** que
   * quelqu'un valide (L1-08h).
   *
   * I6 veut qu'un import « produise d'abord un rapport, PUIS attende une
   * validation explicite ». *Une ligne que la saisie refusera et que le rapport
   * annonce en création est un rapport qui ment* : on valide 300 créations, on
   * en obtient 297, et les trois manquantes ne se découvrent qu'après coup.
   *
   * Elle rend un **CODE** de motif, ou `null` si la ligne passe. Jamais du
   * texte : les libellés sont au dictionnaire (L0-11).
   *
   * **Facultative, et c'est la seule des deux à l'être** : un modèle peut
   * n'avoir aucune règle de saisie au-delà de sa grammaire, et l'absence est
   * alors une affirmation lisible — *« rien de plus à vérifier »*. La clé, elle,
   * ne peut pas manquer : il n'existe pas d'import sans rapprochement.
   */
  readonly valider?: ValidationDeLigne;
};

/**
 * Ce qu'une ligne doit satisfaire au-delà de la grammaire. Rend le CODE du
 * motif de rejet, ou `null` quand la ligne passe.
 */
export type ValidationDeLigne = (
  valeurs: Readonly<Record<string, string | undefined>>,
  /**
   * LE RANG, TEL QU'UN HUMAIN LE LIT — celui-là même que `cle` reçoit (R6-03).
   *
   * **Il est passé pour que la validation puisse appeler la CLÉ**, et non pour
   * en faire quoi que ce soit d'autre. *Le gabarit des équipements décide du
   * numéro de série d'après la FORME de la clé* — série, référence préfixée, ou
   * rang de dernier recours —, et recalculer cette clé sous un rang inventé
   * ferait deux lectures d'un même critère (§9, 01/09).
   *
   * Les cinq validations écrites avant lui l'ignorent, et c'est sans
   * conséquence : *un paramètre ajouté en queue ne change rien pour qui ne le
   * nomme pas.*
   */
  rang: number,
) => string | null;

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
 * Ce que le parc dit d'une clé — et les rejets PRÉCÈDENT les deux autres cas.
 *
 * *L'ordre est une décision* : une clé ambiguë est aussi une clé connue, et
 * tester « connue » d'abord la rendrait modifiable — c'est-à-dire écraserait
 * l'une des deux fiches au hasard, ce que RG-IMP-05 refuse précisément.
 *
 * **Le doublon DE FICHIER passe avant l'ambiguïté DU PARC** (point 4b,
 * 16/09/2026) : il se constate sans consulter la base, et sa correction n'est
 * pas la même — *« dans le fichier » n'est pas « dans le parc »*, exactement
 * la distinction que le point 2 de cette même session a fait mordre sur
 * `parent_introuvable`. Les confondre enverrait, une fois de plus, chercher au
 * mauvais endroit.
 */
function decider(
  cle: string,
  parc: ParcConnu,
  motifDeSaisie: string | null,
  dansLeFichier: boolean,
): Pick<LigneControlee, "action" | "rejetMotif"> {
  if (dansLeFichier) {
    return { action: "rejet", rejetMotif: MOTIF_DOUBLON_FICHIER };
  }
  if (parc.ambigues.has(cle)) {
    return { action: "rejet", rejetMotif: MOTIF_AMBIGUITE };
  }
  // *L'ambiguïté passe AVANT la saisie*, et l'ordre se lit : une ligne
  // indécidable ne vaut pas la peine d'être validée, et rendre le motif de
  // saisie ferait chercher une correction dans le fichier là où le problème est
  // dans le parc.
  if (motifDeSaisie !== null) {
    return { action: "rejet", rejetMotif: motifDeSaisie };
  }
  return { action: parc.cles.has(cle) ? "modification" : "creation" };
}

/**
 * Le motif d'un rejet pour ambiguïté. C'est un CODE, jamais du texte : les
 * libellés sont au dictionnaire, la coupure de L0-11 s'appliquant au rapport
 * qu'un humain lit.
 */
export const MOTIF_AMBIGUITE = "cle_ambigue";

/**
 * Le motif d'un rejet pour DOUBLON DE FICHIER — deux lignes du MÊME classeur
 * qui désignent la même fiche, avant même que le parc en soit consulté.
 * Distinct de `MOTIF_AMBIGUITE` pour la raison écrite au-dessus de `decider`.
 */
export const MOTIF_DOUBLON_FICHIER = "doublon_fichier";

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
  if (cellule?.nombre !== undefined) {
    return String(cellule.nombre);
  }
  // **UNE DATE DU CLASSEUR REND LE TEXTE `JJ/MM/AAAA` DE D31** — depuis le
  // 22/09/2026 (REPRISE-HISTORIQUE). *Mesuré avant ce jour* : `texte()` ne
  // lisait pas `serie`, si bien qu'AUCUN gabarit ne pouvait exposer une colonne
  // de date — `CHAMPS_EQUIPEMENTS_ECARTES` l'écrivait comme condition de levée.
  // Le gabarit de l'historique SAV porte une date OBLIGATOIRE, et c'est lui qui
  // lève la condition. La forme rendue est celle que D31 arrête, jamais le
  // sérial : un gabarit relit ce texte par `lireDate`, la grammaire reste
  // seule juge, et le fichier des rejets (RG-IMP-03) reste rechargeable.
  //
  // Le sérial 0 est une ABSENCE (mesuré le 10/09/2026, 171 cellules) et rend
  // `undefined` comme une cellule vide. Un sérial que `lireDate` refuse —
  // fractionnaire, antérieur au 1ᵉʳ mars 1900 — est rendu BRUT : le gabarit
  // le refusera `date_format`, ce qui perd la nuance « avec heure » mais ne
  // laisse rien passer. *Refuser sans nuance vaut mieux qu'arrondir.*
  return cellule?.serie === undefined ? undefined : texteDUneDate(cellule);
}

/** Le texte `JJ/MM/AAAA` d'une cellule de date, ou ce que la grammaire en dit. */
function texteDUneDate(cellule: Cellule): string | undefined {
  const lue = lireDate(cellule);
  if (!lue.ok) {
    return lue.anomalie.code === "cellule_vide"
      ? undefined
      : String(cellule.serie);
  }
  const deux = (n: number): string => String(n).padStart(2, "0");
  // En UTC, comme `lireDate` l'a construite : *passer par le fuseau de la
  // machine décalerait le jour d'un cran d'un côté ou de l'autre du méridien.*
  return `${deux(lue.valeur.getUTCDate())}/${deux(lue.valeur.getUTCMonth() + 1)}/${lue.valeur.getUTCFullYear()}`;
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
  //
  // **DEUX PASSES, depuis le 16/09/2026 (point 4b) — et c'est une nécessité,
  // pas un raffinement.** Décider qu'une ligne DEUX-CENTIÈME créera une fiche
  // demande de savoir si la ligne QUATRE-VINGTIÈME du MÊME fichier ne visait
  // pas déjà la même clé : *une seule passe ne peut pas répondre à une
  // question sur des lignes qu'elle n'a pas encore vues.* La première pose
  // les clés ; la seconde décide, une fois qu'elles sont TOUTES connues.
  type Preparee =
    | {
        readonly rang: number;
        readonly nature: "vide" | "gabarit";
        readonly valeurs: Readonly<Record<string, string | undefined>>;
        readonly cle?: undefined;
      }
    | {
        readonly rang: number;
        readonly nature: "donnee";
        readonly valeurs: Readonly<Record<string, string | undefined>>;
        readonly cle: CleDeRapprochement;
      };
  const preparees: Preparee[] = [];

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
      preparees.push({ rang: rang + 1, nature, valeurs });
      continue;
    }

    // **C'est le MODÈLE qui dit ce que la ligne désigne** (L1-08f). Le rang
    // passé est celui qu'un humain lit : la clé de dernier recours le porte, et
    // il doit désigner la même ligne dans le rapport.
    preparees.push({
      rang: rang + 1,
      nature,
      valeurs,
      cle: modele.cle(valeurs, rang + 1),
    });
  }

  // **LES CLÉS QUE CE FICHIER SE DISPUTE À LUI-MÊME.** *Mesuré en production
  // le 16/09/2026 :* un fichier de modèles portait quatre lignes en double sur
  // (marque, référence) — la clé RÉELLE de la table —, dédupliquées à tort sur
  // (famille, marque, référence). Le parc ne les connaissait ENCORE ni l'une
  // ni l'autre : chacune ressortait donc en création, et la seconde de chaque
  // paire faisait échouer l'application sur la contrainte d'unicité, à
  // l'endroit précis où I6 promet qu'un rapport ne ment pas sur ce qu'il
  // écrira. Les clés de FORME « rang » sont exclues : elles portent le numéro
  // de la ligne elle-même, et ne peuvent structurellement pas se répéter.
  const occurrences = new Map<string, number>();
  for (const p of preparees) {
    if (p.cle !== undefined && p.cle.forme !== "rang") {
      occurrences.set(p.cle.cle, (occurrences.get(p.cle.cle) ?? 0) + 1);
    }
  }

  const lignes: LigneControlee[] = preparees.map((p) => {
    if (p.cle === undefined) {
      return {
        rang: p.rang,
        nature: p.nature,
        action: p.nature,
        valeurs: p.valeurs,
      };
    }
    const dansLeFichier =
      p.cle.forme !== "rang" && (occurrences.get(p.cle.cle) ?? 0) > 1;
    return {
      rang: p.rang,
      nature: p.nature,
      cle: p.cle,
      // **Le MÊME rang qu'à la clé** : ils doivent désigner la même ligne,
      // sans quoi la validation jugerait une ligne et le rapport en nommerait
      // une autre.
      ...decider(
        p.cle.cle,
        parc,
        modele.valider?.(p.valeurs, p.rang) ?? null,
        dansLeFichier,
      ),
      valeurs: p.valeurs,
    };
  });

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

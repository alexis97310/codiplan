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
  cleDeRapprochement,
  lignesExpliquees,
  natureDeLigne,
  propositionVide,
  type LigneDeParc,
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
  /** La colonne du numéro de série, s'il y en a une. */
  readonly colonneSerie?: string;
  /** La colonne de la référence interne, s'il y en a une. */
  readonly colonneReference?: string;
};

/** Une anomalie SITUÉE — le rapport doit pouvoir montrer où. */
export type AnomalieSituee = Anomalie & {
  /** Le rang de la ligne dans la feuille, tel qu'un humain le lit (1 = A1). */
  readonly ligne: number;
  readonly colonne?: string;
};

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
 * `clesDuParc` est ce que la base connaît déjà : une clé qui s'y trouve est une
 * MODIFICATION, une clé absente est une CRÉATION. **Le parc est un paramètre et
 * non une lecture** — ce module ne touche à aucune base, et l'appelant seul sait
 * sous quel contexte cloisonné il l'a obtenu.
 */
export function controlerFeuille(
  feuille: FeuilleLue,
  modele: ModeleDImport,
  clesDuParc: ReadonlySet<string>,
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
  let proposition = propositionVide();
  let lignesLues = 0;

  for (
    let rang = PREMIERE_LIGNE_DONNEES;
    rang < feuille.lignes.length;
    rang += 1
  ) {
    lignesLues += 1;
    const cellules = feuille.lignes[rang] ?? [];
    const dictionnaire = enDictionnaire(cellules, appariement);
    const nature: NatureDeLigne = natureDeLigne(
      dictionnaire,
      modele.identifiantes,
    );

    if (nature === "vide") {
      proposition = { ...proposition, vides: proposition.vides + 1 };
      continue;
    }
    if (nature === "gabarit") {
      // **Comptées et NON rejetées.** 652 lignes pour 55 codes réels sur
      // l'onglet Clients : les rejeter ferait 597 erreurs sur un fichier sain.
      proposition = { ...proposition, gabarits: proposition.gabarits + 1 };
      continue;
    }

    const ligneDeParc: LigneDeParc = {
      numeroSerie:
        modele.colonneSerie === undefined
          ? undefined
          : dictionnaire[modele.colonneSerie],
      reference:
        modele.colonneReference === undefined
          ? undefined
          : dictionnaire[modele.colonneReference],
      // Le rang tel qu'un humain le lit : c'est ce que la clé de dernier
      // recours porte, et il doit désigner la même ligne dans le rapport.
      rang: rang + 1,
    };
    const cle = cleDeRapprochement(ligneDeParc);

    const connue = clesDuParc.has(cle.cle);
    proposition = {
      ...proposition,
      creations: proposition.creations + (connue ? 0 : 1),
      modifications: proposition.modifications + (connue ? 1 : 0),
      // **`incompletes` QUALIFIE une ligne déjà comptée** — elle ne s'ajoute
      // pas au total. Les additionner ferait un total supérieur au fichier, et
      // le témoin dirait faux dans le sens rassurant.
      incompletes: proposition.incompletes + (cle.complet ? 0 : 1),
    };
  }

  return {
    lisible: true,
    proposition,
    inconnues: appariement.inconnues,
    anomalies,
    lignesLues,
    totalExplique: lignesExpliquees(proposition) === lignesLues,
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

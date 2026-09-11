import { describe, expect, it } from "vitest";

import { type FeuilleLue } from "@/lib/excel/classeur";
import {
  cleClientDepuis,
  cleMachineDepuis,
  controlerFeuille,
  proposerDepuisLesLignes,
  type ModeleDImport,
} from "@/lib/excel/controle";
import {
  lignesExpliquees,
  PREFIXE_RAISON_SOCIALE,
} from "@/lib/excel/rapprochement";

/**
 * Un parc connu, à partir de ses seules clés — `ambigues` vide est une
 * AFFIRMATION et non un oubli : *« ce parc ne porte aucune ambiguïté »*
 * (L1-08g). Les scénarios qui éprouvent l'ambiguïté la passent explicitement.
 */
function parc(cles: readonly string[] = [], ambigues: readonly string[] = []) {
  return { cles: new Set(cles), ambigues: new Set(ambigues) };
}

/**
 * LE CONTRÔLE PRÉALABLE, ET CE QU'IL REFUSE DE COMPTER (L1-08c ; I6, D31).
 *
 * **La chaîne entière est ici pour la première fois** : marqueur → en-têtes →
 * nature de ligne → clé de rapprochement → rapport. Chaque maillon avait ses
 * scénarios ; *une suite qui éprouve tous les maillons n'éprouve pas la chaîne*
 * (§9, 08/09), et le maillon que personne ne traversait est celui-ci.
 */

const MODELE: ModeleDImport = {
  type: "machines",
  version: 1,
  colonnes: [
    { nom: "Numéro de série", obligatoire: true },
    { nom: "Référence interne", obligatoire: false },
    { nom: "Marque", obligatoire: false },
  ],
  identifiantes: ["Numéro de série", "Référence interne"],
  // **C'est le MODÈLE qui dit ce que la ligne désigne** (L1-08f). La clé n'a
  // pas changé d'un caractère — elle a changé de MAIN, du contrôle vers le
  // modèle, parce qu'un modèle « clients » ne désigne pas par une série.
  cle: cleMachineDepuis("Numéro de série", "Référence interne"),
};

/** Construit une feuille à partir de lignes de texte. */
function feuille(
  marqueur: string,
  entetes: readonly string[],
  donnees: readonly (readonly (string | undefined)[])[],
): FeuilleLue {
  return {
    nom: "Parc",
    lignes: [
      [{ texte: marqueur }],
      entetes.map((nom) => ({ texte: nom })),
      ...donnees.map((ligne) =>
        ligne.map((valeur) =>
          valeur === undefined ? undefined : { texte: valeur },
        ),
      ),
    ],
  };
}

const ENTETES = ["Numéro de série", "Référence interne", "Marque"] as const;

describe("les trois refus qui PRÉCÈDENT toute ligne", () => {
  it("un marqueur d'un autre type arrête le contrôle, et NE COMPTE RIEN", () => {
    const controle = controlerFeuille(
      feuille("CODIPLAN-clients-v1", ENTETES, [["SN-1", undefined, "Atlas"]]),
      MODELE,
      parc(),
    );
    expect(controle.lisible).toBe(false);
    expect(!controle.lisible && controle.anomalies[0]?.code).toBe(
      "marqueur_autre_type",
    );
    // Il DIT ce qu'il a trouvé : « autre type » sans le type n'aide personne à
    // aller chercher le bon fichier.
    expect(!controle.lisible && controle.anomalies[0]?.valeur).toBe("clients");
  });

  it("une version POSTÉRIEURE est refusée — lire un v3 avec du code v2 suppose ce que v3 a changé", () => {
    const controle = controlerFeuille(
      feuille("CODIPLAN-machines-v3", ENTETES, [["SN-1", undefined, "Atlas"]]),
      MODELE,
      parc(),
    );
    expect(!controle.lisible && controle.anomalies[0]?.code).toBe(
      "marqueur_version_posterieure",
    );
  });

  it("une colonne OBLIGATOIRE absente arrête tout, plutôt que 300 rejets identiques", () => {
    const controle = controlerFeuille(
      feuille(
        "CODIPLAN-machines-v1",
        ["Référence interne", "Marque"],
        [
          [undefined, "Atlas"],
          [undefined, "Atlas"],
          [undefined, "Atlas"],
        ],
      ),
      MODELE,
      parc(),
    );
    expect(controle.lisible).toBe(false);
    // *« Ce n'est pas une ligne qui manque, c'est le fichier qui n'est pas
    // celui qu'on croit. »* Et surtout : AUCUNE ligne n'est comptée — un
    // rapport qui proposerait des créations sous une colonne obligatoire
    // absente proposerait d'écrire des fiches amputées.
    expect(
      !controle.lisible &&
        controle.anomalies.some(
          (a) =>
            a.code === "colonne_obligatoire_absente" ||
            a.code === "colonne_obligatoire_absente_ressemblance",
        ),
    ).toBe(true);
  });

  it("LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON : le bon marqueur passe", () => {
    // Sans ce témoin, « le contrôle refuse » serait aussi bien la preuve qu'il
    // refuse tout (§9, 11/09).
    const controle = controlerFeuille(
      feuille("CODIPLAN-machines-v1", ENTETES, [["SN-1", undefined, "Atlas"]]),
      MODELE,
      parc(),
    );
    expect(controle.lisible).toBe(true);
  });
});

describe("le rapport de I6 — chaque nombre a un nom", () => {
  const CONTROLE = controlerFeuille(
    feuille("CODIPLAN-machines-v1", ENTETES, [
      // deux machines connues du parc → MODIFICATIONS
      ["SN-A", undefined, "Atlas"],
      ["SN-B", undefined, "Atlas"],
      // une machine inconnue → CRÉATION
      ["SN-NEUVE", undefined, "Atlas"],
      // une machine sans série mais avec référence → création INCOMPLÈTE
      [undefined, "ATELIER-3", "Atlas"],
      // un reste de gabarit : rien d'identifiant, quelque chose ailleurs
      [undefined, undefined, "kg"],
      // rien du tout
      [undefined, undefined, undefined],
    ]),
    MODELE,
    parc(["SN-A", "SN-B"]),
  );

  it("compte créations, modifications, gabarits et vides SÉPARÉMENT", () => {
    expect(CONTROLE.lisible).toBe(true);
    if (!CONTROLE.lisible) {
      return;
    }
    expect(CONTROLE.proposition.modifications).toBe(2);
    expect(CONTROLE.proposition.creations).toBe(2);
    expect(CONTROLE.proposition.gabarits).toBe(1);
    expect(CONTROLE.proposition.vides).toBe(1);
  });

  it("`incompletes` QUALIFIE une ligne déjà comptée — elle ne s'ajoute pas", () => {
    if (!CONTROLE.lisible) {
      return;
    }
    expect(CONTROLE.proposition.incompletes).toBe(1);
    // *Les additionner ferait un total supérieur au fichier, et le témoin
    // dirait faux dans le sens rassurant.*
    expect(lignesExpliquees(CONTROLE.proposition)).toBe(6);
  });

  it("LE TÉMOIN : le total explique chaque ligne lue", () => {
    if (!CONTROLE.lisible) {
      return;
    }
    expect(CONTROLE.lignesLues).toBe(6);
    expect(CONTROLE.totalExplique).toBe(true);
    // Et le témoin porte sur le MÉCANISME, pas sur un décompte : zéro ligne lue
    // le rendrait muet, ce qui est précisément le cas qu'on veut distinguer.
    expect(CONTROLE.lignesLues).toBeGreaterThan(0);
  });

  it("une colonne INCONNUE est un avertissement, jamais un refus (D31)", () => {
    const controle = controlerFeuille(
      feuille(
        "CODIPLAN-machines-v1",
        [...ENTETES, "Couleur du capot"],
        [["SN-1", undefined, "Atlas", "rouge"]],
      ),
      MODELE,
      parc(),
    );
    expect(controle.lisible).toBe(true);
    expect(controle.lisible && controle.inconnues).toEqual([
      "Couleur du capot",
    ]);
    expect(controle.lisible && controle.proposition.creations).toBe(1);
  });
});

describe("une feuille SANS ligne de données se rapporte, elle ne casse pas", () => {
  it("rend un rapport à zéro, lisible, et le témoin le dit", () => {
    const controle = controlerFeuille(
      feuille("CODIPLAN-machines-v1", ENTETES, []),
      MODELE,
      parc(),
    );
    expect(controle.lisible).toBe(true);
    if (!controle.lisible) {
      return;
    }
    expect(controle.lignesLues).toBe(0);
    // `totalExplique` vaut `true` sur zéro contre zéro — et **c'est exactement
    // le cas que le §9 (10/09) dit de ne pas présenter comme une preuve.**
    // L'appelant lit `lignesLues` avant de conclure, et c'est pour cela qu'il
    // est rendu à côté.
    expect(controle.totalExplique).toBe(true);
    expect(controle.proposition.creations).toBe(0);
  });
});

describe("LE RAPPORT RETIENT CE QU'IL DÉCIDE (L1-08d)", () => {
  /*
   * *Mesuré le 11/09/2026 : le contrôle décidait ligne à ligne — nature, clé,
   * création ou modification — puis jetait tout et ne rendait que des
   * décomptes.* I6 veut qu'un import produise d'abord un rapport, puis attende
   * une validation explicite : **l'application ne peut appliquer que ce que le
   * rapport a montré**, et un rapport qui ne retient rien ne peut rien faire
   * appliquer. C'était le mur devant L1-08b, et il n'était écrit nulle part.
   */
  const FEUILLE = feuille("CODIPLAN-machines-v1", ENTETES, [
    ["SN-EXISTANT", undefined, "Atlas"],
    ["SN-NOUVEAU", undefined, "Kaeser"],
    [undefined, undefined, undefined],
    [undefined, undefined, "Marque sans identifiant"],
  ]);

  it("retient UNE ligne par ligne lue, dans l'ordre du fichier", () => {
    const controle = controlerFeuille(FEUILLE, MODELE, parc(["SN-EXISTANT"]));
    expect(controle.lisible).toBe(true);
    if (!controle.lisible) return;

    // Le témoin : autant de lignes retenues que de lignes lues. Sans lui, un
    // rapport qui perdrait une ligne en silence passerait pour complet.
    expect(controle.lignes).toHaveLength(controle.lignesLues);
    expect(controle.lignes.map((l) => l.rang)).toEqual([3, 4, 5, 6]);
  });

  it("nomme l'action de chaque ligne, et la clé de celles qui désignent", () => {
    const controle = controlerFeuille(FEUILLE, MODELE, parc(["SN-EXISTANT"]));
    if (!controle.lisible) throw new Error("feuille jugée illisible");

    expect(controle.lignes.map((l) => l.action)).toEqual([
      "modification",
      "creation",
      "vide",
      "gabarit",
    ]);
    // *Un gabarit et une ligne vide ne DÉSIGNENT rien* : leur inventer une clé
    // les ferait entrer dans l'espace des clés réelles, où deux lignes muettes
    // deviendraient la même machine.
    expect(controle.lignes[2]?.cle).toBeUndefined();
    expect(controle.lignes[3]?.cle).toBeUndefined();
    expect(controle.lignes[0]?.cle?.cle).toBe("SN-EXISTANT");
  });

  it("porte les VALEURS de chaque ligne — c'est ce que l'application écrira", () => {
    const controle = controlerFeuille(FEUILLE, MODELE, parc());
    if (!controle.lisible) throw new Error("feuille jugée illisible");

    expect(controle.lignes[1]?.valeurs).toEqual({
      "Numéro de série": "SN-NOUVEAU",
      "Référence interne": undefined,
      Marque: "Kaeser",
    });
  });

  it("les DÉCOMPTES sont dérivés des lignes, ils ne sont plus comptés à côté", () => {
    // C'est la divergence que ce ticket RETIRE : décider deux fois la même
    // chose, une fois pour la ligne et une fois pour le compteur (§9, 01/09).
    const controle = controlerFeuille(FEUILLE, MODELE, parc(["SN-EXISTANT"]));
    if (!controle.lisible) throw new Error("feuille jugée illisible");

    expect(controle.proposition).toEqual(
      proposerDepuisLesLignes(controle.lignes),
    );
    expect(lignesExpliquees(controle.proposition)).toBe(controle.lignesLues);
  });

  it("et la dérivation N'EST PAS VIDE — le cas qui doit rester vert pour sa propre raison", () => {
    // Deux décomptes tous nuls seraient égaux sans rien prouver : zéro contre
    // zéro n'est pas un résultat (§9, 10/09).
    const controle = controlerFeuille(FEUILLE, MODELE, parc(["SN-EXISTANT"]));
    if (!controle.lisible) throw new Error("feuille jugée illisible");

    expect(controle.proposition.creations).toBe(1);
    expect(controle.proposition.modifications).toBe(1);
    expect(controle.proposition.gabarits).toBe(1);
    expect(controle.proposition.vides).toBe(1);
  });
});

/* ────────────────────────────────────────────────────────────────────────
 * LE MODÈLE DIT CE QUE LA LIGNE DÉSIGNE (L1-08f)
 * ──────────────────────────────────────────────────────────────────────── */

describe("un modèle NON MACHINE rapproche enfin ce qu'il désigne", () => {
  /**
   * LE DÉFAUT, TEL QU'IL A ÉTÉ MESURÉ AVANT D'ÊTRE RÉPARÉ.
   *
   * Le contrôle calculait lui-même la clé des MACHINES — série, référence,
   * rang — quel que soit le type d'import. Sur ce modèle « clients », qui n'a
   * ni série ni référence, les deux lignes tombaient sur la clé de dernier
   * recours : *clés `LIGNE-3` et `LIGNE-4`, **2 créations, 0 modification***,
   * alors que le parc connaissait déjà les deux codes. Un second import du
   * même fichier aurait créé autant de doublons — ce que RG-IMP-05 interdit.
   */
  const CLIENTS: ModeleDImport = {
    type: "clients",
    version: 1,
    colonnes: [
      { nom: "Code externe", obligatoire: false },
      { nom: "Raison sociale", obligatoire: true },
    ],
    identifiantes: ["Code externe", "Raison sociale"],
    cle: cleClientDepuis("Code externe", "Raison sociale"),
  };

  function feuilleClients(): FeuilleLue {
    return {
      nom: "Clients",
      lignes: [
        [{ texte: "CODIPLAN-clients-v1" }],
        [{ texte: "Code externe" }, { texte: "Raison sociale" }],
        [{ texte: "C001" }, { texte: "Garage Dupont" }],
        [undefined, { texte: "Garage Martin" }],
      ],
    };
  }

  it("un code DÉJÀ connu du parc devient une MODIFICATION, jamais une création", () => {
    const controle = controlerFeuille(
      feuilleClients(),
      CLIENTS,
      parc(["C001"]),
    );
    expect(controle.lisible).toBe(true);
    if (!controle.lisible) return;

    expect(controle.lignes.map((l) => l.cle?.cle)).toEqual([
      "C001",
      `${PREFIXE_RAISON_SOCIALE}garage martin`,
    ]);
    expect(controle.lignes.map((l) => l.action)).toEqual([
      "modification",
      "creation",
    ]);
    expect(controle.proposition.modifications).toBe(1);
    expect(controle.proposition.creations).toBe(1);
  });

  it("et un parc qui connaît le NOM rapproche aussi — RG-IMP-05, seconde moitié", () => {
    // Le cas qui doit rester vert POUR SA PROPRE RAISON (§9, 11/09) : ce n'est
    // pas « tout devient modification », c'est la clé qui décide. Ici le parc
    // connaît le nom normalisé et non le code : la première ligne reste une
    // création, la seconde devient une modification. L'inverse exact du cas
    // ci-dessus, sur la même feuille.
    const controle = controlerFeuille(
      feuilleClients(),
      CLIENTS,
      parc([`${PREFIXE_RAISON_SOCIALE}garage martin`]),
    );
    expect(controle.lisible).toBe(true);
    if (!controle.lisible) return;

    expect(controle.lignes.map((l) => l.action)).toEqual([
      "creation",
      "modification",
    ]);
  });

  it("le modèle des MACHINES n'a pas changé d'un caractère — il a changé de main", () => {
    // Les 111 scénarios de ce fichier passent inchangés, et c'est la meilleure
    // preuve. Celui-ci le dit explicitement : la clé machine rend exactement ce
    // qu'elle rendait, à travers `cleMachineDepuis`.
    const controle = controlerFeuille(
      feuille(
        "CODIPLAN-machines-v1",
        ["Numéro de série", "Référence interne", "Marque"],
        [["SN-77", undefined, "Bosch"]],
      ),
      MODELE,
      parc(),
    );
    expect(controle.lisible).toBe(true);
    if (!controle.lisible) return;
    expect(controle.lignes[0]?.cle?.cle).toBe("SN-77");
    expect(controle.lignes[0]?.cle?.complet).toBe(true);
  });
});

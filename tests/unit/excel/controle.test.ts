import { describe, expect, it } from "vitest";

import { type FeuilleLue } from "@/lib/excel/classeur";
import { controlerFeuille, type ModeleDImport } from "@/lib/excel/controle";
import { lignesExpliquees } from "@/lib/excel/rapprochement";

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
  colonneSerie: "Numéro de série",
  colonneReference: "Référence interne",
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
      new Set(),
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
      new Set(),
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
      new Set(),
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
      new Set(),
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
    new Set(["SN-A", "SN-B"]),
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
      new Set(),
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
      new Set(),
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

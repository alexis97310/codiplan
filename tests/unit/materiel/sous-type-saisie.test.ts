import { describe, expect, it } from "vitest";

import {
  schemaModeleMateriel,
  schemaSousTypeMateriel,
} from "@/lib/materiel/saisie";
import {
  COLONNES_MODELES,
  MOTIF_SOUS_TYPE_INACTIF,
  MOTIF_SOUS_TYPE_INTROUVABLE,
  preparerUnModele,
} from "@/lib/imports/modeles";
import { cleSousType, type ParcSousTypes } from "@/lib/imports/parc-sous-types";
import { type ParcFamilles } from "@/lib/imports/parc-familles";

/**
 * SAISIE D'UN SOUS-TYPE STRUCTURÉ (D238, ticket 9K17A-MATERIEL-SOUS-TYPE).
 *
 * Le schéma Zod d'abord, puis la colonne « Sous-type (code) » du gabarit des
 * modèles — sur des parcs FABRIQUÉS plutôt que lus en base : `preparerUnModele`
 * est une fonction pure de ses deux parcs, et l'éprouver ici n'exige aucune
 * connexion (les scénarios d'isolation l'éprouvent par ailleurs contre la
 * vraie base, cloisonnement compris).
 */
describe("schemaSousTypeMateriel", () => {
  const FAMILLE = "0192f0a0-0000-7000-8000-00000000f000";

  it("accepte une saisie minimale, et pose actif=true par défaut", () => {
    const resultat = schemaSousTypeMateriel.safeParse({
      famille_id: FAMILLE,
      code: "2COL-EM",
      libelle: "Pont 2 colonnes électromécanique",
    });
    expect(resultat.success).toBe(true);
    if (!resultat.success) return;
    expect(resultat.data.actif).toBe(true);
  });

  it("refuse un code vide — même garde que code_pris en base (CHECK)", () => {
    expect(
      schemaSousTypeMateriel.safeParse({
        famille_id: FAMILLE,
        code: "   ",
        libelle: "Pont 4 colonnes",
      }).success,
    ).toBe(false);
  });

  it("refuse un libellé vide", () => {
    expect(
      schemaSousTypeMateriel.safeParse({
        famille_id: FAMILLE,
        code: "4COL",
        libelle: "",
      }).success,
    ).toBe(false);
  });

  it("refuse une famille qui n'est pas un UUID — rien d'autre ne la désigne", () => {
    expect(
      schemaSousTypeMateriel.safeParse({
        famille_id: "PAS-UN-UUID",
        code: "4COL",
        libelle: "Pont 4 colonnes",
      }).success,
    ).toBe(false);
  });
});

describe("schemaModeleMateriel — sous_type_id est FACULTATIF (D238)", () => {
  it("l'absence devient null par défaut, comme caracteristiques", () => {
    const resultat = schemaModeleMateriel.safeParse({
      famille_id: "0192f0a0-0000-7000-8000-00000000f000",
      marque: "Ravaglioli",
      reference: "KPX-337",
    });
    expect(resultat.success).toBe(true);
    if (!resultat.success) return;
    expect(resultat.data.sous_type_id).toBeNull();
  });

  it("un sous_type_id explicite null est accepté — « aucun », saisi", () => {
    const resultat = schemaModeleMateriel.safeParse({
      famille_id: "0192f0a0-0000-7000-8000-00000000f000",
      sous_type_id: null,
      marque: "Ravaglioli",
      reference: "KPX-337",
    });
    expect(resultat.success).toBe(true);
  });

  it("un sous_type_id qui n'est pas un UUID est refusé", () => {
    const resultat = schemaModeleMateriel.safeParse({
      famille_id: "0192f0a0-0000-7000-8000-00000000f000",
      sous_type_id: "pas-un-uuid",
      marque: "Ravaglioli",
      reference: "KPX-337",
    });
    expect(resultat.success).toBe(false);
  });
});

/**
 * LA COLONNE « Sous-type (code) » DU GABARIT DES MODÈLES — quatre cas, et
 * c'est la liste du ticket : vide, code valide, inconnu, inactif, et
 * d'une autre famille. `preparerUnModele` résout aussi la famille elle-même
 * (même fonction, même garde que L1-09d) : les parcs ci-dessous nomment deux
 * familles pour éprouver le dernier cas.
 */
describe("la colonne « Sous-type (code) » du gabarit des modèles (D238)", () => {
  const FAMILLE_PONT = "0192f0a0-0000-7000-8000-00000000f001";
  const FAMILLE_COMPRESSEUR = "0192f0a0-0000-7000-8000-00000000f002";
  const SOUS_TYPE_4COL = "0192f0a0-0000-7000-8000-00000000e001";
  const SOUS_TYPE_INACTIF = "0192f0a0-0000-7000-8000-00000000e002";

  const familles: ParcFamilles = {
    parCode: new Map([
      ["PONT", FAMILLE_PONT],
      ["COMPRESSEUR", FAMILLE_COMPRESSEUR],
    ]),
  };

  const sousTypes: ParcSousTypes = {
    parFamilleEtCode: new Map([
      [cleSousType(FAMILLE_PONT, "4COL"), { id: SOUS_TYPE_4COL, actif: true }],
      [
        cleSousType(FAMILLE_PONT, "CISEAUX"),
        { id: SOUS_TYPE_INACTIF, actif: false },
      ],
    ]),
  };

  function valeurs(
    sousType: string | undefined,
  ): Record<string, string | undefined> {
    return {
      [COLONNES_MODELES.famille]: "PONT",
      [COLONNES_MODELES.marque]: "Ravaglioli",
      [COLONNES_MODELES.reference]: "KPX-337",
      [COLONNES_MODELES.sousType]: sousType,
    };
  }

  it("CELLULE VIDE — aucun sous-type, et la ligne passe (le cas majoritaire)", () => {
    const resultat = preparerUnModele(familles, sousTypes, valeurs(undefined));
    expect(resultat.prete).toBe(true);
    if (!resultat.prete) return;
    expect(resultat.saisie.sous_type_id).toBeNull();
  });

  it("CODE VALIDE, de la bonne famille — résolu vers son identifiant", () => {
    const resultat = preparerUnModele(familles, sousTypes, valeurs("4col"));
    expect(resultat.prete).toBe(true);
    if (!resultat.prete) return;
    expect(resultat.saisie.sous_type_id).toBe(SOUS_TYPE_4COL);
  });

  it("CODE INCONNU — rejeté, motif nommé", () => {
    const resultat = preparerUnModele(
      familles,
      sousTypes,
      valeurs("N-EXISTE-PAS"),
    );
    expect(resultat.prete).toBe(false);
    if (resultat.prete) return;
    expect(resultat.motif).toBe(MOTIF_SOUS_TYPE_INTROUVABLE);
  });

  it("CODE INACTIF — rejeté par un motif DISTINCT de « introuvable »", () => {
    const resultat = preparerUnModele(familles, sousTypes, valeurs("ciseaux"));
    expect(resultat.prete).toBe(false);
    if (resultat.prete) return;
    expect(resultat.motif).toBe(MOTIF_SOUS_TYPE_INACTIF);
  });

  it("CODE D'UNE AUTRE FAMILLE — même refus qu'un code inconnu (D35, D50)", () => {
    // « 4COL » existe, mais sous PONT — la ligne désigne COMPRESSEUR.
    const ligneCompresseur = {
      ...valeurs("4col"),
      [COLONNES_MODELES.famille]: "COMPRESSEUR",
    };
    const resultat = preparerUnModele(familles, sousTypes, ligneCompresseur);
    expect(resultat.prete).toBe(false);
    if (resultat.prete) return;
    expect(resultat.motif).toBe(MOTIF_SOUS_TYPE_INTROUVABLE);
  });

  it("LE JUMEAU : retirer le sous-type de l'index le rend « introuvable »", () => {
    // Éprouve que la résolution vient RÉELLEMENT de l'index, pas d'une
    // coïncidence de nommage.
    const sansSousTypes: ParcSousTypes = { parFamilleEtCode: new Map() };
    const resultat = preparerUnModele(familles, sansSousTypes, valeurs("4col"));
    expect(resultat.prete).toBe(false);
    if (resultat.prete) return;
    expect(resultat.motif).toBe(MOTIF_SOUS_TYPE_INTROUVABLE);
  });
});

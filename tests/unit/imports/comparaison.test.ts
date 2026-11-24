import { describe, expect, it } from "vitest";

import {
  conserverLesChampsAbsents,
  porteEncore,
} from "@/lib/imports/comparaison";

/**
 * `porteEncore` — CINQ formes comparables (R6-03, et la cinquième ajoutée au
 * ticket 9K29) : TEXTE, ENTIER, BOOLÉEN, NULL, et un TABLEAU DE TEXTES comparé
 * comme un ENSEMBLE.
 *
 * Un champ ABSENT de `attendu` compte comme « porté » (rien n'a été dit) ;
 * les trois autres formes ont déjà leur propre couverture historique — ce
 * fichier ne couvre que la forme tableau, neuve.
 */

describe("porteEncore — la forme TABLEAU, comparée comme un ENSEMBLE", () => {
  it("le même ensemble, même ordre, porte encore", () => {
    expect(
      porteEncore(
        { types: ["curatif", "garantie"] },
        { types: ["curatif", "garantie"] },
        ["types"],
      ),
    ).toBe(true);
  });

  it("le même ensemble, ORDRE DIFFÉRENT, porte encore — l'ordre n'a aucun sens ici", () => {
    expect(
      porteEncore(
        { types: ["garantie", "curatif"] },
        { types: ["curatif", "garantie"] },
        ["types"],
      ),
    ).toBe(true);
  });

  it("un ensemble plus large ne porte PLUS encore", () => {
    expect(
      porteEncore({ types: ["curatif"] }, { types: ["curatif", "garantie"] }, [
        "types",
      ]),
    ).toBe(false);
  });

  it("un ensemble plus étroit ne porte PLUS encore", () => {
    expect(
      porteEncore({ types: ["curatif", "garantie"] }, { types: ["curatif"] }, [
        "types",
      ]),
    ).toBe(false);
  });

  it("deux tableaux vides portent encore — « tous les types » ne change pas", () => {
    expect(porteEncore({ types: [] }, { types: [] }, ["types"])).toBe(true);
  });

  it("un tableau attendu contre une valeur présente NON tableau ne porte plus encore", () => {
    expect(
      porteEncore({ types: "curatif" }, { types: ["curatif"] }, ["types"]),
    ).toBe(false);
  });
});

/**
 * `conserverLesChampsAbsents` — 9L40 (25/11/2026). La règle du ticket, telle
 * qu'écrite : une cellule vide du fichier ne remplace JAMAIS une valeur déjà
 * en fiche ; une cellule remplie et différente, elle, remplace.
 */
describe("conserverLesChampsAbsents — une cellule que le gabarit ne porte jamais ne remplace jamais la fiche", () => {
  it("reprend la valeur déjà en fiche sur les champs nommés, même si la saisie préparée porte un défaut", () => {
    const avant = { annee_fabrication: 2018, localisation: "Atelier" };
    const prepare = { annee_fabrication: null, localisation: "Atelier" };

    expect(
      conserverLesChampsAbsents(prepare, avant, ["annee_fabrication"]),
    ).toEqual({ annee_fabrication: 2018, localisation: "Atelier" });
  });

  it("laisse une colonne REMPLIE et DIFFÉRENTE remplacer — elle n'est pas dans la liste des champs jamais écrasés", () => {
    const avant = { localisation: "Atelier", criticite: "normale" };
    const prepare = { localisation: "Quai 2", criticite: "normale" };

    expect(conserverLesChampsAbsents(prepare, avant, ["criticite"])).toEqual({
      localisation: "Quai 2",
      criticite: "normale",
    });
  });

  it("sans liste de champs, rend la saisie préparée telle quelle", () => {
    const avant = { annee_fabrication: 2018 };
    const prepare = { annee_fabrication: null };

    expect(conserverLesChampsAbsents(prepare, avant, undefined)).toBe(prepare);
    expect(conserverLesChampsAbsents(prepare, avant, [])).toBe(prepare);
  });

  it("une liste à plusieurs champs reprend chacun indépendamment", () => {
    const avant = {
      annee_fabrication: 2015,
      facture_origine: "FAC-2015-042",
      localisation: "Atelier",
    };
    const prepare = {
      annee_fabrication: null,
      facture_origine: null,
      localisation: "Atelier",
    };

    expect(
      conserverLesChampsAbsents(prepare, avant, [
        "annee_fabrication",
        "facture_origine",
      ]),
    ).toEqual({
      annee_fabrication: 2015,
      facture_origine: "FAC-2015-042",
      localisation: "Atelier",
    });
  });
});

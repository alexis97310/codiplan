import { describe, expect, it } from "vitest";

import { porteEncore } from "@/lib/imports/comparaison";

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

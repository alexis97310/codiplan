import { describe, expect, it } from "vitest";

import {
  detailNonConformeDe,
  detailNonConformeVide,
  libelleSuiteNonConformite,
  valeurConformeDe,
} from "@/lib/checklists/non-conformite";

/**
 * LE DÉTAIL D'UN POINT NON CONFORME (9L04I-CHECKLIST-NON-CONFORME-DETAIL) —
 * FONCTIONS PURES partagées par la saisie terrain et les lectures bureau/
 * portail (bons, fiche). Voir l'en-tête de `lib/checklists/non-conformite.ts`.
 */

describe("valeurConformeDe", () => {
  it.each(["conforme", "non_conforme", "sans_objet"] as const)(
    "lit « %s » quand la valeur est une simple chaîne",
    (valeur) => {
      expect(valeurConformeDe(valeur)).toBe(valeur);
    },
  );

  it("lit `conforme` depuis l'objet détail", () => {
    expect(
      valeurConformeDe({
        conforme: "non_conforme",
        suite: "a_revoir",
        commentaire: null,
      }),
    ).toBe("non_conforme");
  });

  it("rend `null` pour `null`, `undefined`, un nombre ou une chaîne hors énumération", () => {
    expect(valeurConformeDe(null)).toBeNull();
    expect(valeurConformeDe(undefined)).toBeNull();
    expect(valeurConformeDe(42)).toBeNull();
    expect(valeurConformeDe("peut_etre")).toBeNull();
  });
});

describe("detailNonConformeDe", () => {
  it("lit la suite et le commentaire depuis l'objet détail", () => {
    expect(
      detailNonConformeDe({
        conforme: "non_conforme",
        suite: "piece_a_commander",
        commentaire: "Ne redémarre pas sous 6 bar",
      }),
    ).toEqual({
      suite: "piece_a_commander",
      commentaire: "Ne redémarre pas sous 6 bar",
    });
  });

  it("rend `{ suite: null, commentaire: null }` pour une simple chaîne ou `null`", () => {
    expect(detailNonConformeDe("non_conforme")).toEqual({
      suite: null,
      commentaire: null,
    });
    expect(detailNonConformeDe(null)).toEqual({
      suite: null,
      commentaire: null,
    });
  });
});

describe("detailNonConformeVide", () => {
  it("vrai quand ni la suite ni le commentaire ne portent de valeur", () => {
    expect(detailNonConformeVide({ suite: null, commentaire: null })).toBe(
      true,
    );
  });

  it("faux dès que l'un des deux porte une valeur", () => {
    expect(
      detailNonConformeVide({ suite: "a_revoir", commentaire: null }),
    ).toBe(false);
    expect(
      detailNonConformeVide({ suite: null, commentaire: "Un commentaire" }),
    ).toBe(false);
  });
});

describe("libelleSuiteNonConformite", () => {
  it("nomme les trois valeurs closes", () => {
    expect(libelleSuiteNonConformite("regle_sur_place")).toBe(
      "Réglé sur place",
    );
    expect(libelleSuiteNonConformite("piece_a_commander")).toBe(
      "Pièce à commander",
    );
    expect(libelleSuiteNonConformite("a_revoir")).toBe("À revoir");
  });
});

import { describe, expect, it } from "vitest";

import type {
  FicheJSON,
  InstantaneJSON,
} from "@/app/api/terrain/instantane/route";
import {
  catalogueDeLaCopie,
  prestationsRealiseesDeLaFiche,
} from "@/lib/terrain/copie-validee";

/**
 * LA COPIE ANCIENNE, TOLÉRÉE (9F4H6A-COQUILLE-ANCIENNE-COPIE, point 1) —
 * `lireCopie` rend l'objet IndexedDB tel quel (voir son en-tête) ; une copie
 * écrite AVANT 9F4H6 ne porte ni `catalogue` ni `prestationsRealiseesIds`.
 * `as unknown as InstantaneJSON` est le même raccourci que le composant :
 * c'est exactement ce que ces fonctions reçoivent en vrai depuis IndexedDB.
 */

describe("catalogueDeLaCopie", () => {
  it("un catalogue présent est rendu tel quel, indisponible: false", () => {
    const catalogue = [
      { id: "p1", libelle: "Filtre" },
    ] as unknown as InstantaneJSON["catalogue"];
    const copie = { catalogue } as unknown as InstantaneJSON;
    expect(catalogueDeLaCopie(copie)).toEqual({
      catalogue,
      indisponible: false,
    });
  });

  it("une copie ANCIENNE (catalogue absent) rend [], indisponible: true", () => {
    const copie = {} as unknown as InstantaneJSON;
    expect(catalogueDeLaCopie(copie)).toEqual({
      catalogue: [],
      indisponible: true,
    });
  });
});

describe("prestationsRealiseesDeLaFiche", () => {
  it("un ensemble présent, même vide, est rendu tel quel, indisponibles: false", () => {
    const fiche = { prestationsRealiseesIds: [] } as unknown as FicheJSON;
    expect(prestationsRealiseesDeLaFiche(fiche)).toEqual({
      ids: [],
      indisponibles: false,
    });
  });

  it("un ensemble non vide est rendu tel quel", () => {
    const fiche = {
      prestationsRealiseesIds: ["p1", "p2"],
    } as unknown as FicheJSON;
    expect(prestationsRealiseesDeLaFiche(fiche)).toEqual({
      ids: ["p1", "p2"],
      indisponibles: false,
    });
  });

  it("une fiche d'une copie ANCIENNE (ids absents) rend [], indisponibles: true — jamais un ensemble vide muet", () => {
    const fiche = {} as unknown as FicheJSON;
    expect(prestationsRealiseesDeLaFiche(fiche)).toEqual({
      ids: [],
      indisponibles: true,
    });
  });
});

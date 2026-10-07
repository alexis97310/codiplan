import { describe, expect, it } from "vitest";

import {
  libelleMachineFacultative,
  optionsPriorite,
  prevenuVide,
  recapitulatifVide,
} from "../../../app/(back-office)/interventions/presentation";

/**
 * TP-UX5-1-FORMULAIRES — les trois phrases composées de la colonne de droite
 * et du champ Machine, avec le mot imposé « site » (D5, D47, L0-11).
 */
describe("libelleMachineFacultative", () => {
  it("compose « Machine (facultatif : sans machine, l'intervention porte sur le site) »", () => {
    expect(libelleMachineFacultative()).toBe(
      "Machine (facultatif : sans machine, l'intervention porte sur le site)",
    );
  });
});

describe("recapitulatifVide", () => {
  it("compose « Le client et le site choisis s'affichent ici. »", () => {
    expect(recapitulatifVide()).toBe(
      "Le client et le site choisis s'affichent ici.",
    );
  });
});

describe("prevenuVide", () => {
  it("compose « Le donneur d'ordre du site. »", () => {
    expect(prevenuVide()).toBe("Le donneur d'ordre du site.");
  });
});

describe("optionsPriorite", () => {
  it("rend les quatre priorités, dans l'ordre", () => {
    expect(optionsPriorite().map((option) => option.valeur)).toEqual([
      "p1",
      "p2",
      "p3",
      "p4",
    ]);
  });

  it("chaque libellé est le mot complet du dictionnaire", () => {
    const [p1] = optionsPriorite();
    expect(p1?.libelle).not.toBe("");
    expect(p1?.libelle).not.toBe("p1");
  });
});

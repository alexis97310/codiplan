import { describe, expect, it } from "vitest";

import { etatDeLaCase, type CaseSurvolee } from "@/lib/interventions/survol";

/**
 * `etatDeLaCase` (PG-B4-SURVOL-CASES) — PURE, aucune requête : les quatre
 * motifs annoncés pendant un glisser-déposer, et le cas « possible ».
 */

const CARTE = { interventionId: "int-1", dureeMin: 60 };

const CASE_LIBRE: CaseSurvolee = {
  bloquee: false,
  ouverte: true,
  ferie: false,
};

const DONNEES_SANS_HABILITATION = { habilitationManquante: null };

describe("etatDeLaCase", () => {
  it("rend `possible` sur une case libre, ouverte, sans férié", () => {
    expect(etatDeLaCase(CARTE, CASE_LIBRE, DONNEES_SANS_HABILITATION)).toEqual({
      possible: true,
    });
  });

  it("refuse « absent » sur une case bloquée par une absence", () => {
    const caseBloquee: CaseSurvolee = { ...CASE_LIBRE, bloquee: true };
    expect(etatDeLaCase(CARTE, caseBloquee, DONNEES_SANS_HABILITATION)).toEqual(
      { possible: false, motif: "absent" },
    );
  });

  it("refuse « férié » sur un jour férié, même quand la case ne dit rien d'autre", () => {
    const caseFeriee: CaseSurvolee = { ...CASE_LIBRE, ferie: true };
    expect(etatDeLaCase(CARTE, caseFeriee, DONNEES_SANS_HABILITATION)).toEqual({
      possible: false,
      motif: "ferie",
    });
  });

  it("refuse « agence fermée » sur un jour ordinairement non ouvert", () => {
    const caseFermee: CaseSurvolee = { ...CASE_LIBRE, ouverte: false };
    expect(etatDeLaCase(CARTE, caseFermee, DONNEES_SANS_HABILITATION)).toEqual({
      possible: false,
      motif: "agence_fermee",
    });
  });

  it("rend `possible` quand l'ouverture est INCONNUE (`null`) — jamais un refus inventé", () => {
    const caseInconnue: CaseSurvolee = { ...CASE_LIBRE, ouverte: null };
    expect(
      etatDeLaCase(CARTE, caseInconnue, DONNEES_SANS_HABILITATION),
    ).toEqual({ possible: true });
  });

  it("refuse « habilitation manquante » SEULEMENT quand la donnée est réellement chargée", () => {
    expect(
      etatDeLaCase(CARTE, CASE_LIBRE, { habilitationManquante: true }),
    ).toEqual({ possible: false, motif: "habilitation_manquante" });
  });

  it("ne rend JAMAIS ce refus quand l'habilitation n'est pas chargée (`null`) — un DONT-KNOW n'est pas un refus", () => {
    expect(
      etatDeLaCase(CARTE, CASE_LIBRE, { habilitationManquante: null }),
    ).toEqual({ possible: true });
  });

  it("l'absence prime sur un jour fermé — même précédence que `classeDeCase`", () => {
    const caseBloqueeEtFermee: CaseSurvolee = {
      bloquee: true,
      ouverte: false,
      ferie: true,
    };
    expect(
      etatDeLaCase(CARTE, caseBloqueeEtFermee, DONNEES_SANS_HABILITATION),
    ).toEqual({ possible: false, motif: "absent" });
  });
});

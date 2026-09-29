import { describe, expect, it } from "vitest";

import {
  etatVideDuRegistre,
  motifCriteresInvalides,
} from "../../../app/(back-office)/interventions/presentation";

/**
 * IN-07 / IN-12 (audit du 28/09/2026, 9BP-TP-A4a-MESSAGES).
 *
 * Mesuré sur `main` avant ce ticket : une période inversée ou une recherche
 * invalide vidait le registre EN SILENCE (`criteres.error` n'était lu nulle
 * part), et le même « Aucune intervention enregistrée. » s'affichait pour un
 * registre réellement vide, un filtre sans résultat, et une recherche
 * invalide — trois situations, un seul texte, deux d'entre elles sans aucune
 * action pour s'en sortir.
 */
describe("motifCriteresInvalides — la seule cause qu'on puisse nommer avec certitude", () => {
  it("le refine « la fin doit suivre le début », posé sur `au` avec le code `custom` → période inversée", () => {
    const erreur = {
      issues: [
        {
          path: ["au"],
          code: "custom",
        },
      ],
    };
    expect(motifCriteresInvalides(erreur)).toBe(
      "interventions.refus.periode_inversee",
    );
  });

  it("un UUID malformé (issue sur `agence_id`, pas `custom`) → repli générique", () => {
    const erreur = {
      issues: [
        {
          path: ["agence_id"],
          code: "invalid_format",
        },
      ],
    };
    expect(motifCriteresInvalides(erreur)).toBe(
      "interventions.refus.recherche_invalide",
    );
  });

  it("une issue sur `au` qui n'est PAS `custom` (ex. date malformée) → repli générique, pas période inversée", () => {
    const erreur = {
      issues: [
        {
          path: ["au"],
          code: "invalid_type",
        },
      ],
    };
    expect(motifCriteresInvalides(erreur)).toBe(
      "interventions.refus.recherche_invalide",
    );
  });
});

describe("etatVideDuRegistre — un registre vide n'est pas un filtre sans résultat", () => {
  it("critères valides, aucun filtre actif → interventions.vide", () => {
    expect(
      etatVideDuRegistre({ criteresValides: true, filtreActif: false }),
    ).toBe("interventions.vide");
  });

  it("critères valides, un filtre ou un onglet actif → interventions.vide_filtre", () => {
    expect(
      etatVideDuRegistre({ criteresValides: true, filtreActif: true }),
    ).toBe("interventions.vide_filtre");
  });

  it("critères invalides, quel que soit filtreActif → interventions.vide_filtre", () => {
    expect(
      etatVideDuRegistre({ criteresValides: false, filtreActif: false }),
    ).toBe("interventions.vide_filtre");
  });
});

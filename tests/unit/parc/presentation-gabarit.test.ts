import { describe, expect, it } from "vitest";

import {
  detailTuileEnPanne,
  detailTuileGarantie,
  detailTuileMachinesSuivies,
  finDeGarantieAffichee,
} from "../../../app/(back-office)/parc/presentation";

/**
 * LE GABARIT DU 28/09 — TUILES ET APERÇU (9EB-TP-UX3-2-LISTES-2).
 *
 * Fonctions PURES, éprouvées sans base ni fuseau : les mêmes garanties que
 * `tests/unit/machines/parc.test.ts` apporte déjà à `resumerLeParc`.
 */

describe("finDeGarantieAffichee — jj/mm/aaaa (dans N jour(s)), ou « terminée » seule", () => {
  const AUJOURDHUI = new Date("2026-09-16T00:00:00Z");
  const JOUR = 24 * 60 * 60 * 1000;

  it("une garantie qui finit AUJOURD'HUI — borne basse, 0 jour (accord pluriel, comme `decompte`)", () => {
    expect(finDeGarantieAffichee(AUJOURDHUI, AUJOURDHUI)).toMatch(
      /\(dans 0 jours\)$/,
    );
  });

  it("une garantie qui finit DEMAIN — accord singulier", () => {
    const demain = new Date(AUJOURDHUI.getTime() + JOUR);
    expect(finDeGarantieAffichee(demain, AUJOURDHUI)).toMatch(
      /\(dans 1 jour\)$/,
    );
  });

  it("une garantie qui finit dans plusieurs jours — accord pluriel", () => {
    const dansDixJours = new Date(AUJOURDHUI.getTime() + 10 * JOUR);
    expect(finDeGarantieAffichee(dansDixJours, AUJOURDHUI)).toMatch(
      /\(dans 10 jours\)$/,
    );
  });

  it("une garantie déjà DÉPASSÉE — « terminée » seule, jamais la date", () => {
    const hier = new Date(AUJOURDHUI.getTime() - JOUR);
    expect(finDeGarantieAffichee(hier, AUJOURDHUI)).toBe("terminée");
  });
});

describe("detailTuileMachinesSuivies — hors N sorties du parc", () => {
  it("zéro sortie — phrase dédiée, jamais « hors 0 sortie »", () => {
    expect(detailTuileMachinesSuivies(0)).toBe("Aucune sortie du parc");
  });

  it("une sortie — accord singulier", () => {
    expect(detailTuileMachinesSuivies(1)).toBe("hors 1 sortie du parc");
  });

  it("plusieurs sorties — accord pluriel", () => {
    expect(detailTuileMachinesSuivies(4)).toBe("hors 4 sorties du parc");
  });
});

describe("detailTuileEnPanne — dont N avec une intervention ouverte", () => {
  it("zéro — phrase dédiée", () => {
    expect(detailTuileEnPanne(0)).toBe("Aucune avec une intervention ouverte");
  });

  it("au moins une", () => {
    expect(detailTuileEnPanne(3)).toBe("dont 3 avec une intervention ouverte");
  });
});

describe("detailTuileGarantie — fin de garantie sous N jours", () => {
  it("zéro — « Aucune sous N jours »", () => {
    expect(detailTuileGarantie(0, 90)).toBe("Aucune sous 90 jours");
  });

  it("au moins une — « fin de garantie sous N jours », jamais recopié ailleurs", () => {
    expect(detailTuileGarantie(5, 90)).toBe("fin de garantie sous 90 jours");
  });
});

import { describe, expect, it } from "vitest";

import { enDuree, enDureeHMS } from "@/lib/calendar/duree";

/**
 * L'ÉCRITURE UNIQUE D'UNE DURÉE (GR14, audit GR du 26/09/2026, constat G17) —
 * fonction pure, éprouvée seule ; `dureeCarteAffichee`
 * (`app/(back-office)/planning/carte.ts`) délègue ici pour tout ce qui n'est
 * pas son `null` de durée nulle ou inconnue (`tests/unit/planning/carte.test.ts`).
 */
describe("enDuree", () => {
  it("écrit les minutes seules sous une heure, SANS zéro devant", () => {
    expect(enDuree(0)).toBe("0 min");
    expect(enDuree(5)).toBe("5 min");
    expect(enDuree(45)).toBe("45 min");
  });

  it("écrit heures et minutes, les minutes toujours à deux chiffres", () => {
    expect(enDuree(65)).toBe("1 h 05");
    expect(enDuree(90)).toBe("1 h 30");
    expect(enDuree(690)).toBe("11 h 30");
  });

  it("écrit une heure ronde avec ses deux zéros", () => {
    expect(enDuree(120)).toBe("2 h 00");
  });

  it("ne borne pas les heures", () => {
    expect(enDuree(32_880)).toBe("548 h 00");
  });
});

/**
 * LE COMPTEUR QUI DÉFILE (9F4H5-TERRAIN-VIVANT, point 1) — `HH:MM:SS`, même
 * format que `timerText` de la maquette (`data-timer`).
 */
describe("enDureeHMS", () => {
  it("écrit heures, minutes et secondes, toujours à deux chiffres", () => {
    expect(enDureeHMS(0)).toBe("00:00:00");
    expect(enDureeHMS(5)).toBe("00:00:05");
    expect(enDureeHMS(65)).toBe("00:01:05");
    expect(enDureeHMS(3_661)).toBe("01:01:01");
  });

  it("ne borne pas les heures", () => {
    expect(enDureeHMS(360_000)).toBe("100:00:00");
  });

  it("tronque les fractions de seconde", () => {
    expect(enDureeHMS(1.9)).toBe("00:00:01");
  });

  it("n'est jamais négative", () => {
    expect(enDureeHMS(-120)).toBe("00:00:00");
  });
});

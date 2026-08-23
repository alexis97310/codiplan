import { describe, expect, it } from "vitest";

import {
  cleJour,
  ecartEnJours,
  joursDeLaSemaine,
  jourSemaineIso,
  lireCleJour,
  lundiDeLaSemaine,
  semaineIso,
  DIMANCHE,
  LUNDI,
  SAMEDI,
} from "@/lib/calendar";

/**
 * Semaines ISO 8601 (ticket L0-08, point 5 — « la semaine commence le lundi »).
 *
 * Les deux règles de la norme se tiennent ensemble : la semaine commence le
 * lundi, et la semaine 1 est celle qui contient le premier jeudi de l'année.
 * La seconde est ce qui rend la première cohérente au passage d'une année à
 * l'autre — sans elle, un indicateur hebdomadaire compterait des semaines de
 * deux jours en janvier.
 */

describe("jour de la semaine", () => {
  it("compte de 1 (lundi) à 7 (dimanche)", () => {
    expect(jourSemaineIso(lireCleJour("2026-08-17"))).toBe(LUNDI);
    expect(jourSemaineIso(lireCleJour("2026-08-22"))).toBe(SAMEDI);
    expect(jourSemaineIso(lireCleJour("2026-08-23"))).toBe(DIMANCHE);
  });

  it("le lundi de la semaine est bien un lundi, et jamais postérieur au jour", () => {
    for (const jour of joursDeLaSemaine(lireCleJour("2026-08-19"))) {
      const lundi = lundiDeLaSemaine(jour);
      expect(jourSemaineIso(lundi)).toBe(LUNDI);
      expect(cleJour(lundi)).toBe("2026-08-17");
    }
  });
});

describe("numéro de semaine", () => {
  it("numérote les semaines ordinaires", () => {
    expect(semaineIso(lireCleJour("2026-01-05"))).toEqual({
      annee: 2026,
      semaine: 2,
    });
    expect(semaineIso(lireCleJour("2026-08-21"))).toEqual({
      annee: 2026,
      semaine: 34,
    });
  });

  /**
   * Le 1er janvier 2027 est un vendredi : il appartient à la semaine 53 de
   * 2026. Rendre « semaine 1 » sans l'année ISO ferait basculer une journée
   * d'activité dans le mauvais exercice.
   */
  it("rend l'année ISO, qui n'est pas toujours l'année civile", () => {
    expect(semaineIso(lireCleJour("2027-01-01"))).toEqual({
      annee: 2026,
      semaine: 53,
    });
    expect(semaineIso(lireCleJour("2026-12-31"))).toEqual({
      annee: 2026,
      semaine: 53,
    });
  });

  it("le 4 janvier appartient toujours à la semaine 1", () => {
    // Propriété caractéristique de la norme, vraie quelle que soit l'année.
    for (const annee of [2024, 2025, 2026, 2027, 2028]) {
      expect(semaineIso({ annee, mois: 1, jour: 4 })).toEqual({
        annee,
        semaine: 1,
      });
    }
  });
});

describe("écart en jours", () => {
  it("franchit les mois, les années et les 29 février", () => {
    expect(
      ecartEnJours(lireCleJour("2026-12-31"), lireCleJour("2027-01-01")),
    ).toBe(1);
    expect(
      ecartEnJours(lireCleJour("2028-02-28"), lireCleJour("2028-03-01")),
    ).toBe(2);
  });
});

import { describe, expect, it } from "vitest";

import { libelleSemaine } from "@/app/(back-office)/planning/presentation";
import type { JourLocal } from "@/lib/calendar/fuseau";

/**
 * LE SOUS-TITRE DU PLANNING, DATE COMPLÈTE (TR-54, audit du 28/09/2026 ;
 * reformaté au gabarit de la maquette du 28/09 par 9EH-TP-UX-PL-PLANNING-1,
 * D190) — « Semaine 40 · 28/09 → 03/10 · 5 techniciens · 3 absences ».
 *
 * L'année ne s'écrit JAMAIS sur la première borne, et sur la seconde
 * seulement si la période n'est pas dans l'ANNÉE EN COURS (2e argument) —
 * ce n'est plus une comparaison entre les deux bornes elles-mêmes (D190).
 */

function semaine(...jours: readonly [number, number, number][]): JourLocal[] {
  return jours.map(([annee, mois, jour]) => ({ annee, mois, jour }));
}

describe("libelleSemaine", () => {
  it("semaine dans l'année en cours, à cheval sur deux mois : jour et mois complets, aucune année écrite", () => {
    const texte = libelleSemaine(
      semaine(
        [2026, 9, 28],
        [2026, 9, 29],
        [2026, 9, 30],
        [2026, 10, 1],
        [2026, 10, 2],
        [2026, 10, 3],
      ),
      2026,
      5,
      3,
    );
    expect(texte).toContain("28/09 → 03/10 ·");
    expect(texte).not.toContain("2026");
  });

  it("semaine entièrement dans le même mois, année en cours : aucune année écrite", () => {
    const texte = libelleSemaine(
      semaine(
        [2026, 9, 21],
        [2026, 9, 22],
        [2026, 9, 23],
        [2026, 9, 24],
        [2026, 9, 25],
        [2026, 9, 26],
      ),
      2026,
      5,
      3,
    );
    expect(texte).toContain("21/09 → 26/09 ·");
    expect(texte).not.toContain("2026");
  });

  it("semaine à cheval sur deux années, année en cours = 2026 : l'année s'ajoute à la seule seconde borne", () => {
    const texte = libelleSemaine(
      semaine(
        [2026, 12, 28],
        [2026, 12, 29],
        [2026, 12, 30],
        [2026, 12, 31],
        [2027, 1, 1],
        [2027, 1, 2],
      ),
      2026,
      5,
      3,
    );
    expect(texte).toContain("28/12 → 02/01/2027 ·");
  });

  it("le résumé technicien/absence suit la date, avec les mots accordés", () => {
    const texte = libelleSemaine(
      semaine(
        [2026, 9, 21],
        [2026, 9, 22],
        [2026, 9, 23],
        [2026, 9, 24],
        [2026, 9, 25],
        [2026, 9, 26],
      ),
      2026,
      1,
      0,
    );
    expect(texte).toContain("1 technicien · 0 absences");
  });
});

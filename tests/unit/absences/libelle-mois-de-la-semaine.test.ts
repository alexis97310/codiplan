import { describe, expect, it } from "vitest";

import { libelleMoisDeLaSemaine } from "@/app/(back-office)/absences/presentation";
import type { JourLocal } from "@/lib/calendar/fuseau";

/**
 * LE TITRE DU CALENDRIER DES ABSENCES SUR UNE SEMAINE À CHEVAL (TR-7, audit
 * du 28/09/2026) — `libelleMoisAnnee` ne lisait que le PREMIER jour affiché :
 * une semaine à cheval sur deux mois se voyait attribuer le mois du lundi
 * seul, alors que le calendrier montre bien les jours de l'autre mois.
 */

function semaine(...jours: readonly [number, number, number][]): JourLocal[] {
  return jours.map(([annee, mois, jour]) => ({ annee, mois, jour }));
}

describe("libelleMoisDeLaSemaine", () => {
  it("semaine entièrement dans le même mois : inchangé", () => {
    const texte = libelleMoisDeLaSemaine(
      semaine(
        [2026, 9, 21],
        [2026, 9, 22],
        [2026, 9, 23],
        [2026, 9, 24],
        [2026, 9, 25],
        [2026, 9, 26],
        [2026, 9, 27],
      ),
    );
    expect(texte).toBe("Septembre 2026");
  });

  it("semaine à cheval sur deux mois de la même année : les deux mois", () => {
    const texte = libelleMoisDeLaSemaine(
      semaine(
        [2026, 9, 28],
        [2026, 9, 29],
        [2026, 9, 30],
        [2026, 10, 1],
        [2026, 10, 2],
        [2026, 10, 3],
        [2026, 10, 4],
      ),
    );
    expect(texte).toBe("Septembre – Octobre 2026");
  });

  it("semaine à cheval sur deux années : les deux mois et les deux années", () => {
    const texte = libelleMoisDeLaSemaine(
      semaine(
        [2026, 12, 28],
        [2026, 12, 29],
        [2026, 12, 30],
        [2026, 12, 31],
        [2027, 1, 1],
        [2027, 1, 2],
        [2027, 1, 3],
      ),
    );
    expect(texte).toBe("Décembre 2026 – Janvier 2027");
  });
});

import { describe, expect, it } from "vitest";

import { libelleSemaine } from "@/app/(back-office)/planning/presentation";
import type { JourLocal } from "@/lib/calendar/fuseau";

/**
 * LE SOUS-TITRE DU PLANNING, DATE COMPLÈTE (TR-54, audit du 28/09/2026) —
 * mesuré fautif sur `main` : « Semaine 40 — du 28 au 3/10/2026 » (premier
 * jour sans mois, dernier jour non complété à deux chiffres).
 */

function semaine(...jours: readonly [number, number, number][]): JourLocal[] {
  return jours.map(([annee, mois, jour]) => ({ annee, mois, jour }));
}

describe("libelleSemaine", () => {
  it("semaine dans le même mois à cheval sur deux mois : jour et mois complets, année une seule fois", () => {
    const texte = libelleSemaine(
      semaine(
        [2026, 9, 28],
        [2026, 9, 29],
        [2026, 9, 30],
        [2026, 10, 1],
        [2026, 10, 2],
        [2026, 10, 3],
      ),
    );
    expect(texte).toContain("du 28/09 au 03/10/2026");
  });

  it("semaine entièrement dans le même mois : année une seule fois", () => {
    const texte = libelleSemaine(
      semaine(
        [2026, 9, 21],
        [2026, 9, 22],
        [2026, 9, 23],
        [2026, 9, 24],
        [2026, 9, 25],
        [2026, 9, 26],
      ),
    );
    expect(texte).toContain("du 21/09 au 26/09/2026");
  });

  it("semaine à cheval sur deux années : l'année sur les deux bornes", () => {
    const texte = libelleSemaine(
      semaine(
        [2026, 12, 28],
        [2026, 12, 29],
        [2026, 12, 30],
        [2026, 12, 31],
        [2027, 1, 1],
        [2027, 1, 2],
      ),
    );
    expect(texte).toContain("du 28/12/2026 au 02/01/2027");
  });
});

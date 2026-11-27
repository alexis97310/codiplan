import { describe, expect, it } from "vitest";

import { versLocal, jourDe, type JourLocal } from "@/lib/calendar/fuseau";
import { pretEnRetard, type LignePretPourRetard } from "@/lib/prets/retard";

/**
 * « EN RETARD » POUR UN PRÊT (9L60-PRET-1-MODELE) — même discipline que
 * `tests/unit/interventions/retard.test.ts` : `pretEnRetard` ne lit ni la
 * base ni l'horloge, `aujourdhuiLocal` est fourni.
 */

const NOUMEA = "Pacific/Noumea";

function jour(annee: number, mois: number, jourDuMois: number): JourLocal {
  return { annee, mois, jour: jourDuMois };
}

/** Une colonne `@db.Date` pour ce jour civil — minuit UTC, sans fuseau. */
function dateDe(annee: number, mois: number, jourDuMois: number): Date {
  return new Date(Date.UTC(annee, mois - 1, jourDuMois));
}

const AUJOURDHUI = jour(2026, 11, 28);

function ligne(partiel: Partial<LignePretPourRetard>): LignePretPourRetard {
  return {
    dateRetourPrevue: dateDe(2026, 11, 27),
    dateRetourReelle: null,
    ...partiel,
  };
}

describe("pretEnRetard — en cours, retour prévu dépassé", () => {
  it("la veille, en cours : en retard", () => {
    expect(
      pretEnRetard(
        ligne({ dateRetourPrevue: dateDe(2026, 11, 27) }),
        AUJOURDHUI,
      ),
    ).toBe(true);
  });

  it("aujourd'hui : jamais en retard le jour même", () => {
    expect(
      pretEnRetard(
        ligne({ dateRetourPrevue: dateDe(2026, 11, 28) }),
        AUJOURDHUI,
      ),
    ).toBe(false);
  });

  it("demain : pas encore en retard", () => {
    expect(
      pretEnRetard(
        ligne({ dateRetourPrevue: dateDe(2026, 11, 29) }),
        AUJOURDHUI,
      ),
    ).toBe(false);
  });

  it("déjà retourné : jamais en retard, même avec un retour prévu dépassé", () => {
    expect(
      pretEnRetard(
        ligne({
          dateRetourPrevue: dateDe(2026, 11, 27),
          dateRetourReelle: dateDe(2026, 11, 28),
        }),
        AUJOURDHUI,
      ),
    ).toBe(false);
  });

  it("le piège du fuseau UTC+11 : le jour local n'est pas le jour UTC entre 0 h et 11 h à Nouméa", () => {
    // 27/11 20h00 UTC = 28/11 07h00 à Nouméa (+11h) — même piège que
    // tests/unit/interventions/retard.test.ts.
    const instant = new Date("2026-11-27T20:00:00.000Z");
    const aujourdhuiLocal = jourDe(versLocal(instant, NOUMEA));
    expect(aujourdhuiLocal).toEqual(jour(2026, 11, 28));

    expect(
      pretEnRetard(
        ligne({ dateRetourPrevue: dateDe(2026, 11, 27) }),
        aujourdhuiLocal,
      ),
    ).toBe(true);
  });
});

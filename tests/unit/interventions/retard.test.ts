import { describe, expect, it } from "vitest";

import { versLocal, jourDe, type JourLocal } from "@/lib/calendar/fuseau";
import { enRetard, type LigneEnRetard } from "@/lib/interventions/retard";

/**
 * « EN RETARD » (bug 8 de l'audit d'ergonomie du 27/09/2026 ; §6, CA-5).
 *
 * `enRetard` ne lit ni la base ni l'horloge : `aujourdhuiLocal` est fourni,
 * exactement comme l'appelant le ferait depuis `maintenant(fuseauDeLAgence)`.
 */

const NOUMEA = "Pacific/Noumea";

function jour(annee: number, mois: number, jour: number): JourLocal {
  return { annee, mois, jour };
}

/** Une colonne `@db.Date` pour ce jour civil — minuit UTC, sans fuseau. */
function datePlanifieeDe(
  annee: number,
  mois: number,
  jourDuMois: number,
): Date {
  return new Date(Date.UTC(annee, mois - 1, jourDuMois));
}

const AUJOURDHUI = jour(2026, 9, 28);

function ligne(partiel: Partial<LigneEnRetard>): LigneEnRetard {
  return {
    statut: "planifiee",
    datePlanifiee: datePlanifieeDe(2026, 9, 27),
    aDesSegments: false,
    ...partiel,
  };
}

describe("enRetard — planifiée ou affectée, la date passée, aucun segment", () => {
  it("la veille, planifiée, sans segment : en retard", () => {
    expect(
      enRetard(
        ligne({
          statut: "planifiee",
          datePlanifiee: datePlanifieeDe(2026, 9, 27),
        }),
        AUJOURDHUI,
      ),
    ).toBe(true);
  });

  it("affectée aussi bien que planifiée", () => {
    expect(
      enRetard(
        ligne({
          statut: "affectee",
          datePlanifiee: datePlanifieeDe(2026, 9, 27),
        }),
        AUJOURDHUI,
      ),
    ).toBe(true);
  });

  it("aujourd'hui : jamais en retard le jour même", () => {
    expect(
      enRetard(
        ligne({ datePlanifiee: datePlanifieeDe(2026, 9, 28) }),
        AUJOURDHUI,
      ),
    ).toBe(false);
  });

  it("demain : pas encore en retard", () => {
    expect(
      enRetard(
        ligne({ datePlanifiee: datePlanifieeDe(2026, 9, 29) }),
        AUJOURDHUI,
      ),
    ).toBe(false);
  });

  it("démarrée — au moins un segment — n'est plus en retard", () => {
    expect(
      enRetard(
        ligne({
          datePlanifiee: datePlanifieeDe(2026, 9, 27),
          aDesSegments: true,
        }),
        AUJOURDHUI,
      ),
    ).toBe(false);
  });

  it("reprise après un segment : le statut redevient planifiée mais un segment existe déjà — pas en retard", () => {
    // `statutALaCreation` (cycle-de-vie.ts) fait retomber une reprise à
    // `planifiee` même après du travail réel (L2-10) : c'est exactement le
    // cas que `aDesSegments` doit rattraper, pas le statut.
    expect(
      enRetard(
        ligne({
          statut: "planifiee",
          datePlanifiee: datePlanifieeDe(2026, 9, 27),
          aDesSegments: true,
        }),
        AUJOURDHUI,
      ),
    ).toBe(false);
  });

  it("annulée : jamais en retard, quel que soit le segment", () => {
    expect(
      enRetard(
        ligne({
          statut: "annulee",
          datePlanifiee: datePlanifieeDe(2026, 9, 27),
        }),
        AUJOURDHUI,
      ),
    ).toBe(false);
  });

  it("terminée : jamais en retard", () => {
    expect(
      enRetard(
        ligne({
          statut: "terminee",
          datePlanifiee: datePlanifieeDe(2026, 9, 27),
        }),
        AUJOURDHUI,
      ),
    ).toBe(false);
  });

  it("sans date : jamais en retard (file d'attente)", () => {
    expect(enRetard(ligne({ datePlanifiee: null }), AUJOURDHUI)).toBe(false);
  });

  it("le piège du fuseau UTC+11 : le jour local n'est pas le jour UTC entre 0 h et 11 h à Nouméa", () => {
    // 27/09 20h00 UTC = 28/09 07h00 à Nouméa (+11h) — l'horloge UTC du
    // serveur affiche encore le 27, alors qu'à Nouméa le 28 est déjà entamé
    // depuis sept heures. Une comparaison qui lirait `datePlanifiee` contre
    // le jour UTC de cet instant, au lieu du jour LOCAL de l'agence, dirait
    // à tort que le 27 n'est pas encore passé.
    const instant = new Date("2026-09-27T20:00:00.000Z");
    const aujourdhuiLocal = jourDe(versLocal(instant, NOUMEA));
    expect(aujourdhuiLocal).toEqual(jour(2026, 9, 28));

    expect(
      enRetard(
        ligne({ datePlanifiee: datePlanifieeDe(2026, 9, 27) }),
        aujourdhuiLocal,
      ),
    ).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import type { JourLocal } from "@/lib/calendar/fuseau";

import { lundiDeLaSemainePasseeOuvert } from "../e2e/setup/scene";

/**
 * GARDIEN DE 9I000A-REPRISE-9I000.
 *
 * Mesuré le 04/11/2026 : `tests/e2e/9f5b-date-passee.spec.ts` et
 * `tests/audit-fonctionnel/parcours-edge.spec.ts` visaient encore
 * `jourSuivant(reperes.lundi, -7)` — un jour passé relatif à la SCÈNE, pas à
 * AUJOURD'HUI. Dès que `lundiSansJourFerie` (9I000) avance `reperes.lundi`
 * d'une semaine pour fuir un jour férié, ce lundi cesse d'être strictement
 * passé. `lundiDeLaSemainePasseeOuvert` calcule, lui, toujours depuis
 * AUJOURD'HUI.
 */
describe("lundiDeLaSemainePasseeOuvert", () => {
  it("exécutée un lundi : rend le lundi de la semaine qui précède", () => {
    const lundi: JourLocal = { annee: 2026, mois: 11, jour: 9 };
    expect(lundiDeLaSemainePasseeOuvert(lundi, new Set())).toEqual({
      annee: 2026,
      mois: 11,
      jour: 2,
    });
  });

  it("exécutée un mardi : rend le lundi de la semaine passée, pas celui de la semaine courante", () => {
    const mardi: JourLocal = { annee: 2026, mois: 11, jour: 10 };
    expect(lundiDeLaSemainePasseeOuvert(mardi, new Set())).toEqual({
      annee: 2026,
      mois: 11,
      jour: 2,
    });
  });

  it("un lendemain de férié : recule autant de semaines que nécessaire, même à travers deux fériés qui se suivent et une fin d'année", () => {
    // Le 01/01/2024 est un LUNDI (Jour de l'An). AUJOURD'HUI, le 02/01/2024
    // (lendemain du férié), le lundi de la semaine courante est le 01/01 lui
    // même — strictement passé de sept jours plus loin, le 25/12/2023, est
    // Noël : un SECOND férié qui enchaîne sur le premier, de part et d'autre
    // de la bascule d'année.
    const lendemainDuFerie: JourLocal = { annee: 2024, mois: 1, jour: 2 };
    const feries = new Set(["2024-01-01", "2023-12-25"]);
    expect(lundiDeLaSemainePasseeOuvert(lendemainDuFerie, feries)).toEqual({
      annee: 2023,
      mois: 12,
      jour: 18,
    });
  });

  it("ne change rien avec une liste de fériés vide", () => {
    const lundi: JourLocal = { annee: 2026, mois: 11, jour: 16 };
    expect(lundiDeLaSemainePasseeOuvert(lundi, new Set())).toEqual({
      annee: 2026,
      mois: 11,
      jour: 9,
    });
  });

  it("est bornée : une liste de fériés qui couvre toutes les semaines lève plutôt que boucler", () => {
    const toutEstFerie = new Set<string>();
    for (let annee = 2018; annee <= 2026; annee += 1) {
      for (let mois = 1; mois <= 12; mois += 1) {
        for (let jour = 1; jour <= 31; jour += 1) {
          toutEstFerie.add(
            `${String(annee).padStart(4, "0")}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`,
          );
        }
      }
    }
    const lundi: JourLocal = { annee: 2026, mois: 11, jour: 9 };
    expect(() => lundiDeLaSemainePasseeOuvert(lundi, toutEstFerie)).toThrow(
      /104 semaines/,
    );
  });
});

import { describe, expect, it } from "vitest";

import {
  comparerHistorique,
  type LigneHistoriqueTriable,
} from "@/lib/interventions/depot";

/**
 * LE COMPARATEUR DE L'HISTORIQUE D'UN CLIENT OU D'UN SITE
 * (TP-A1-HISTORIQUES-CLIENT-SITE, décision d'Alexis du 28/09/2026, ~20h10 NC,
 * CS29/CS9) — LA RÈGLE ÉPROUVÉE SANS BASE, EN MÉMOIRE.
 *
 * `dernieresInterventionsDuSite`/`dernieresInterventionsDuClient` tiennent
 * cette même règle en DEUX requêtes SQL (voir leur docblock) ; les scénarios
 * d'isolation (`tests/isolation/historique-site-borne.test.ts`,
 * `historique-client-pagination.test.ts`) confrontent LEUR résultat à ce
 * comparateur. Ce fichier n'éprouve que la règle elle-même.
 */

const BASE: LigneHistoriqueTriable = {
  id: "aaaaaaaa-0000-7000-8000-000000000000",
  statut: "a_planifier",
  priorite: "p3",
  date_planifiee: null,
  cree_le: new Date("2026-01-01T00:00:00Z"),
};

function ligne(
  partiel: Partial<LigneHistoriqueTriable>,
): LigneHistoriqueTriable {
  return { ...BASE, ...partiel };
}

describe("comparerHistorique (TP-A1)", () => {
  it("une OUVERTE sans date passe TOUJOURS avant une DATÉE, quelle que soit la date", () => {
    const ouverte = ligne({
      id: "a",
      statut: "a_planifier",
      date_planifiee: null,
    });
    const datee = ligne({
      id: "b",
      statut: "planifiee",
      date_planifiee: new Date("2099-01-01"),
    });
    expect(comparerHistorique(ouverte, datee)).toBeLessThan(0);
    expect(comparerHistorique(datee, ouverte)).toBeGreaterThan(0);
  });

  it("une FERMÉE sans date (annulée, clôturée, terminée) n'est JAMAIS en tête — elle suit les datées", () => {
    for (const statut of ["annulee", "cloturee", "terminee"] as const) {
      const fermeeSansDate = ligne({ id: "a", statut, date_planifiee: null });
      const ouverteSansDate = ligne({
        id: "b",
        statut: "a_planifier",
        date_planifiee: null,
      });
      const datee = ligne({
        id: "c",
        statut: "planifiee",
        date_planifiee: new Date("2020-01-01"),
      });
      // La fermée sans date suit l'ouverte sans date...
      expect(
        comparerHistorique(fermeeSansDate, ouverteSansDate),
      ).toBeGreaterThan(0);
      // ...et suit aussi une datée, même ancienne : elle ferme le second groupe.
      expect(comparerHistorique(fermeeSansDate, datee)).toBeGreaterThan(0);
      expect(comparerHistorique(datee, fermeeSansDate)).toBeLessThan(0);
    }
  });

  it("parmi les OUVERTES sans date, la PLUS URGENTE (p1) passe avant une moins urgente (p4)", () => {
    const p1 = ligne({ id: "a", priorite: "p1" });
    const p4 = ligne({ id: "b", priorite: "p4" });
    expect(comparerHistorique(p1, p4)).toBeLessThan(0);
    expect(comparerHistorique(p4, p1)).toBeGreaterThan(0);
  });

  it("à URGENCE ÉGALE, la plus ANCIENNE (cree_le le plus petit) passe avant", () => {
    const ancienne = ligne({ id: "a", cree_le: new Date("2026-01-01") });
    const recente = ligne({ id: "b", cree_le: new Date("2026-06-01") });
    expect(comparerHistorique(ancienne, recente)).toBeLessThan(0);
    expect(comparerHistorique(recente, ancienne)).toBeGreaterThan(0);
  });

  it("à urgence et ancienneté ÉGALES, l'id le plus petit (croissant) passe avant", () => {
    const a = ligne({ id: "aaaaaaaa-0000-7000-8000-000000000001" });
    const b = ligne({ id: "aaaaaaaa-0000-7000-8000-000000000002" });
    expect(comparerHistorique(a, b)).toBeLessThan(0);
    expect(comparerHistorique(b, a)).toBeGreaterThan(0);
  });

  it("parmi le RESTE (datées ou fermées sans date), la date la plus RÉCENTE passe avant", () => {
    const recente = ligne({
      id: "a",
      statut: "planifiee",
      date_planifiee: new Date("2099-01-01"),
    });
    const ancienne = ligne({
      id: "b",
      statut: "planifiee",
      date_planifiee: new Date("2020-01-01"),
    });
    expect(comparerHistorique(recente, ancienne)).toBeLessThan(0);
    expect(comparerHistorique(ancienne, recente)).toBeGreaterThan(0);
  });

  it("dans le RESTE, à date égale l'id le plus GRAND (décroissant) passe avant", () => {
    const meme = new Date("2050-01-01");
    const a = ligne({
      id: "aaaaaaaa-0000-7000-8000-000000000001",
      statut: "planifiee",
      date_planifiee: meme,
    });
    const b = ligne({
      id: "aaaaaaaa-0000-7000-8000-000000000002",
      statut: "planifiee",
      date_planifiee: meme,
    });
    expect(comparerHistorique(b, a)).toBeLessThan(0);
    expect(comparerHistorique(a, b)).toBeGreaterThan(0);
  });

  it("une scène triée par ce comparateur place les ouvertes sans date en tête, ordonnées par urgence puis ancienneté", () => {
    const scene: readonly LigneHistoriqueTriable[] = [
      ligne({
        id: "datee-recente",
        statut: "planifiee",
        date_planifiee: new Date("2099-01-01"),
      }),
      ligne({
        id: "fermee-sans-date",
        statut: "annulee",
        date_planifiee: null,
      }),
      ligne({
        id: "ouverte-p4-ancienne",
        statut: "a_planifier",
        priorite: "p4",
        cree_le: new Date("2026-01-01"),
      }),
      ligne({
        id: "ouverte-p1-recente",
        statut: "a_planifier",
        priorite: "p1",
        cree_le: new Date("2026-06-01"),
      }),
      ligne({
        id: "datee-ancienne",
        statut: "terminee",
        date_planifiee: new Date("2020-01-01"),
      }),
    ];
    const triee = [...scene].sort(comparerHistorique).map((l) => l.id);
    expect(triee).toEqual([
      "ouverte-p1-recente",
      "ouverte-p4-ancienne",
      "datee-recente",
      "datee-ancienne",
      "fermee-sans-date",
    ]);
  });
});

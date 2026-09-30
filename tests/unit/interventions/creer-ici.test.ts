import { describe, expect, it } from "vitest";

import type { JourLocal } from "@/lib/calendar/fuseau";
import {
  caseDepuisParametres,
  hrefCreerIci,
  parametresDeLaCase,
  type CaseDePlanning,
} from "@/lib/interventions/creer-ici";

const TECHNICIEN_ID = "01927e6b-9a1d-7c3e-8d4a-3f2b1c0a9e8d";
const JOUR: JourLocal = { annee: 2026, mois: 11, jour: 3 };

describe("hrefCreerIci", () => {
  it("compose l'URL sans heure", () => {
    expect(
      hrefCreerIci({ technicienId: TECHNICIEN_ID, jour: JOUR, minutes: null }),
    ).toBe(
      `/interventions/nouvelle?poser_technicien=${TECHNICIEN_ID}&poser_date=2026-11-03`,
    );
  });

  it("compose l'URL avec l'heure, seulement si elle est connue", () => {
    expect(
      hrefCreerIci({ technicienId: TECHNICIEN_ID, jour: JOUR, minutes: 555 }),
    ).toBe(
      `/interventions/nouvelle?poser_technicien=${TECHNICIEN_ID}&poser_date=2026-11-03&poser_heure=555`,
    );
  });
});

describe("caseDepuisParametres", () => {
  it("lit une case complète", () => {
    expect(
      caseDepuisParametres({
        poser_technicien: TECHNICIEN_ID,
        poser_date: "2026-11-03",
        poser_heure: "555",
      }),
    ).toEqual({ technicienId: TECHNICIEN_ID, jour: JOUR, minutes: 555 });
  });

  it("lit une case sans heure", () => {
    expect(
      caseDepuisParametres({
        poser_technicien: TECHNICIEN_ID,
        poser_date: "2026-11-03",
      }),
    ).toEqual({ technicienId: TECHNICIEN_ID, jour: JOUR, minutes: null });
  });

  it("rend null sans technicien UUID valide", () => {
    expect(
      caseDepuisParametres({
        poser_technicien: "pas-un-uuid",
        poser_date: "2026-11-03",
      }),
    ).toBeNull();
    expect(caseDepuisParametres({ poser_date: "2026-11-03" })).toBeNull();
    expect(
      caseDepuisParametres({
        poser_technicien: [TECHNICIEN_ID],
        poser_date: "2026-11-03",
      }),
    ).toBeNull();
  });

  it("rend null sans date réelle — le 31 février est refusé", () => {
    expect(
      caseDepuisParametres({
        poser_technicien: TECHNICIEN_ID,
        poser_date: "2026-02-31",
      }),
    ).toBeNull();
    expect(
      caseDepuisParametres({
        poser_technicien: TECHNICIEN_ID,
        poser_date: "pas-une-date",
      }),
    ).toBeNull();
    expect(
      caseDepuisParametres({ poser_technicien: TECHNICIEN_ID }),
    ).toBeNull();
  });

  it("l'heure invalide retombe à null, sans rejeter la case (L1-02f)", () => {
    expect(
      caseDepuisParametres({
        poser_technicien: TECHNICIEN_ID,
        poser_date: "2026-11-03",
        poser_heure: "-1",
      }),
    ).toEqual({ technicienId: TECHNICIEN_ID, jour: JOUR, minutes: null });
    expect(
      caseDepuisParametres({
        poser_technicien: TECHNICIEN_ID,
        poser_date: "2026-11-03",
        poser_heure: "1440",
      }),
    ).toEqual({ technicienId: TECHNICIEN_ID, jour: JOUR, minutes: null });
    expect(
      caseDepuisParametres({
        poser_technicien: TECHNICIEN_ID,
        poser_date: "2026-11-03",
        poser_heure: "abc",
      }),
    ).toEqual({ technicienId: TECHNICIEN_ID, jour: JOUR, minutes: null });
    expect(
      caseDepuisParametres({
        poser_technicien: TECHNICIEN_ID,
        poser_date: "2026-11-03",
        poser_heure: [],
      }),
    ).toEqual({ technicienId: TECHNICIEN_ID, jour: JOUR, minutes: null });
  });

  it("ignore les tableaux et chaînes vides", () => {
    expect(
      caseDepuisParametres({
        poser_technicien: TECHNICIEN_ID,
        poser_date: [],
      }),
    ).toBeNull();
    expect(
      caseDepuisParametres({
        poser_technicien: "",
        poser_date: "2026-11-03",
      }),
    ).toBeNull();
  });
});

describe("parametresDeLaCase", () => {
  it("rend les paires poser_*", () => {
    expect(
      parametresDeLaCase({
        technicienId: TECHNICIEN_ID,
        jour: JOUR,
        minutes: 555,
      }),
    ).toEqual({
      poser_technicien: TECHNICIEN_ID,
      poser_date: "2026-11-03",
      poser_heure: "555",
    });
  });

  it("sans case, aucun paramètre — la redirection reste ?cree=1", () => {
    expect(parametresDeLaCase(null)).toEqual({});
  });

  it("l'aller-retour reproduit la case exacte", () => {
    const cas: readonly CaseDePlanning[] = [
      { technicienId: TECHNICIEN_ID, jour: JOUR, minutes: 555 },
      { technicienId: TECHNICIEN_ID, jour: JOUR, minutes: null },
    ];
    for (const c of cas) {
      expect(caseDepuisParametres(parametresDeLaCase(c))).toEqual(c);
    }
  });
});

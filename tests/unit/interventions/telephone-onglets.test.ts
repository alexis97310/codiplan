import { describe, expect, it } from "vitest";

import {
  ongletTelephone,
  voletDepuisParametre,
} from "@/lib/interventions/affichage";

/**
 * LES TROIS ONGLETS DU TÉLÉPHONE (PG-D4-TELEPHONE-ONGLETS, D146) — deux
 * fonctions PURES, testées ici avant toute trace de JSX : `voletDepuisParametre`
 * lit `?volet=`, `ongletTelephone` en déduit l'onglet actif.
 */
describe("voletDepuisParametre", () => {
  it("reconnaît « a_traiter »", () => {
    expect(voletDepuisParametre("a_traiter")).toBe("a_traiter");
  });

  it("rend null pour toute autre valeur — absente, tableau, casse différente (L1-02f)", () => {
    expect(voletDepuisParametre(undefined)).toBeNull();
    expect(voletDepuisParametre(["a_traiter"])).toBeNull();
    expect(voletDepuisParametre("A_TRAITER")).toBeNull();
    expect(voletDepuisParametre("semaine")).toBeNull();
    expect(voletDepuisParametre("")).toBeNull();
  });
});

describe("ongletTelephone", () => {
  it("rend « a_traiter » quelle que soit la vue, dès que le volet le dit", () => {
    expect(ongletTelephone("semaine", "a_traiter")).toBe("a_traiter");
    expect(ongletTelephone("jour", "a_traiter")).toBe("a_traiter");
    expect(ongletTelephone("deux_semaines", "a_traiter")).toBe("a_traiter");
    expect(ongletTelephone("mois", "a_traiter")).toBe("a_traiter");
  });

  it("rend « aujourdhui » pour la vue jour, sans volet", () => {
    expect(ongletTelephone("jour", null)).toBe("aujourdhui");
  });

  it("rend « semaine » pour toute autre vue, sans volet", () => {
    expect(ongletTelephone("semaine", null)).toBe("semaine");
    expect(ongletTelephone("deux_semaines", null)).toBe("semaine");
    expect(ongletTelephone("mois", null)).toBe("semaine");
  });
});

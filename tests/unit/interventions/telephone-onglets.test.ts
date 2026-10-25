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

  it("rend « semaine » pour la vue semaine, sans volet", () => {
    expect(ongletTelephone("semaine", null)).toBe("semaine");
  });

  // 9G4-PLANNING-JOUR-ET-MOIS, point 8 — REVIENT sur « rend "semaine" pour
  // toute autre vue » : Mois et « 2 semaines » allumaient l'onglet « Semaine »
  // à tort, une vue qu'elles ne sont pas. Aucun des trois onglets du
  // téléphone ne les couvre : aucun ne s'allume.
  it("ne rend AUCUN onglet pour Mois ou « 2 semaines », sans volet (9G4, point 8)", () => {
    expect(ongletTelephone("deux_semaines", null)).toBeNull();
    expect(ongletTelephone("mois", null)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import {
  dureeCarteAffichee,
  siteDeLaCarte,
} from "@/app/(back-office)/planning/carte";

/**
 * CE QU'UNE CARTE DE PLANNING DIT EN PLUS DE L'HEURE ET DU CLIENT (PLANNING-2).
 *
 * Deux fonctions pures, éprouvées seules : le rendu de la carte lui-même
 * (site, heure de début, silence sur une durée nulle) est éprouvé à travers
 * l'écran par `tests/e2e/planning-largeur-et-carte.spec.ts`.
 */
describe("siteDeLaCarte", () => {
  it("compose le mot imposé et le libellé du site", () => {
    expect(siteDeLaCarte({ libelle: "Boulari" })).toBe("Site Boulari");
  });
});

describe("dureeCarteAffichee", () => {
  it("rend `null` pour une durée nulle — jamais un zéro affiché", () => {
    expect(dureeCarteAffichee(0)).toBeNull();
  });

  it("rend `null` pour une durée négative", () => {
    expect(dureeCarteAffichee(-5)).toBeNull();
  });

  it("rend les minutes seules sous une heure", () => {
    expect(dureeCarteAffichee(45)).toBe("45 min");
  });

  it("rend l'heure et les minutes, minutes sur deux chiffres", () => {
    expect(dureeCarteAffichee(90)).toBe("1 h 30");
    expect(dureeCarteAffichee(65)).toBe("1 h 05");
  });

  it("rend une heure ronde avec ses minutes à zéro", () => {
    expect(dureeCarteAffichee(120)).toBe("2 h 00");
  });
});

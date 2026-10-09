import { describe, expect, it } from "vitest";

import { ongletVide } from "../../../app/(back-office)/demandes/presentation";

/**
 * 9EDZ-DEMANDES-CONNEXION-MAQUETTE, partie 1 (D188) — LEQUEL DES DEUX ÉTATS
 * VIDES S'APPLIQUE.
 *
 * Pure, sans base ni rendu : le jeu partagé de CODIMA-NC ne garantit aucun
 * compte sans demande ouverte pour une épreuve de bout en bout (mémoire du
 * poste), donc cette décision se vérifie ICI plutôt qu'à l'écran.
 */
describe("ongletVide", () => {
  it("« À traiter » vide quand l'onglet actif est à zéro, quel que soit « Traitées »", () => {
    expect(ongletVide("a_traiter", 0, 12)).toBe("a_traiter");
    expect(ongletVide("a_traiter", 0, 0)).toBe("a_traiter");
  });

  it("« Traitées » vide quand l'onglet actif est à zéro, quel que soit « À traiter »", () => {
    expect(ongletVide("traitees", 7, 0)).toBe("traitees");
    expect(ongletVide("traitees", 0, 0)).toBe("traitees");
  });

  it("aucun état vide quand l'onglet actif porte au moins une ligne", () => {
    expect(ongletVide("a_traiter", 3, 0)).toBeNull();
    expect(ongletVide("traitees", 0, 5)).toBeNull();
  });

  it("ne juge jamais l'onglet INACTIF — seul son propre total compte", () => {
    // « À traiter » à zéro ne rend jamais « traitees », et réciproquement :
    // les deux variables qui gardent l'ordre de la file ne se substituent
    // jamais l'une à l'autre (§9, 01/09).
    expect(ongletVide("traitees", 0, 4)).toBe(null);
    expect(ongletVide("a_traiter", 4, 0)).toBe(null);
  });
});

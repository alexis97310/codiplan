import { describe, expect, it } from "vitest";

import { trierReglagesAgences } from "@/app/(back-office)/parametres/agences/composants";

/**
 * LISTES-1 PUIS INACTIVES EN FIN (AGENCE-2, TP-A6-TRIS-MISE-EN-PAGE,
 * 30/09/2026, PA-27) — `trierReglagesAgences` est extraite du rendu de
 * `/parametres/agences` précisément pour être éprouvée SANS base.
 *
 * Le jeu est fabriqué PAR CE TEST — aucune ligne de semis (I9).
 */
describe("trierReglagesAgences (AGENCE-2, TP-A6)", () => {
  const reglage = (libelle: string, actif: boolean) => ({
    agence: { libelle, actif },
  });

  it("range par ordre alphanumérique croissant, insensible à la casse et aux accents", () => {
    const entree = [
      reglage("TPA6-Koné", true),
      reglage("TPA6-Anse Vata", true),
      reglage("TPA6-dolbeau", true),
    ];

    expect(trierReglagesAgences(entree).map((r) => r.agence.libelle)).toEqual([
      "TPA6-Anse Vata",
      "TPA6-dolbeau",
      "TPA6-Koné",
    ]);
  });

  it("« Site 2 » avant « Site 10 » — numérique, jamais lexicographique", () => {
    const entree = [
      reglage("TPA6-Site 10", true),
      reglage("TPA6-Site 2", true),
    ];

    expect(trierReglagesAgences(entree).map((r) => r.agence.libelle)).toEqual([
      "TPA6-Site 2",
      "TPA6-Site 10",
    ]);
  });

  it("les INACTIVES passent en fin de liste, l'ordre alphanumérique gardé dans chaque groupe", () => {
    const entree = [
      reglage("TPA6-Zoulou (inactive)", false),
      reglage("TPA6-Alpha (active)", true),
      reglage("TPA6-Bravo (inactive)", false),
      reglage("TPA6-Charlie (active)", true),
    ];

    expect(trierReglagesAgences(entree).map((r) => r.agence.libelle)).toEqual([
      "TPA6-Alpha (active)",
      "TPA6-Charlie (active)",
      "TPA6-Bravo (inactive)",
      "TPA6-Zoulou (inactive)",
    ]);
  });
});

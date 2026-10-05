import { describe, expect, it } from "vitest";

import {
  trierLesTechniciens,
  type LigneTechnicien,
} from "@/lib/techniciens/depot";

/**
 * LISTES-1 — L'ÉQUIPE SE TRIE PAR NOM (TP-A6-TRIS-MISE-EN-PAGE, 30/09/2026).
 *
 * Choix du pilote : par NOM, pas par le couple agence-puis-nom que
 * `orderBy` posait avant ce ticket. `trierLesTechniciens` est extraite du
 * dépôt précisément pour être éprouvée SANS base.
 *
 * Le jeu est fabriqué PAR CE TEST — aucune ligne de semis (I9).
 */
describe("trierLesTechniciens (ÉQUIPE, LISTES-1, TP-A6)", () => {
  const ligne = (nom: string, utilisateurId: string): LigneTechnicien => ({
    utilisateurId,
    nom,
    email: `${utilisateurId}@example.test`,
    agenceId: "0192f0a0-0000-7000-8000-0000000000ag",
    agenceLibelle: "TPA6-Agence",
    actif: true,
    statutRessource: null,
  });

  it("range par NOM, insensible à la casse et aux accents — jamais par agence", () => {
    const entree = [
      ligne("TPA6-Étienne Weber", "0192f0a0-0000-7000-8000-00000000t1"),
      ligne("TPA6-alain Tein", "0192f0a0-0000-7000-8000-00000000t2"),
      ligne("TPA6-Zoé Pwädi", "0192f0a0-0000-7000-8000-00000000t3"),
    ];

    expect(trierLesTechniciens(entree).map((t) => t.nom)).toEqual([
      "TPA6-alain Tein",
      "TPA6-Étienne Weber",
      "TPA6-Zoé Pwädi",
    ]);
  });

  it("« Technicien 2 » avant « Technicien 10 » — numérique, jamais lexicographique", () => {
    const entree = [
      ligne("TPA6-Technicien 10", "0192f0a0-0000-7000-8000-00000000t4"),
      ligne("TPA6-Technicien 2", "0192f0a0-0000-7000-8000-00000000t5"),
    ];

    expect(trierLesTechniciens(entree).map((t) => t.nom)).toEqual([
      "TPA6-Technicien 2",
      "TPA6-Technicien 10",
    ]);
  });
});

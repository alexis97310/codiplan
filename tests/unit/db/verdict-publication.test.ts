import { describe, expect, it } from "vitest";

import { verdictDePublication } from "../../../lib/db/verdict-publication";

/**
 * LE VERDICT DU PORTAIL DE PUBLICATION (RELEASE-1) — isolé de toute base.
 *
 * Une fonction pure : deux listes de noms en entrée, un verdict en sortie.
 * Ce gardien n'ouvre aucune connexion — c'est délibéré, voir
 * `lib/db/verdict-publication.ts`.
 */
describe("le verdict du portail de publication", () => {
  it("publie quand la base porte exactement ce que le dépôt attend", () => {
    const attendues = ["a", "b", "c"];
    expect(verdictDePublication(attendues, ["a", "b", "c"])).toEqual({
      decision: "publier",
    });
  });

  it("publie quand la base porte davantage — une migration d'un dépôt plus vieux n'est pas un retard", () => {
    expect(verdictDePublication(["a", "b"], ["a", "b", "z_ancienne"])).toEqual({
      decision: "publier",
    });
  });

  it("ÉPREUVE — deux listes vides ne sont PAS confondues avec « illisible »", () => {
    // Un dépôt sans aucune migration attendue et une base qui n'en porte
    // aucune : c'est un « publier » légitime, pas un doute sur la lecture.
    expect(verdictDePublication([], [])).toEqual({ decision: "publier" });
  });

  it("bloque et NOMME la première migration manquante, dans l'ordre du dépôt", () => {
    const verdict = verdictDePublication(
      ["20260101000000_a", "20260102000000_b", "20260103000000_c"],
      ["20260101000000_a"],
    );
    expect(verdict).toEqual({
      decision: "bloquer",
      nom: "20260102000000_b",
      nombre: 2,
    });
  });

  it("bloque une base neuve qui n'a encore reçu aucune migration — une liste VIDE n'est pas `null`", () => {
    const verdict = verdictDePublication(["20260101000000_a"], []);
    expect(verdict).toEqual({
      decision: "bloquer",
      nom: "20260101000000_a",
      nombre: 1,
    });
  });

  it("est illisible quand l'état de la base n'a pas pu être obtenu, et le dit avec un motif", () => {
    const verdict = verdictDePublication(["20260101000000_a"], null);
    expect(verdict.decision).toBe("illisible");
    if (verdict.decision === "illisible") {
      expect(verdict.motif.length).toBeGreaterThan(0);
    }
  });

  it("ÉPREUVE — « illisible » et « bloquer » ne rendent jamais le même verdict sur les mêmes migrations attendues", () => {
    const attendues = ["20260101000000_a"];
    const bloque = verdictDePublication(attendues, []);
    const illisible = verdictDePublication(attendues, null);
    expect(bloque.decision).not.toBe(illisible.decision);
  });
});

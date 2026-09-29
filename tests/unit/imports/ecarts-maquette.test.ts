import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ECARTS_MAQUETTE_IMPORTS } from "@/lib/imports/ecarts-maquette";

/**
 * LES ÉCARTS NOMMÉS DE `/imports` FACE À LA MAQUETTE (TP-A3-RAPPORT-IMPORT).
 *
 * Même discipline que `tests/unit/ui/lot-a1-a4.test.ts` pour `/absences` : un
 * écart n'a de valeur que si la maquette dessine RÉELLEMENT ce qu'il nomme —
 * sinon ce serait un aveu d'absence sur un aveu d'absence.
 */

const MAQUETTE = readFileSync(
  join(process.cwd(), "docs/maquette/CODIPLAN_Maquette.html"),
  "utf8",
);

describe("chaque écart nommé de /imports existe RÉELLEMENT dans la maquette", () => {
  it("la maquette dessine réellement chaque libellé nommé", () => {
    for (const ecart of ECARTS_MAQUETTE_IMPORTS) {
      expect(MAQUETTE, ecart.libelle).toContain(ecart.libelle);
    }
  });

  it("a réellement lu quelque chose", () => {
    expect(ECARTS_MAQUETTE_IMPORTS.length).toBeGreaterThan(0);
    expect(MAQUETTE.length).toBeGreaterThan(1000);
  });
});

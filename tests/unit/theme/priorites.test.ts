import { describe, expect, it } from "vitest";

import { tonDePriorite } from "@/lib/theme/priorites";

/**
 * LA CORRESPONDANCE UNIQUE PRIORITÉ → TON (GR5, audit du 26/09/2026,
 * constat G6) : P1 rouge, P2 orange, P3 et P4 gris — tranché par Alexis le
 * 26/09/2026, la maquette donnant P3 en bleu étant écartée.
 */
describe("tonDePriorite", () => {
  it("p1 est rouge", () => {
    expect(tonDePriorite("p1")).toBe("rouge");
  });

  it("p2 est orange", () => {
    expect(tonDePriorite("p2")).toBe("orange");
  });

  it("p3 est gris", () => {
    expect(tonDePriorite("p3")).toBe("gris");
  });

  it("p4 est gris", () => {
    expect(tonDePriorite("p4")).toBe("gris");
  });
});

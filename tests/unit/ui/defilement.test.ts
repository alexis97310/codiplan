import { describe, expect, it } from "vitest";

import { indicesDeDefilement } from "@/components/ui/defilement";

/**
 * `indicesDeDefilement` (9AS-CG3, 28/09/2026) — fonction pure, sans DOM.
 * L'épreuve avec le vrai navigateur vit dans
 * `tests/e2e/defilement-tableau.spec.ts`.
 */
describe("indicesDeDefilement", () => {
  it("sans débordement, ne montre rien", () => {
    expect(
      indicesDeDefilement({
        scrollLeft: 0,
        scrollWidth: 400,
        clientWidth: 400,
      }),
    ).toEqual({ gauche: false, droite: false });
  });

  it("en débordement, au début, montre seulement la droite", () => {
    expect(
      indicesDeDefilement({
        scrollLeft: 0,
        scrollWidth: 800,
        clientWidth: 400,
      }),
    ).toEqual({ gauche: false, droite: true });
  });

  it("en débordement, au milieu, montre les deux côtés", () => {
    expect(
      indicesDeDefilement({
        scrollLeft: 200,
        scrollWidth: 800,
        clientWidth: 400,
      }),
    ).toEqual({ gauche: true, droite: true });
  });

  it("en débordement, à la fin (à 1 px près), montre seulement la gauche", () => {
    expect(
      indicesDeDefilement({
        scrollLeft: 400,
        scrollWidth: 800,
        clientWidth: 400,
      }),
    ).toEqual({ gauche: true, droite: false });

    expect(
      indicesDeDefilement({
        scrollLeft: 399.4,
        scrollWidth: 800,
        clientWidth: 400,
      }),
    ).toEqual({ gauche: true, droite: false });
  });
});

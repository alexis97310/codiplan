import { describe, expect, it } from "vitest";

import { doitRafraichir } from "@/lib/terrain/rafraichissement";

/**
 * LA RÈGLE « QUAND RAFRAÎCHIR » (9F4H5-TERRAIN-VIVANT, point 2) — LA PART
 * PURE, éprouvée sans navigateur (D-13).
 */
describe("doitRafraichir", () => {
  it("rafraîchit quand visible, en ligne, et sans activité en cours", () => {
    expect(
      doitRafraichir({ visible: true, enLigne: true, activiteEnCours: false }),
    ).toBe(true);
  });

  it("ne rafraîchit jamais un onglet caché", () => {
    expect(
      doitRafraichir({ visible: false, enLigne: true, activiteEnCours: false }),
    ).toBe(false);
  });

  it("ne rafraîchit jamais hors réseau (I4)", () => {
    expect(
      doitRafraichir({ visible: true, enLigne: false, activiteEnCours: false }),
    ).toBe(false);
  });

  it("ne rafraîchit jamais pendant une activité en cours (point 2)", () => {
    expect(
      doitRafraichir({ visible: true, enLigne: true, activiteEnCours: true }),
    ).toBe(false);
  });

  it("les trois conditions défavorables cumulées refusent aussi", () => {
    expect(
      doitRafraichir({
        visible: false,
        enLigne: false,
        activiteEnCours: true,
      }),
    ).toBe(false);
  });
});

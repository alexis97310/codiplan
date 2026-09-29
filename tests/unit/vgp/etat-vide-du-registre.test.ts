import { describe, expect, it } from "vitest";

import { etatVideDuRegistreVgp } from "@/lib/vgp/libelles";

/**
 * PV-36 (audit du 28/09/2026, 9BP-TP-A4a-MESSAGES) — MÊME DISTINCTION QUE LE
 * REGISTRE DES INTERVENTIONS.
 *
 * Mesuré sur `main` avant ce ticket : `vgp.vide` s'affichait à la fois pour
 * un registre réellement vide et pour un filtre par échéance ou une
 * recherche qui n'en trouve aucune.
 */
describe("etatVideDuRegistreVgp", () => {
  it("aucun filtre, recherche vide → vgp.vide", () => {
    expect(etatVideDuRegistreVgp({ filtre: "tous", recherche: "" })).toBe(
      "vgp.vide",
    );
  });

  it("recherche non vide, même sans filtre par échéance → vgp.vide_filtre", () => {
    expect(
      etatVideDuRegistreVgp({ filtre: "tous", recherche: "TPA4-AUCUN" }),
    ).toBe("vgp.vide_filtre");
  });

  it("une recherche faite seulement d'espaces compte comme vide", () => {
    expect(etatVideDuRegistreVgp({ filtre: "tous", recherche: "   " })).toBe(
      "vgp.vide",
    );
  });

  it("filtre « dépassées », recherche vide → vgp.vide_filtre", () => {
    expect(etatVideDuRegistreVgp({ filtre: "depassees", recherche: "" })).toBe(
      "vgp.vide_filtre",
    );
  });

  it("filtre « à venir », recherche vide → vgp.vide_filtre", () => {
    expect(etatVideDuRegistreVgp({ filtre: "a_venir", recherche: "" })).toBe(
      "vgp.vide_filtre",
    );
  });
});

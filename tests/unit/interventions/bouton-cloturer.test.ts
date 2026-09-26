import { describe, expect, it } from "vitest";

import { texteConfirmationCloture } from "@/components/interventions/bouton-cloturer";

/**
 * LE TEXTE DE CONFIRMATION AVANT CLÔTURE (99R-GR3-CLOTURE) — fonction pure,
 * éprouvée seule ; le dialogue lui-même (ouverture, bouton « Revenir »,
 * soumission) est éprouvé par `tests/e2e/fiche-cloturer.spec.ts`.
 */
describe("texteConfirmationCloture", () => {
  it("compose heures et minutes", () => {
    expect(texteConfirmationCloture(90)).toBe(
      "Clôturer avec 1 h 30 validées ?",
    );
  });

  it("compose les minutes seules sous une heure", () => {
    expect(texteConfirmationCloture(45)).toBe(
      "Clôturer avec 45 min validées ?",
    );
  });
});

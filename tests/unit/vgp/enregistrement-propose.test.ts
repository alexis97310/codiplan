import { describe, expect, it } from "vitest";

import { ASSUJETTISSEMENT } from "@/lib/vgp/assujettissement";
import { enregistrementPropose } from "@/lib/vgp/registre";

/**
 * TP-A2, PV-33 — LA RÈGLE DU BOUTON « ENREGISTRER », LUE SUR
 * L'ASSUJETTISSEMENT RÉSOLU DE LA LIGNE, JAMAIS SUR LA SEULE FAMILLE.
 *
 * Décision d'Alexis (29/09/2026) : « soumis » propose le lien ; « à
 * déterminer » le propose AUSSI, avec un avertissement ; le reste le masque.
 */
describe("enregistrementPropose", () => {
  it("soumis → propose, sans avertissement", () => {
    expect(
      enregistrementPropose({ assujettissement: ASSUJETTISSEMENT.soumis }),
    ).toBe("propose");
  });

  it("à déterminer → propose AVEC avertissement", () => {
    expect(
      enregistrementPropose({
        assujettissement: ASSUJETTISSEMENT.a_determiner,
      }),
    ).toBe("propose_avec_avertissement");
  });

  it("non soumis → masqué", () => {
    expect(
      enregistrementPropose({ assujettissement: ASSUJETTISSEMENT.non_soumis }),
    ).toBe("masque");
  });

  it("vérifié non soumis → masqué (ce n'est pas « soumis »)", () => {
    expect(
      enregistrementPropose({ assujettissement: ASSUJETTISSEMENT.verifie }),
    ).toBe("masque");
  });
});

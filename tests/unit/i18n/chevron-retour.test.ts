import { describe, expect, it } from "vitest";

import { fr } from "@/lib/i18n/fr";

/**
 * 9AR-CG2-FLECHES-RETOUR — un seul glyphe de retour, « ← » (constat C-M1,
 * audit captures du 26/09/2026).
 *
 * Sujet = le dictionnaire, comme `dictionnaire.test.ts` : aucun rendu, aucune
 * requête d'écran. `absences.calendrier_precedente` (« ‹ », bouton « mois
 * précédent » du calendrier — pas un retour) est la SEULE exemption.
 */
describe("un seul glyphe de retour", () => {
  const CLES_RETOUR = [
    "forfaits.retour",
    "vgp.verifier.retour",
    "vgp.indetermines.retour",
    "machine.retour",
    "machine.nouvelle.retour",
    "machine.modifier.retour",
  ] as const;

  it("les clés de retour commencent par « ← »", () => {
    for (const cle of CLES_RETOUR) {
      expect(
        fr[cle].startsWith("← "),
        `${cle} = ${JSON.stringify(fr[cle])}`,
      ).toBe(true);
    }
  });

  it("aucune valeur du dictionnaire ne contient « ‹ », hors l'exemption nommée du calendrier", () => {
    const EXEMPTION = "absences.calendrier_precedente";
    for (const [cle, valeur] of Object.entries(fr)) {
      if (cle === EXEMPTION) continue;
      expect(valeur.includes("‹"), `${cle} = ${JSON.stringify(valeur)}`).toBe(
        false,
      );
    }
  });

  it("témoin : au moins 7 clés dont le nom contient « retour » commencent par « ← »", () => {
    const compte = Object.entries(fr).filter(
      ([cle, valeur]) => cle.includes("retour") && valeur.startsWith("← "),
    ).length;
    expect(compte).toBeGreaterThanOrEqual(7);
  });
});

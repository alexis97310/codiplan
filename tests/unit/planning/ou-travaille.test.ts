import { describe, expect, it } from "vitest";

import { ouTravaille } from "@/app/(back-office)/planning/presentation";
import { mot } from "@/lib/i18n/vocabulaire";

/**
 * LA SOUS-LIGNE D'AGENCE DU PLANNING (ticket 9CN-RETOUCHES-3) — `ouTravaille`
 * a quitté `page.tsx` pour `presentation.ts`, où elle s'éprouve sans navigateur.
 * Aucun nom ici n'appartient à une personne réelle (I9) : les libellés sont
 * fabriqués par ce fichier.
 */
describe("ouTravaille", () => {
  it("aucune agence : rien à afficher", () => {
    expect(ouTravaille([])).toBe("");
  });

  it("une agence : le mot imposé puis son libellé", () => {
    const texte = ouTravaille(["AGENCE-9CN-UNE"]);
    expect(texte).toContain(mot("agence"));
    expect(texte).toContain("AGENCE-9CN-UNE");
  });

  it("deux agences : toutes deux nommées, séparées par une virgule", () => {
    const texte = ouTravaille(["AGENCE-9CN-UNE", "AGENCE-9CN-DEUX"]);
    expect(texte).toContain("AGENCE-9CN-UNE, AGENCE-9CN-DEUX");
  });
});

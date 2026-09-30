import { describe, expect, it } from "vitest";

import { fr } from "@/lib/i18n/fr";

/**
 * « HEURE À FIXER » (décision d'Alexis du 30/09/2026, point 3 ; D147 ;
 * spécification §3.6) — remplace « Journée — heure non fixée », valeur seule :
 * la clé `planning.jour_sans_heure` ne change pas de nom (9CJ et
 * `affichage-materiel.spec.ts` la lisent par la clé, jamais par le texte).
 */
describe("planning.jour_sans_heure", () => {
  it("vaut exactement « Heure à fixer »", () => {
    expect(fr["planning.jour_sans_heure"]).toBe("Heure à fixer");
  });
});

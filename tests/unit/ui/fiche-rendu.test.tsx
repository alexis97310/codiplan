import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Fiche, LigneFiche } from "@/components/ui/fiche";
import { fr } from "@/lib/i18n/fr";

/**
 * LE `dd` DE `Fiche` — PREUVE DE RENDU (ticket 9CN-RETOUCHES-3), plus forte que
 * la preuve textuelle de `tests/unit/ui/composants-maquette.test.ts:299`
 * (`toContain("font-bold")`), vacante pour le `dd` : retirer la classe du SEUL
 * `dd` de `components/ui/fiche.tsx` y laissait cette preuve verte, puisque
 * `font-bold` reste présent ailleurs dans le fichier (`dl`, `dt`).
 *
 * Texte visible pris dans `fr[…]` (L0-11) : son sens d'origine n'a aucun
 * rapport avec ce test, comme dans `composants-base.test.tsx`.
 */
describe("Fiche / LigneFiche — le dd rendu porte font-bold", () => {
  it("le dt et le dd rendus portent tous deux la classe font-bold", () => {
    const libelle = fr["parc.titre"];
    const valeur = fr["absences.titre"];
    const { getByText } = render(
      <Fiche>
        <LigneFiche libelle={libelle}>{valeur}</LigneFiche>
      </Fiche>,
    );
    const dt = getByText(libelle);
    const dd = getByText(valeur);
    expect(dt.tagName).toBe("DT");
    expect(dd.tagName).toBe("DD");
    expect(dt.className).toContain("font-bold");
    expect(dd.className).toContain("font-bold");
  });
});

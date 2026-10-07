import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SectionFormulaire } from "@/components/ui/section-formulaire";
import { fr } from "@/lib/i18n/fr";

/**
 * UNE SECTION NUMÉROTÉE DE FORMULAIRE (TP-UX5-1-FORMULAIRES, maquette du
 * 28/09) — la pastille et le titre.
 */
describe("SectionFormulaire", () => {
  it("rend le titre dans un <h2>", () => {
    const { getByRole } = render(
      <SectionFormulaire numero={1} titre="Qui et où">
        <p>{fr["intervention.creation.annuler"]}</p>
      </SectionFormulaire>,
    );
    expect(
      getByRole("heading", { level: 2, name: /Qui et où/ }),
    ).not.toBeNull();
  });

  it("affiche le numéro de la section", () => {
    const { getByText } = render(
      <SectionFormulaire numero={2} titre="Ce qui est demandé">
        <p>{fr["intervention.creation.annuler"]}</p>
      </SectionFormulaire>,
    );
    expect(getByText(String(2))).not.toBeNull();
  });

  it("rend son contenu", () => {
    const { getByText } = render(
      <SectionFormulaire numero={1} titre="Qui et où">
        <p>{fr["intervention.creation.annuler"]}</p>
      </SectionFormulaire>,
    );
    expect(getByText(fr["intervention.creation.annuler"])).not.toBeNull();
  });
});

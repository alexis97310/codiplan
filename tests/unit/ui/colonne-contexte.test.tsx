import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ColonneContexte } from "@/components/ui/colonne-contexte";
import { t } from "@/lib/i18n/fr";

/**
 * LA COLONNE DE CONTEXTE — GÉNÉRIQUE (9EE-TP-UX4-1-FICHE-INTERVENTION-2) :
 * un simple conteneur collant, sans contenu propre.
 */
describe("ColonneContexte", () => {
  it("rend ses enfants, jamais un <aside>", () => {
    const { container, getByText } = render(
      <ColonneContexte>
        <p>{t("intervention.sur_place.titre")}</p>
      </ColonneContexte>,
    );
    expect(getByText(t("intervention.sur_place.titre"))).not.toBeNull();
    expect(container.querySelector("aside")).toBeNull();
  });
});

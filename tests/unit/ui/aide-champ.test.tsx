import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AideChamp } from "@/components/ui/aide-champ";
import { fr } from "@/lib/i18n/fr";

/**
 * LE BOUTON « ? » D'UN CHAMP (TP-UX5-1-FORMULAIRES, maquette du 28/09) —
 * fermé par défaut, montre une phrase déjà écrite dans `fr.ts` au clic.
 */
describe("AideChamp", () => {
  it("ne montre pas la phrase avant le clic", () => {
    const { queryByText } = render(
      <AideChamp
        nomAccessible={fr["intervention.creation.duree_prevue"]}
        texte={fr["intervention.creation.duree_prevue_aide"]}
      />,
    );
    expect(
      queryByText(fr["intervention.creation.duree_prevue_aide"]),
    ).toBeNull();
  });

  it("montre la phrase après un clic sur le bouton « ? »", () => {
    const { getByRole, getByText } = render(
      <AideChamp
        nomAccessible={fr["intervention.creation.duree_prevue"]}
        texte={fr["intervention.creation.duree_prevue_aide"]}
      />,
    );
    fireEvent.click(
      getByRole("button", { name: fr["intervention.creation.duree_prevue"] }),
    );
    expect(
      getByText(fr["intervention.creation.duree_prevue_aide"]),
    ).not.toBeNull();
  });

  it("porte le nom accessible donné par l'appelant, jamais « ? » seul", () => {
    const { getByRole } = render(
      <AideChamp
        nomAccessible={fr["intervention.creation.duree_prevue"]}
        texte={fr["intervention.creation.duree_prevue_aide"]}
      />,
    );
    expect(
      getByRole("button", { name: fr["intervention.creation.duree_prevue"] }),
    ).toBeDefined();
  });
});

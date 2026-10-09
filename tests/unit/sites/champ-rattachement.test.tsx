import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChampRattachement } from "@/app/(back-office)/sites/nouveau/champ-rattachement";
import { aideAgenceUnique } from "@/app/(back-office)/sites/presentation";

/**
 * SOLDE 9EP POINT 38 — CS41 (AGENCE UNIQUE PRÉSÉLECTIONNÉE), ÉPROUVÉ SEUL
 * (extrait de `/sites/nouveau`, jusque-là non testé).
 *
 * Deux agences de même libellé, codes différents — même scène que
 * `tests/unit/agences/options.test.tsx` — pour que la présélection et son
 * absence se distinguent sans dépendre d'un libellé recopié en dur.
 */
const AGENCE_UNIQUE = {
  id: "11111111-1111-7111-8111-111111111111",
  libelle: "Ducos",
  code: "DUCOS",
};
const AGENCE_DEUXIEME = {
  id: "22222222-2222-7222-8222-222222222222",
  libelle: "Ducos",
  code: "DUCOS-2",
};

describe("ChampRattachement (solde 9EP point 38, CS41)", () => {
  // PAS `screen.getByText` ICI (espace insécable dans `aideAgenceUnique()`,
  // même piège que `tests/unit/ui/lot-parc.test.ts`) — son normalisateur par
  // défaut réduit l'espace du nœud DOM mais pas celui du texte cherché : les
  // deux divergent en silence. Comparaison directe du `textContent`.
  function aideRendue(container: HTMLElement): string | undefined {
    return [...container.querySelectorAll("span")].find(
      (span) => span.textContent === aideAgenceUnique(),
    )?.textContent;
  }

  it("une seule agence active — son option est sélectionnée, l'aide est affichée", () => {
    const { container } = render(
      <ChampRattachement agences={[AGENCE_UNIQUE]} agenceGardee="" />,
    );
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe(AGENCE_UNIQUE.id);
    expect(aideRendue(container)).toBe(aideAgenceUnique());
  });

  it("deux agences actives — aucune option choisie (D56), aucune aide", () => {
    const { container } = render(
      <ChampRattachement
        agences={[AGENCE_UNIQUE, AGENCE_DEUXIEME]}
        agenceGardee=""
      />,
    );
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(aideRendue(container)).toBeUndefined();
  });

  it("`agenceGardee` l'emporte sur l'absence de présélection, sous deux agences actives", () => {
    const { container } = render(
      <ChampRattachement
        agences={[AGENCE_UNIQUE, AGENCE_DEUXIEME]}
        agenceGardee={AGENCE_DEUXIEME.id}
      />,
    );
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe(AGENCE_DEUXIEME.id);
    expect(aideRendue(container)).toBeUndefined();
  });

  it("zéro agence — aucune aide, le select reste vide", () => {
    const { container } = render(
      <ChampRattachement agences={[]} agenceGardee="" />,
    );
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(aideRendue(container)).toBeUndefined();
  });
});

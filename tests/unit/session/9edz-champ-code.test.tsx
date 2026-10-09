import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChampCode } from "@/components/session/champ-code";

/**
 * 9EDZ-DEMANDES-CONNEXION-MAQUETTE, partie 6 (D188) — SIX CASES VISUELLES,
 * UN SEUL VRAI CHAMP.
 *
 * Frappe, collage, suppression : le champ réel reste un `<input>` ordinaire
 * ; seules les six cases décoratives suivent sa valeur.
 */
describe("ChampCode", () => {
  it("rend UN SEUL vrai champ, et six cases décoratives vides au départ", () => {
    const { container } = render(<ChampCode libelle="Code à 6 chiffres" />);
    expect(container.querySelectorAll('input[name="code"]')).toHaveLength(1);
    const cases = container.querySelectorAll('[aria-hidden="true"] > span');
    expect(cases).toHaveLength(6);
    for (const uneCase of cases) {
      expect(uneCase.textContent).toBe("");
    }
  });

  it("la frappe remplit les cases dans l'ordre, chiffre par chiffre", () => {
    const { container } = render(<ChampCode libelle="Code à 6 chiffres" />);
    const champ = container.querySelector(
      'input[name="code"]',
    ) as HTMLInputElement;
    fireEvent.change(champ, { target: { value: "482" } });
    const cases = container.querySelectorAll('[aria-hidden="true"] > span');
    expect(Array.from(cases).map((c) => c.textContent)).toEqual([
      "4",
      "8",
      "2",
      "",
      "",
      "",
    ]);
    expect(champ.value).toBe("482");
  });

  it("le collage de six chiffres remplit les six cases, et rien de plus", () => {
    const { container } = render(<ChampCode libelle="Code à 6 chiffres" />);
    const champ = container.querySelector(
      'input[name="code"]',
    ) as HTMLInputElement;
    fireEvent.change(champ, { target: { value: "4829153" } });
    // LA VALEUR ENVOYÉE AU FORMULAIRE EST BORNÉE À SIX CHIFFRES — un
    // septième chiffre collé n'est jamais soumis.
    expect(champ.value).toBe("482915");
    const cases = container.querySelectorAll('[aria-hidden="true"] > span');
    expect(Array.from(cases).map((c) => c.textContent)).toEqual([
      "4",
      "8",
      "2",
      "9",
      "1",
      "5",
    ]);
  });

  it("les caractères non numériques collés sont filtrés", () => {
    const { container } = render(<ChampCode libelle="Code à 6 chiffres" />);
    const champ = container.querySelector(
      'input[name="code"]',
    ) as HTMLInputElement;
    fireEvent.change(champ, { target: { value: "4a8-2 9x" } });
    expect(champ.value).toBe("4829");
  });

  it("la suppression vide les cases correspondantes", () => {
    const { container } = render(<ChampCode libelle="Code à 6 chiffres" />);
    const champ = container.querySelector(
      'input[name="code"]',
    ) as HTMLInputElement;
    fireEvent.change(champ, { target: { value: "482915" } });
    fireEvent.change(champ, { target: { value: "4829" } });
    expect(champ.value).toBe("4829");
    const cases = container.querySelectorAll('[aria-hidden="true"] > span');
    expect(Array.from(cases).map((c) => c.textContent)).toEqual([
      "4",
      "8",
      "2",
      "9",
      "",
      "",
    ]);
  });
});

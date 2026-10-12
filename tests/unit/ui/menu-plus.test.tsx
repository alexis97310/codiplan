import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { fr } from "@/lib/i18n";
import { MenuPlus } from "@/components/ui/menu-plus";

/**
 * LE MENU « ⋯ » GÉNÉRIQUE (9ES-TP-UX4-3-FICHE-GESTES-1) — rendu, Escape,
 * clic extérieur. Même patron que `MenuCreer`, éprouvé ici parce que ce
 * composant-ci est nouveau.
 */

const ENTREE = fr["planning.transmission.revenir"];

describe("MenuPlus — rendu", () => {
  it("le bouton porte l'aria-label attendu, et le menu est fermé par défaut", () => {
    const { getByLabelText, queryByRole } = render(
      <MenuPlus enfants={() => <button role="menuitem">{ENTREE}</button>} />,
    );
    expect(getByLabelText(fr["ui.menu_plus.titre"])).toBeInTheDocument();
    expect(queryByRole("menu")).toBeNull();
  });

  it("s'ouvre au clic, et rend les entrées fournies", () => {
    const { getByLabelText, getByRole, getByText } = render(
      <MenuPlus enfants={() => <button role="menuitem">{ENTREE}</button>} />,
    );
    fireEvent.click(getByLabelText(fr["ui.menu_plus.titre"]));
    expect(getByRole("menu")).toBeInTheDocument();
    expect(getByText(ENTREE)).toBeInTheDocument();
  });
});

describe("MenuPlus — fermeture", () => {
  it("Escape ferme le menu ouvert", () => {
    const { getByLabelText, queryByRole } = render(
      <MenuPlus enfants={() => <button role="menuitem">{ENTREE}</button>} />,
    );
    fireEvent.click(getByLabelText(fr["ui.menu_plus.titre"]));
    expect(queryByRole("menu")).not.toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(queryByRole("menu")).toBeNull();
  });

  it("un clic hors du menu le ferme", () => {
    const { getByLabelText, queryByRole } = render(
      <MenuPlus enfants={() => <button role="menuitem">{ENTREE}</button>} />,
    );
    fireEvent.click(getByLabelText(fr["ui.menu_plus.titre"]));
    expect(queryByRole("menu")).not.toBeNull();
    fireEvent.mouseDown(document.body);
    expect(queryByRole("menu")).toBeNull();
  });

  it("une entrée peut fermer le menu elle-même via `fermer`", () => {
    const { getByLabelText, getByText, queryByRole } = render(
      <MenuPlus
        enfants={(fermer) => (
          <button role="menuitem" onClick={fermer}>
            {ENTREE}
          </button>
        )}
      />,
    );
    fireEvent.click(getByLabelText(fr["ui.menu_plus.titre"]));
    fireEvent.click(getByText(ENTREE));
    expect(queryByRole("menu")).toBeNull();
  });
});

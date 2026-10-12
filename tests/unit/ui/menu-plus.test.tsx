import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { fr } from "@/lib/i18n";
import { MenuPlus, useFermerMenuPlus } from "@/components/ui/menu-plus";

/**
 * LE MENU « ⋯ » GÉNÉRIQUE (9ES-TP-UX4-3-FICHE-GESTES-1) — rendu, Escape,
 * clic extérieur. Même patron que `MenuCreer`, éprouvé ici parce que ce
 * composant-ci est nouveau.
 *
 * **`children`, jamais un render prop** (DÉFAUT mesuré par le pilote, voir
 * `components/ui/menu-plus.tsx`) : la fiche qui pose ce menu est un
 * composant SERVEUR, et une fonction ne traverse jamais la frontière vers un
 * composant client. `useFermerMenuPlus` est éprouvé séparément, par un petit
 * composant local qui en fait usage.
 */

const ENTREE = fr["planning.transmission.revenir"];

function EntreeQuiFerme() {
  const fermer = useFermerMenuPlus();
  return (
    <button role="menuitem" onClick={fermer}>
      {ENTREE}
    </button>
  );
}

describe("MenuPlus — rendu", () => {
  it("le bouton porte l'aria-label attendu, et le menu est fermé par défaut", () => {
    const { getByLabelText, queryByRole } = render(
      <MenuPlus>
        <button role="menuitem">{ENTREE}</button>
      </MenuPlus>,
    );
    expect(getByLabelText(fr["ui.menu_plus.titre"])).toBeInTheDocument();
    expect(queryByRole("menu")).toBeNull();
  });

  it("s'ouvre au clic, et rend les entrées fournies", () => {
    const { getByLabelText, getByRole, getByText } = render(
      <MenuPlus>
        <button role="menuitem">{ENTREE}</button>
      </MenuPlus>,
    );
    fireEvent.click(getByLabelText(fr["ui.menu_plus.titre"]));
    expect(getByRole("menu")).toBeInTheDocument();
    expect(getByText(ENTREE)).toBeInTheDocument();
  });
});

describe("MenuPlus — fermeture", () => {
  it("Escape ferme le menu ouvert", () => {
    const { getByLabelText, queryByRole } = render(
      <MenuPlus>
        <button role="menuitem">{ENTREE}</button>
      </MenuPlus>,
    );
    fireEvent.click(getByLabelText(fr["ui.menu_plus.titre"]));
    expect(queryByRole("menu")).not.toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(queryByRole("menu")).toBeNull();
  });

  it("un clic hors du menu le ferme", () => {
    const { getByLabelText, queryByRole } = render(
      <MenuPlus>
        <button role="menuitem">{ENTREE}</button>
      </MenuPlus>,
    );
    fireEvent.click(getByLabelText(fr["ui.menu_plus.titre"]));
    expect(queryByRole("menu")).not.toBeNull();
    fireEvent.mouseDown(document.body);
    expect(queryByRole("menu")).toBeNull();
  });

  it("une entrée peut fermer le menu elle-même via `useFermerMenuPlus`", () => {
    const { getByLabelText, getByText, queryByRole } = render(
      <MenuPlus>
        <EntreeQuiFerme />
      </MenuPlus>,
    );
    fireEvent.click(getByLabelText(fr["ui.menu_plus.titre"]));
    fireEvent.click(getByText(ENTREE));
    expect(queryByRole("menu")).toBeNull();
  });
});

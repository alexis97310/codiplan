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

/**
 * ↑/↓ DÉPLACENT LE FOCUS D'UNE ENTRÉE À L'AUTRE, AVEC REBOUCLAGE (solde 181,
 * 9EW-SOLDE-DIALOGUES-FICHE) — deux entrées, pour que le rebouclage ait un
 * sens (une seule entrée reboucle sur elle-même, ce que les deux premiers
 * cas ne distingueraient pas d'un défaut).
 */
describe("MenuPlus — navigation clavier", () => {
  const ENTREE_A = fr["planning.transmission.revenir"];
  const ENTREE_B = fr["ui.dialogue.fermer"];

  function ouvrirMenuADeuxEntrees() {
    const rendu = render(
      <MenuPlus>
        <button role="menuitem">{ENTREE_A}</button>
        <button role="menuitem">{ENTREE_B}</button>
      </MenuPlus>,
    );
    fireEvent.click(rendu.getByLabelText(fr["ui.menu_plus.titre"]));
    return rendu;
  }

  it("ArrowDown depuis le bouton « ⋯ » porte le focus à la première entrée", () => {
    const { getByText } = ouvrirMenuADeuxEntrees();
    fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(getByText(ENTREE_A)).toHaveFocus();
  });

  it("ArrowDown reboucle de la dernière entrée à la première", () => {
    const { getByText } = ouvrirMenuADeuxEntrees();
    getByText(ENTREE_B).focus();
    fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(getByText(ENTREE_A)).toHaveFocus();
  });

  it("ArrowUp reboucle de la première entrée à la dernière", () => {
    const { getByText } = ouvrirMenuADeuxEntrees();
    getByText(ENTREE_A).focus();
    fireEvent.keyDown(document, { key: "ArrowUp" });
    expect(getByText(ENTREE_B)).toHaveFocus();
  });
});

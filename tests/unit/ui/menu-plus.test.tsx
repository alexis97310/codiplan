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
const CHAMP_DE_SAISIE = fr["intervention.technicien"];

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

  // RÉGRESSION 9EWA1-CORRECTIF-FLECHES-MENU-DIALOGUE — fermer le menu À
  // L'AVEUGLE sur Échap démontait un dialogue ouvert depuis ce menu MÊME
  // QUAND ce dialogue refusait de se fermer lui-même (`components/ui/
  // dialogue.tsx`, champ modifié depuis l'ouverture) : les deux chemins
  // voulaient fermer jusqu'à ce que l'un d'eux puisse désormais refuser. Un
  // `<dialog open>` injecté directement suffit à représenter ce cas, sans
  // dépendre de `Dialogue` lui-même (éprouvé séparément).
  it("Escape ne ferme pas le menu quand un dialogue est ouvert ailleurs dans le document", () => {
    const { getByLabelText, queryByRole } = render(
      <MenuPlus>
        <button role="menuitem">{ENTREE}</button>
      </MenuPlus>,
    );
    fireEvent.click(getByLabelText(fr["ui.menu_plus.titre"]));
    expect(queryByRole("menu")).not.toBeNull();

    const dialogue = document.createElement("dialog");
    dialogue.setAttribute("open", "");
    document.body.appendChild(dialogue);
    try {
      fireEvent.keyDown(document, { key: "Escape" });
      expect(queryByRole("menu")).not.toBeNull();
    } finally {
      dialogue.remove();
    }
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
 *
 * **Le focus est posé EXPLICITEMENT avant chaque flèche** (régression
 * 9EWA1-CORRECTIF-FLECHES-MENU-DIALOGUE) — `fireEvent.click` ne focalise
 * jamais réellement un bouton sous jsdom (contrairement à un vrai
 * navigateur), et le code lu désormais `document.activeElement` plutôt que
 * la cible de l'évènement pour décider s'il doit agir : sans ce `.focus()`,
 * `document.activeElement` resterait `<body>`, hors du conteneur du menu, et
 * la flèche ne serait plus jamais capturée — ce que ce fichier doit encore
 * pouvoir éprouver.
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
    const { getByText, getByRole } = ouvrirMenuADeuxEntrees();
    getByRole("button", { name: fr["ui.menu_plus.titre"] }).focus();
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

  /**
   * TROIS GARDES CONTRE LA CAPTURE HORS DE CE MENU (régression
   * 9EWA1-CORRECTIF-FLECHES-MENU-DIALOGUE) : un `dialog[open]` existe
   * n'importe où dans le document, le focus est hors du conteneur de ce
   * menu, ou le focus est un champ de saisie. Dans les trois cas, la flèche
   * ne doit ni bouger le focus parmi les entrées ni empêcher le
   * comportement par défaut (ici observable par l'absence de mouvement de
   * focus, le seul effet que ce composant produit lui-même).
   */
  it("une flèche n'est pas interceptée quand un dialogue est ouvert ailleurs dans le document", () => {
    const { getByText } = ouvrirMenuADeuxEntrees();
    getByText(ENTREE_A).focus();
    const dialogue = document.createElement("dialog");
    dialogue.setAttribute("open", "");
    document.body.appendChild(dialogue);
    try {
      fireEvent.keyDown(document, { key: "ArrowDown" });
      expect(getByText(ENTREE_A)).toHaveFocus();
    } finally {
      dialogue.remove();
    }
  });

  it("une flèche n'est pas interceptée quand le focus est hors du conteneur du menu", () => {
    const { getByText } = ouvrirMenuADeuxEntrees();
    const champExterieur = document.createElement("input");
    document.body.appendChild(champExterieur);
    try {
      champExterieur.focus();
      fireEvent.keyDown(document, { key: "ArrowDown" });
      expect(champExterieur).toHaveFocus();
      expect(getByText(ENTREE_A)).not.toHaveFocus();
    } finally {
      champExterieur.remove();
    }
  });

  it("une flèche n'est pas interceptée quand le focus est un champ de saisie", () => {
    const rendu = render(
      <MenuPlus>
        <button role="menuitem">{ENTREE_A}</button>
        <textarea aria-label={CHAMP_DE_SAISIE} />
      </MenuPlus>,
    );
    fireEvent.click(rendu.getByLabelText(fr["ui.menu_plus.titre"]));
    const champ = rendu.getByLabelText(CHAMP_DE_SAISIE);
    champ.focus();
    fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(champ).toHaveFocus();
    expect(rendu.getByText(ENTREE_A)).not.toHaveFocus();
  });
});

import { fireEvent, render } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import { fr } from "@/lib/i18n";
import { Dialogue } from "@/components/ui/dialogue";
import { Button } from "@/components/ui/button";

/**
 * LE DIALOGUE GÉNÉRIQUE (9ES-TP-UX4-3-FICHE-GESTES-1) — rendu et fermeture.
 *
 * **jsdom ne porte ni `showModal` ni `close`** sur `HTMLDialogElement` (les
 * autres dialogues du dépôt, `BoutonAvecConfirmation` compris, ne testent
 * jamais l'ouverture pour cette raison). Ce fichier pose le même polyfill
 * minimal que la vraie API : `showModal` ouvre, `close` ferme et émet
 * `close` — assez pour éprouver ce que CE composant fait de ces deux appels,
 * jamais le comportement natif d'Escape (laissé à l'e2e, en vrai navigateur).
 *
 * **Les libellés viennent du dictionnaire** (L0-11, gardien
 * `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`), même si leur sens
 * d'origine n'a rien à voir avec ce composant GÉNÉRIQUE : le titre et le
 * pied réels (« Suspendre… », « Annuler… ») sont écrits par les dialogues
 * concrets de la partie B, pas ici.
 */
beforeAll(() => {
  if (typeof HTMLDialogElement.prototype.showModal !== "function") {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.open = true;
      this.setAttribute("open", "");
    };
  }
  if (typeof HTMLDialogElement.prototype.close !== "function") {
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.open = false;
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    };
  }
});

const OUVRIR = fr["parametres.index_ouvrir"];
const FERMER = fr["ui.dialogue.fermer"];
const CORPS = fr["planning.tiroir.chargement"];
const GARDER = fr["planning.transmission.revenir"];

describe("Dialogue — rendu", () => {
  it("rend le déclencheur fermé, et le titre et le corps dans le document", () => {
    const { getByText, container } = render(
      <Dialogue
        declencheur={(ouvrir) => (
          <Button type="button" onClick={ouvrir}>
            {OUVRIR}
          </Button>
        )}
        titre={fr["intervention.suspension.titre"]}
        enfants={() => <p>{CORPS}</p>}
        pied={(fermer) => (
          <Button type="button" variant="outline" onClick={fermer}>
            {FERMER}
          </Button>
        )}
      />,
    );
    expect(container.querySelector("dialog")?.hasAttribute("open")).toBe(false);
    expect(getByText(fr["intervention.suspension.titre"])).toBeInTheDocument();
    expect(getByText(CORPS)).toBeInTheDocument();
  });

  it("le déclencheur ouvre le dialogue", () => {
    const { getByText, container } = render(
      <Dialogue
        declencheur={(ouvrir) => <Button onClick={ouvrir}>{OUVRIR}</Button>}
        titre={fr["intervention.suspension.titre"]}
        enfants={() => <p>{CORPS}</p>}
        pied={(fermer) => <Button onClick={fermer}>{FERMER}</Button>}
      />,
    );
    fireEvent.click(getByText(OUVRIR));
    expect(container.querySelector("dialog")?.hasAttribute("open")).toBe(true);
  });
});

describe("Dialogue — fermeture", () => {
  it("le bouton du pied ferme le dialogue", () => {
    const { getByText, container } = render(
      <Dialogue
        declencheur={(ouvrir) => <Button onClick={ouvrir}>{OUVRIR}</Button>}
        titre={fr["intervention.suspension.titre"]}
        enfants={() => <p>{CORPS}</p>}
        pied={(fermer) => (
          <Button type="button" onClick={fermer}>
            {GARDER}
          </Button>
        )}
      />,
    );
    fireEvent.click(getByText(OUVRIR));
    expect(container.querySelector("dialog")?.hasAttribute("open")).toBe(true);
    fireEvent.click(getByText(GARDER));
    expect(container.querySelector("dialog")?.hasAttribute("open")).toBe(false);
  });

  it("l'évènement natif `close` (Escape, clic hors du dialogue) referme aussi", () => {
    const { getByText, container } = render(
      <Dialogue
        declencheur={(ouvrir) => <Button onClick={ouvrir}>{OUVRIR}</Button>}
        titre={fr["intervention.suspension.titre"]}
        enfants={() => <p>{CORPS}</p>}
        pied={(fermer) => <Button onClick={fermer}>{FERMER}</Button>}
      />,
    );
    fireEvent.click(getByText(OUVRIR));
    const dialogue = container.querySelector("dialog");
    if (dialogue !== null) {
      fireEvent(dialogue, new Event("close"));
    }
    expect(dialogue?.hasAttribute("open")).toBe(false);
  });
});

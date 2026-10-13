import { fireEvent, render } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

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

  // DÉFAUT MESURÉ (9ES-TP-UX4-3-FICHE-GESTES-1A-REPRISE, en adaptant
  // `tests/e2e/fiche-annuler.spec.ts`) : `DialogueAnnuler` appelait un
  // équivalent d'`auFermer` AU CLIC QUI OUVRE, dans le MÊME geste que
  // `ouvrir()` — React démontait alors le menu (et ce dialogue avec lui)
  // avant qu'il ait pu s'afficher. `auFermer` ne doit jamais s'appeler à
  // l'ouverture, seulement à la fermeture.
  it("`auFermer` ne s'appelle pas à l'ouverture, seulement à la fermeture", () => {
    const auFermer = vi.fn();
    const { getByText } = render(
      <Dialogue
        auFermer={auFermer}
        declencheur={(ouvrir) => <Button onClick={ouvrir}>{OUVRIR}</Button>}
        titre={fr["intervention.suspension.titre"]}
        enfants={() => <p>{CORPS}</p>}
        pied={(fermer) => <Button onClick={fermer}>{FERMER}</Button>}
      />,
    );
    fireEvent.click(getByText(OUVRIR));
    expect(auFermer).not.toHaveBeenCalled();
    fireEvent.click(getByText(FERMER));
    // Le bouton du pied appelle `fermer` directement, et l'effet qui
    // `close()` le `<dialog>` déjà fermé émet À SON TOUR l'évènement natif
    // `close` (même polyfill qu'en haut du fichier) — `fermer` s'exécute
    // deux fois, `auFermer` avec lui. Idempotent (`setOuvert(false)` répété,
    // `fermerMenu` répété) : seul compte qu'il ne s'appelle JAMAIS avant la
    // fermeture.
    expect(auFermer).toHaveBeenCalled();
  });
});

/**
 * LE CLIC SUR LE FOND (solde 164, 9EU-SOLDE-FICHE-PLANNING) — RESTREINT AU
 * SOLDE 178 (9EW-SOLDE-DIALOGUES-FICHE) : un clic qui atterrit sur l'ÉLÉMENT
 * `<dialog>` lui-même ferme, SAUF si un champ du formulaire a été modifié
 * depuis l'ouverture — un motif déjà tapé ne se perd pas à un clic dans la
 * marge de la feuille basse. `fireEvent.click` posé DIRECTEMENT sur
 * `<dialog>` (jamais sur un enfant) reproduit cette cible.
 */
describe("Dialogue — clic sur le fond", () => {
  it("ferme quand aucun champ n'a été modifié", () => {
    const { getByText, container } = render(
      <Dialogue
        declencheur={(ouvrir) => <Button onClick={ouvrir}>{OUVRIR}</Button>}
        titre={fr["intervention.suspension.titre"]}
        enfants={() => (
          <form>
            <textarea aria-label={CORPS} />
          </form>
        )}
        pied={(fermer) => <Button onClick={fermer}>{FERMER}</Button>}
      />,
    );
    fireEvent.click(getByText(OUVRIR));
    const dialogue = container.querySelector("dialog");
    expect(dialogue?.hasAttribute("open")).toBe(true);
    if (dialogue !== null) {
      fireEvent.click(dialogue);
    }
    expect(dialogue?.hasAttribute("open")).toBe(false);
  });

  it("ne ferme pas quand un champ a été modifié depuis l'ouverture, et garde sa valeur", () => {
    const { getByText, getByLabelText, container } = render(
      <Dialogue
        declencheur={(ouvrir) => <Button onClick={ouvrir}>{OUVRIR}</Button>}
        titre={fr["intervention.suspension.titre"]}
        enfants={() => (
          <form>
            <textarea aria-label={CORPS} />
          </form>
        )}
        pied={(fermer) => <Button onClick={fermer}>{FERMER}</Button>}
      />,
    );
    fireEvent.click(getByText(OUVRIR));
    const champ = getByLabelText(CORPS) as HTMLTextAreaElement;
    fireEvent.change(champ, { target: { value: "un motif" } });
    const dialogue = container.querySelector("dialog");
    if (dialogue !== null) {
      fireEvent.click(dialogue);
    }
    expect(dialogue?.hasAttribute("open")).toBe(true);
    expect(champ.value).toBe("un motif");
  });

  it("une valeur pré-remplie non modifiée n'empêche pas la fermeture", () => {
    const { getByText, container } = render(
      <Dialogue
        declencheur={(ouvrir) => <Button onClick={ouvrir}>{OUVRIR}</Button>}
        titre={fr["intervention.suspension.titre"]}
        enfants={() => (
          <form>
            <input aria-label={CORPS} defaultValue="60" />
          </form>
        )}
        pied={(fermer) => <Button onClick={fermer}>{FERMER}</Button>}
      />,
    );
    fireEvent.click(getByText(OUVRIR));
    const dialogue = container.querySelector("dialog");
    if (dialogue !== null) {
      fireEvent.click(dialogue);
    }
    expect(dialogue?.hasAttribute("open")).toBe(false);
  });
});

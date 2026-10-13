import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DialogueTransmettreDemain } from "@/components/planning/transmettre-demain";
import { BoutonAvecConfirmation } from "@/components/ui/bouton-confirmation";
import { CLASSES_FEUILLE_BASSE } from "@/components/ui/feuille-basse";

/**
 * LA FEUILLE BASSE, AU TÉLÉPHONE (QE-6c, 9DV-TP-NAV4-TELEPHONE-GLOSSAIRE) —
 * épreuve du RENDU, en complément de l'e2e à 375 px
 * (`tests/e2e/9dv-tp-nav4-telephone-glossaire.spec.ts`) qui ne couvre, pour
 * cette seule partie, qu'un dialogue atteignable sans scène — celui-ci
 * éprouve directement les classes posées sur `<dialog>`.
 */
describe("CLASSES_FEUILLE_BASSE", () => {
  it("colle le dialogue au bas de l'écran par défaut (téléphone)", () => {
    expect(CLASSES_FEUILLE_BASSE).toContain("fixed");
    expect(CLASSES_FEUILLE_BASSE).toContain("bottom-0");
    expect(CLASSES_FEUILLE_BASSE).toContain("rounded-t-2xl");
  });

  it("le recentre à partir de 901 px", () => {
    expect(CLASSES_FEUILLE_BASSE).toContain("min-[901px]:top-1/2");
    expect(CLASSES_FEUILLE_BASSE).toContain("min-[901px]:bottom-auto");
    expect(CLASSES_FEUILLE_BASSE).toContain("min-[901px]:rounded-lg");
  });

  // 9EWB1-FEUILLE-BASSE-375-MENU-PLUS — le plafond natif du navigateur
  // (`dialog:modal { max-width: calc(100% - 6px - 2em) }`) plafonnait le
  // dialogue à 337 px sur un écran de 375 px ; rien ne le neutralisait.
  it("neutralise le plafond de largeur et de hauteur du navigateur sous 901 px", () => {
    expect(CLASSES_FEUILLE_BASSE).toContain("max-w-none");
    expect(CLASSES_FEUILLE_BASSE).toContain("max-h-[90dvh]");
    expect(CLASSES_FEUILLE_BASSE).toContain("overflow-y-auto");
  });

  it("restaure le plafond natif à partir de 901 px", () => {
    expect(CLASSES_FEUILLE_BASSE).toContain(
      "min-[901px]:max-h-[calc(100%-6px-2em)]",
    );
    expect(CLASSES_FEUILLE_BASSE).toContain("min-[901px]:overflow-visible");
  });
});

describe("BoutonAvecConfirmation — porte la feuille basse sur son <dialog>", () => {
  it("le dialogue rendu porte les classes de la feuille basse", () => {
    const { container } = render(
      <BoutonAvecConfirmation
        libelle="Annuler"
        variant="outline"
        texteConfirmation="Confirmer ?"
        boutonConfirmer="Oui"
        boutonRevenir="Non"
      />,
    );
    const dialogue = container.querySelector("dialog");
    expect(dialogue).not.toBeNull();
    expect(dialogue?.className).toContain("rounded-t-2xl");
    expect(dialogue?.className).toContain("min-[901px]:rounded-lg");
  });
});

describe("DialogueTransmettreDemain — même feuille basse, même composant", () => {
  it("le dialogue rendu porte les classes de la feuille basse", () => {
    const { container } = render(
      <DialogueTransmettreDemain
        libelleBouton="Transmettre demain"
        titre="Transmettre demain"
        groupes={[]}
        laissees={[]}
      />,
    );
    const dialogue = container.querySelector("dialog");
    expect(dialogue).not.toBeNull();
    expect(dialogue?.className).toContain("rounded-t-2xl");
    expect(dialogue?.className).toContain("min-[901px]:rounded-lg");
  });
});

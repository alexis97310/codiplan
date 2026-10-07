import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { fr } from "@/lib/i18n/fr";

import { Choix } from "@/components/ui/choix";

/**
 * LE GROUPE DE BOUTONS RADIO (QE-9, 9ED-TP-UX3-D2-DEMANDES).
 *
 * Rien n'est coché sans `valeurInitiale` (IN-02, IN-28) — un groupe de
 * boutons radio natifs ne présélectionne jamais sa première option de
 * lui-même, à la différence d'un `<select>` simple.
 */
describe("Choix", () => {
  const OPTIONS = [
    { valeur: "p1", libelle: "P1" },
    { valeur: "p2", libelle: "P2" },
    { valeur: "p3", libelle: "P3" },
  ];

  it("sans valeurInitiale, aucune option n'est cochée", () => {
    const { container } = render(
      <Choix nom="priorite" legende="Priorité" options={OPTIONS} />,
    );
    const radios = container.querySelectorAll('input[type="radio"]');
    expect(radios).toHaveLength(3);
    for (const radio of radios) {
      expect(radio).not.toBeChecked();
    }
  });

  it("avec valeurInitiale, seule l'option désignée est cochée", () => {
    const { container } = render(
      <Choix
        nom="priorite"
        legende="Priorité"
        options={OPTIONS}
        valeurInitiale="p2"
      />,
    );
    const p2 = container.querySelector('input[value="p2"]');
    const p1 = container.querySelector('input[value="p1"]');
    expect(p2).toBeChecked();
    expect(p1).not.toBeChecked();
  });

  it("obligatoire pose `required` sur chaque bouton du groupe", () => {
    const { container } = render(
      <Choix nom="priorite" legende="Priorité" options={OPTIONS} obligatoire />,
    );
    const radios = container.querySelectorAll('input[type="radio"]');
    for (const radio of radios) {
      expect(radio).toBeRequired();
    }
  });

  it("sans obligatoire, aucun bouton n'est `required`", () => {
    const { container } = render(
      <Choix nom="priorite" legende="Priorité" options={OPTIONS} />,
    );
    const radios = container.querySelectorAll('input[type="radio"]');
    for (const radio of radios) {
      expect(radio).not.toBeRequired();
    }
  });

  it("chaque bouton porte le même `name`, pour ne soumettre qu'une seule valeur", () => {
    const { container } = render(
      <Choix nom="priorite" legende="Priorité" options={OPTIONS} />,
    );
    const radios = container.querySelectorAll('input[type="radio"]');
    for (const radio of radios) {
      expect(radio).toHaveAttribute("name", "priorite");
    }
  });

  /**
   * L'EXTENSION TP-UX5-1-FORMULAIRES — `erreur` et le couple `valeur`/
   * `onChange`, tous deux FACULTATIFS : rien n'est renommé ni retiré pour les
   * cinq cas ci-dessus.
   */
  it("avec `erreur`, le groupe porte `aria-invalid` et le message apparaît sous lui", () => {
    const { container, getByText } = render(
      <Choix
        nom="priorite"
        legende="Priorité"
        options={OPTIONS}
        erreur={fr["intervention.refus.priorite_manquante"]}
      />,
    );
    const groupe = container.querySelector('[role="radiogroup"]');
    expect(groupe).toHaveAttribute("aria-invalid", "true");
    const message = getByText(fr["intervention.refus.priorite_manquante"]);
    expect(groupe).toHaveAttribute("aria-describedby", message.id);
  });

  it("sans `erreur`, le groupe ne porte pas `aria-invalid`", () => {
    const { container } = render(
      <Choix nom="priorite" legende="Priorité" options={OPTIONS} />,
    );
    const groupe = container.querySelector('[role="radiogroup"]');
    expect(groupe).not.toHaveAttribute("aria-invalid");
  });

  it("avec `valeur`, le groupe est CONTRÔLÉ : changer `valeur` change le bouton coché", () => {
    const { container, rerender } = render(
      <Choix
        nom="priorite"
        legende="Priorité"
        options={OPTIONS}
        valeur="p1"
        onChange={() => {}}
      />,
    );
    expect(container.querySelector('input[value="p1"]')).toBeChecked();
    rerender(
      <Choix
        nom="priorite"
        legende="Priorité"
        options={OPTIONS}
        valeur="p2"
        onChange={() => {}}
      />,
    );
    expect(container.querySelector('input[value="p1"]')).not.toBeChecked();
    expect(container.querySelector('input[value="p2"]')).toBeChecked();
  });

  it("avec `valeur`, cocher un autre bouton appelle `onChange` avec sa valeur", () => {
    const onChange = vi.fn();
    const { container } = render(
      <Choix
        nom="priorite"
        legende="Priorité"
        options={OPTIONS}
        valeur="p1"
        onChange={onChange}
      />,
    );
    const p3 = container.querySelector('input[value="p3"]');
    expect(p3).not.toBeNull();
    fireEvent.click(p3 as Element);
    expect(onChange).toHaveBeenCalledWith("p3");
  });
});

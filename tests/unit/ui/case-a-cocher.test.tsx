import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CaseACocher } from "@/components/ui/case-a-cocher";
import { fr } from "@/lib/i18n/fr";

/**
 * LA CASE À COCHER DES ÉCRANS DE PARAMÉTRAGE (9AU-CG8-CASES-44).
 *
 * Huit `<input type="checkbox">` recopiés portaient sous 768 px une cible de
 * la taille du glyphe rendu par le navigateur — ce composant unique porte la
 * cible de 44 px sur le `<label>`, effacée dès 768 px pour ne rien changer au
 * rendu bureau.
 */
describe("CaseACocher", () => {
  it("rend une case dont le label porte la cible tactile de 44 px, effacée dès 768 px", () => {
    const { getByLabelText, container } = render(
      <CaseACocher
        name="actif"
        value="oui"
        defaultChecked
        libelle={fr["prestations.active"]}
        className="flex items-center gap-2"
      />,
    );

    const case_ = getByLabelText(fr["prestations.active"]);
    expect(case_).toBeInstanceOf(HTMLInputElement);
    expect(case_).toHaveAttribute("type", "checkbox");
    expect(case_).toHaveAttribute("name", "actif");
    expect(case_).toHaveAttribute("value", "oui");
    expect(case_).toBeChecked();

    const label = container.querySelector("label");
    expect(label).not.toBeNull();
    expect(label?.className).toContain("min-h-11");
    expect(label?.className).toContain("md:min-h-0");
    expect(label?.className).toContain("flex items-center gap-2");
  });

  it("sans defaultChecked ni value, la case reste décochée et sans attribut value", () => {
    const { getByLabelText } = render(
      <CaseACocher name="actif" libelle={fr["materiel.active"]} />,
    );
    const case_ = getByLabelText(fr["materiel.active"]);
    expect(case_).not.toBeChecked();
    expect(case_).not.toHaveAttribute("value");
  });
});

/**
 * GARDE DE SOURCE — les 6 fichiers du territoire ne portent plus la case
 * native. Un fichier vide compterait comme « sans checkbox » sans avoir
 * réellement été relu : le témoin `contenu.length` l'exclut.
 */
describe("les écrans de paramétrage ne portent plus de case native", () => {
  const FICHIERS = [
    "app/(back-office)/parametres/habilitations/page.tsx",
    "app/(back-office)/parametres/materiel/page.tsx",
    "app/(back-office)/parametres/agences/[agenceId]/page.tsx",
    "app/(back-office)/parametres/prestations/page.tsx",
    "app/(back-office)/parametres/equipe/page.tsx",
    "components/forfaits/formulaire.tsx",
  ];

  it.each(FICHIERS)('%s ne contient aucun type="checkbox"', (chemin) => {
    const contenu = readFileSync(join(process.cwd(), chemin), "utf8");
    expect(contenu.length).toBeGreaterThan(0);
    expect(contenu).not.toContain('type="checkbox"');
  });
});

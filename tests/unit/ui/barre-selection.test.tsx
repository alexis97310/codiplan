import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  BarreSelection,
  CaseSelectionLigne,
  ProviderSelection,
} from "@/components/ui/barre-selection";
import { t } from "@/lib/i18n/fr";

/**
 * LA SÉLECTION DU REGISTRE (TP-UX3-1-REGISTRE-2, partie B) — `ProviderSelection`
 * tient l'état (un `Set` d'identifiants cochés), `CaseSelectionLigne` le
 * modifie, `BarreSelection` le lit et compose les deux formulaires natifs
 * (transmission groupée, export). Les trois sont éprouvés ENSEMBLE, jamais
 * séparément : c'est le contexte qui les relie, et un test qui en isolerait
 * un seul ne prouverait rien de l'ensemble.
 *
 * **Aucune requête d'écran ne porte de texte composé** (gardien
 * `sans-chaine-visible-en-dur`, L0-11 : une chaîne assemblée dans une
 * constante avant d'atteindre `getByText`/`getByLabelText` reste une chaîne
 * en dur à ses yeux, même construite depuis `t(...)`). Les cases se trouvent
 * par leur RÔLE et leur ORDRE (deux seulement, posées dans un ordre connu),
 * les formulaires par leur `action`, et le texte affiché se lit sur
 * `textContent` — `toContain`/`toBe`, jamais une requête d'écran.
 */

const LIGNES = [
  { id: "int-1", statut: "planifiee" },
  { id: "int-2", statut: "affectee" },
];

function Scene() {
  return (
    <ProviderSelection lignes={LIGNES}>
      <BarreSelection
        libelleUn={t("interventions.selection.un")}
        libellePluriel={t("interventions.selection.plusieurs")}
        libelleVider={t("interventions.selection.vider")}
        libelleExporter={t("export.bouton")}
        actionExporter="/api/interventions/exporter"
        filtresExport={{ vue: "aujourdhui" }}
        actionTransmettre="/api/interventions/transmettre"
        libelleTransmettre={t("interventions.colonne.transmettre_courte")}
        libelleUnePlanifiee={t("interventions.selection.une_planifiee")}
        libellePlusieursPlanifiees={t(
          "interventions.selection.plusieurs_planifiees",
        )}
      />
      <table>
        <tbody>
          <tr>
            <td>
              <CaseSelectionLigne id="int-1" ariaLabel="x" />
            </td>
          </tr>
          <tr>
            <td>
              <CaseSelectionLigne id="int-2" ariaLabel="y" />
            </td>
          </tr>
        </tbody>
      </table>
    </ProviderSelection>
  );
}

/** Les deux cases, dans l'ordre où `Scene` les pose — jamais par leur texte. */
function cases(): readonly HTMLElement[] {
  return screen.getAllByRole("checkbox");
}

function formulaire(action: string): HTMLFormElement {
  const trouve = document.querySelector(`form[action="${action}"]`);
  expect(trouve, `aucun <form action="${action}">`).not.toBeNull();
  return trouve as HTMLFormElement;
}

function idsDuFormulaire(form: HTMLFormElement): string[] {
  return Array.from(form.querySelectorAll('input[name="id"]')).map(
    (champ) => (champ as HTMLInputElement).value,
  );
}

describe("la sélection du registre (TP-UX3-1-REGISTRE-2)", () => {
  it("rend RIEN tant qu'aucune case n'est cochée (D88 : un état vide se tait)", () => {
    render(<Scene />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("compte les cases cochées, et « Transmettre… » ne porte que les lignes PLANIFIÉES", () => {
    render(<Scene />);
    const [case1, case2] = cases();
    fireEvent.click(case1!);
    fireEvent.click(case2!);

    const barre = screen.getByRole("status");
    expect(barre.textContent).toContain(
      `2 ${t("interventions.selection.plusieurs")}`,
    );

    const formulaireTransmettre = formulaire("/api/interventions/transmettre");
    // "int-2" est `affectee`, pas `planifiee` — absente du formulaire.
    expect(idsDuFormulaire(formulaireTransmettre)).toEqual(["int-1"]);
    expect(formulaireTransmettre.textContent).toContain(
      t("interventions.selection.une_planifiee"),
    );
  });

  it("« Exporter » porte TOUTES les cases cochées, planifiées ou non", () => {
    render(<Scene />);
    const [case1, case2] = cases();
    fireEvent.click(case1!);
    fireEvent.click(case2!);

    const formulaireExport = formulaire("/api/interventions/exporter");
    expect(idsDuFormulaire(formulaireExport).sort()).toEqual([
      "int-1",
      "int-2",
    ]);
    // Les AUTRES filtres actifs (`filtresExport`) voyagent aussi, en champs cachés.
    expect(formulaireExport.querySelector('input[name="vue"]')).toHaveValue(
      "aujourdhui",
    );
  });

  it("ne rend JAMAIS d'action « Poser » en lot (D106)", () => {
    render(<Scene />);
    fireEvent.click(cases()[0]!);
    expect(document.body.textContent).not.toContain(
      t("interventions.colonne.poser"),
    );
  });

  it("« Vider la sélection » efface le compte", () => {
    render(<Scene />);
    fireEvent.click(cases()[0]!);
    const barre = screen.getByRole("status");
    expect(barre.textContent).toContain(t("interventions.selection.vider"));

    const boutonVider = Array.from(barre.querySelectorAll("button")).find(
      (bouton) => bouton.textContent === t("interventions.selection.vider"),
    );
    expect(boutonVider).toBeDefined();
    fireEvent.click(boutonVider!);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("une case cochée puis décochée retire son identifiant du compte", () => {
    render(<Scene />);
    const case1 = cases()[0]!;
    fireEvent.click(case1);
    expect(screen.getByRole("status").textContent).toContain(
      `1 ${t("interventions.selection.un")}`,
    );
    fireEvent.click(case1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

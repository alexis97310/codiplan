import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FriseEtapes, type EtapeFrise } from "@/components/ui/frise-etapes";

const ETAPE_SUR = { prefixe: "Étape", milieu: "sur" };

const ETAPES_EN_COURS: readonly EtapeFrise[] = [
  { cle: "a_planifier", libelle: "À planifier", etat: "faite" },
  { cle: "planifiee", libelle: "Planifiée", etat: "faite" },
  { cle: "affectee", libelle: "Affectée", etat: "faite" },
  { cle: "en_cours", libelle: "En cours", etat: "courante" },
  { cle: "terminee", libelle: "Terminée", etat: "a_venir" },
  { cle: "cloturee", libelle: "Clôturée", etat: "a_venir" },
];

/**
 * LA FRISE D'ÉTAPES (D8, 9EE-TP-UX4-1-FICHE-INTERVENTION-1) — générique,
 * sans statut d'intervention : elle reçoit déjà le libellé et l'état de
 * chaque étape.
 */
describe("FriseEtapes", () => {
  it("rend une liste et marque l'étape courante", () => {
    const { getByRole } = render(
      <FriseEtapes
        etapes={ETAPES_EN_COURS}
        etapeSur={ETAPE_SUR}
        separateur=" · "
      />,
    );
    const liste = getByRole("list");
    expect(liste).not.toBeNull();
    const courante = getByRole("listitem", { current: "step" });
    expect(courante.textContent).toContain("En cours");
  });

  it("rend « Étape N sur TOTAL » pour le téléphone", () => {
    const { getByText } = render(
      <FriseEtapes
        etapes={ETAPES_EN_COURS}
        etapeSur={ETAPE_SUR}
        separateur=" · "
      />,
    );
    expect(getByText(/Étape 4 sur 6/)).not.toBeNull();
  });

  it("ajoute la précision entre parenthèses sur l'étape arrêtée", () => {
    const etapes: readonly EtapeFrise[] = [
      { cle: "a_planifier", libelle: "À planifier", etat: "faite" },
      { cle: "planifiee", libelle: "Planifiée", etat: "faite" },
      { cle: "affectee", libelle: "Affectée", etat: "faite" },
      {
        cle: "en_cours",
        libelle: "En cours",
        etat: "arretee",
        precision: "suspendue",
      },
      { cle: "terminee", libelle: "Terminée", etat: "a_venir" },
      { cle: "cloturee", libelle: "Clôturée", etat: "a_venir" },
    ];
    const { getAllByText } = render(
      <FriseEtapes etapes={etapes} etapeSur={ETAPE_SUR} separateur=" · " />,
    );
    expect(getAllByText(/En cours \(suspendue\)/).length).toBeGreaterThan(0);
  });

  it("ne rend rien quand la liste d'étapes est vide (annulée, reprise)", () => {
    const { container } = render(
      <FriseEtapes etapes={[]} etapeSur={ETAPE_SUR} separateur=" · " />,
    );
    expect(container.innerHTML).toBe("");
  });
});

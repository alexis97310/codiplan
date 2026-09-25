import { describe, expect, it } from "vitest";

import { actionPrincipale } from "@/lib/interventions/action-principale";
import { STATUTS_INTERVENTION } from "@/lib/interventions/saisie";

/**
 * L'ACTION PRINCIPALE DE LA FICHE (93-FICHE-ACTIONS, constat 19).
 *
 * Une fonction pure, une par statut du cycle de vie (huit) — le panneau
 * « Actions » lit ce verdict pour savoir lequel de ses blocs ouvrir.
 */
describe("actionPrincipale — un statut, une réponse", () => {
  it("à_planifier → planifier", () => {
    expect(actionPrincipale("a_planifier")).toBe("planifier");
  });

  it("planifiée → affecter", () => {
    expect(actionPrincipale("planifiee")).toBe("affecter");
  });

  it("suspendue → reprendre", () => {
    expect(actionPrincipale("suspendue")).toBe("reprendre");
  });

  it("terminée → clôturer", () => {
    expect(actionPrincipale("terminee")).toBe("cloturer");
  });

  it("affectée, en cours, clôturée, annulée → aucune", () => {
    for (const statut of [
      "affectee",
      "en_cours",
      "cloturee",
      "annulee",
    ] as const) {
      expect(actionPrincipale(statut)).toBeNull();
    }
  });

  it("les huit statuts du cycle de vie ont chacun une réponse", () => {
    // Le pendant des cas ci-dessus (§9, 01/09) : si un statut manquait à
    // PAR_STATUT, TypeScript le refuserait déjà à la compilation — ce test
    // fige le nombre pour que l'ajout d'un neuvième statut se voie ici aussi.
    expect(STATUTS_INTERVENTION).toHaveLength(8);
    for (const statut of STATUTS_INTERVENTION) {
      expect(() => actionPrincipale(statut)).not.toThrow();
    }
  });
});

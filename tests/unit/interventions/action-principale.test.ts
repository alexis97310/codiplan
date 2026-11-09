import { describe, expect, it } from "vitest";

import { actionPrincipale } from "@/lib/interventions/action-principale";
import { STATUTS_INTERVENTION } from "@/lib/interventions/saisie";

/**
 * L'ACTION PRINCIPALE DE LA FICHE (93-FICHE-ACTIONS, constat 19).
 *
 * Une fonction pure, une par statut du cycle de vie (huit). Depuis
 * 9ES-TP-UX4-3-FICHE-GESTES-2 (D195), la carte « Actions » a quitté la
 * fiche : ce verdict sert désormais à choisir le BOUTON PRIMAIRE de
 * l'en-tête (`TrouverCreneau`/`DialoguePlanifier` sur « planifier »,
 * `DialogueTransmettre` sur « transmettre »), même comportement, mêmes huit
 * réponses.
 */
describe("actionPrincipale — un statut, une réponse", () => {
  it("à_planifier → planifier", () => {
    expect(actionPrincipale("a_planifier", false)).toBe("planifier");
  });

  it("planifiée → transmettre (D141, 9CO-PG-G14A-TRANSMETTRE)", () => {
    expect(actionPrincipale("planifiee", false)).toBe("transmettre");
  });

  it("suspendue → reprendre", () => {
    expect(actionPrincipale("suspendue", false)).toBe("reprendre");
  });

  it("terminée, rapport validé → clôturer", () => {
    expect(actionPrincipale("terminee", true)).toBe("cloturer");
  });

  // 9K09-FICHE-CLOTURE-SUITE-ORIGINE (constat I4 de l'étude du 08/11/2026) —
  // tant que le rapport n'est pas validé, « Clôturer » ouvrirait un dialogue
  // qui n'affiche qu'un refus : ce n'est plus l'action qui compte.
  it("terminée, rapport NON validé → valider_rapport", () => {
    expect(actionPrincipale("terminee", false)).toBe("valider_rapport");
  });

  it("affectée, en cours, clôturée, annulée → aucune", () => {
    for (const statut of [
      "affectee",
      "en_cours",
      "cloturee",
      "annulee",
    ] as const) {
      expect(actionPrincipale(statut, false)).toBeNull();
    }
  });

  it("les huit statuts du cycle de vie ont chacun une réponse", () => {
    // Le pendant des cas ci-dessus (§9, 01/09) : si un statut manquait à
    // PAR_STATUT, TypeScript le refuserait déjà à la compilation — ce test
    // fige le nombre pour que l'ajout d'un neuvième statut se voie ici aussi.
    expect(STATUTS_INTERVENTION).toHaveLength(8);
    for (const statut of STATUTS_INTERVENTION) {
      expect(() => actionPrincipale(statut, false)).not.toThrow();
    }
  });
});

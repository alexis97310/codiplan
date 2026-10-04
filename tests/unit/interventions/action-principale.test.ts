import { describe, expect, it } from "vitest";

import {
  actionPrincipale,
  blocCloturerReplie,
} from "@/lib/interventions/action-principale";
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

  it("planifiée → transmettre (D141, 9CO-PG-G14A-TRANSMETTRE)", () => {
    expect(actionPrincipale("planifiee")).toBe("transmettre");
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

/**
 * LE BLOC « CLÔTURER » SE REPLIE-T-IL ? (99T-G9-CLOTURER-REPLIE, audit G9)
 *
 * Seul le refus « temps non mesuré », hors intervention `terminee`, replie
 * le bloc. Aucun autre refus, aucun autre statut ne le fait.
 */
describe("blocCloturerReplie — TOUT refus hors terminée replie (D160, généralisé depuis temps_manquant)", () => {
  const refusTempsManquant = {
    refuse: true,
    cle: "intervention.refus.temps_manquant",
  } as const;

  it("à_planifier + temps manquant → replié", () => {
    expect(
      blocCloturerReplie({
        statut: "a_planifier",
        verdict: refusTempsManquant,
      }),
    ).toBe(true);
  });

  it("terminée + temps manquant → NON replié", () => {
    expect(
      blocCloturerReplie({ statut: "terminee", verdict: refusTempsManquant }),
    ).toBe(false);
  });

  it("permis (pas de refus) → jamais replié, quel que soit le statut", () => {
    for (const statut of STATUTS_INTERVENTION) {
      expect(blocCloturerReplie({ statut, verdict: { refuse: false } })).toBe(
        false,
      );
    }
  });

  // BASCULE (D160, 9DF-TP-CY2-MATRICE-D8) : `peutCloturer` refuse désormais
  // la plupart des statuts non terminés avec `intervention.refus.pas_terminee`
  // plutôt qu'avec `temps_manquant` — restreindre le repli à cette seule clé
  // aurait laissé `pas_terminee` s'afficher dépliée sur chaque fiche non
  // terminée, le défaut même que G9 a fermé. Tout refus hors terminée replie
  // désormais, quelle que soit sa clé — y compris celles des statuts figés.
  it("tout autre refus que « temps manquant », hors terminée, replie aussi", () => {
    expect(
      blocCloturerReplie({
        statut: "annulee",
        verdict: { refuse: true, cle: "intervention.refus.annulee_figee" },
      }),
    ).toBe(true);
    expect(
      blocCloturerReplie({
        statut: "cloturee",
        verdict: { refuse: true, cle: "intervention.refus.deja_cloturee" },
      }),
    ).toBe(true);
    expect(
      blocCloturerReplie({
        statut: "en_cours",
        verdict: { refuse: true, cle: "intervention.refus.pas_terminee" },
      }),
    ).toBe(true);
  });

  it("chaque statut non terminée avec temps manquant replie, terminée seule ne replie pas", () => {
    for (const statut of STATUTS_INTERVENTION) {
      const attendu = statut !== "terminee";
      expect(blocCloturerReplie({ statut, verdict: refusTempsManquant })).toBe(
        attendu,
      );
    }
  });
});

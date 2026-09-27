import { describe, expect, it } from "vitest";

import { t } from "@/lib/i18n/fr";

/**
 * GR17-M16 (audit GR du 26/09/2026, constat M16) — « NATURE » LÀ OÙ LES
 * FORMULAIRES DISAIENT « TYPE ».
 *
 * `intervention.type` (« Nature ») porte déjà le mot imposé pour ce champ
 * (fr.ts) ; ces deux clés-ci désignaient la même notion par « type ».
 */
describe("GR17-M16 — « Nature » partout", () => {
  it("interventions.filtre_type_tous ne contient plus « type »", () => {
    expect(t("interventions.filtre_type_tous")).toBe("Toutes les natures");
    expect(t("interventions.filtre_type_tous").toLowerCase()).not.toContain(
      "type",
    );
  });

  it("machine.fiche.historique_colonne_type ne contient plus « type »", () => {
    expect(t("machine.fiche.historique_colonne_type")).toBe("Nature");
    expect(
      t("machine.fiche.historique_colonne_type").toLowerCase(),
    ).not.toContain("type");
  });
});

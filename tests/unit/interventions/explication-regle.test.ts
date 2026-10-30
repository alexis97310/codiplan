import { describe, expect, it } from "vitest";

import { fr } from "@/lib/i18n/fr";
import { explicationRegle } from "@/lib/interventions/presentation-partagee";
import {
  REGLE_HISTORIQUE,
  REGLE_PAR_DEFAUT,
} from "@/lib/tarification/valorisation";

/**
 * 9I8A1-REPRISE-9I8A, décision d'Alexis du 29/10/2026 — la phrase affichée
 * doit dire la règle RÉELLE, jamais « au quart d'heure » quand ce n'est pas
 * la règle de la société. Deux garde-fous : la phrase change bien avec les
 * paramètres (pas une chaîne figée), et elle ne redit jamais le vocabulaire
 * de l'ancienne règle quand ce n'est pas elle.
 */
describe("explicationRegle — la phrase dit la règle réelle", () => {
  it("la nouvelle règle (60/30/5) nomme 1 h, 30 min et 5 min", () => {
    const phrase = explicationRegle(REGLE_PAR_DEFAUT);
    expect(phrase).toContain("1 h 00");
    expect(phrase).toContain("30 min");
    expect(phrase).toContain("5 min");
  });

  it("l'ancienne règle (60/15/1) nomme 1 h, 15 min et 1 min", () => {
    const phrase = explicationRegle(REGLE_HISTORIQUE);
    expect(phrase).toContain("1 h 00");
    expect(phrase).toContain("15 min");
    expect(phrase).toContain("1 min");
  });

  it("ne dit jamais « quart d'heure » quand la règle n'est pas celle-ci", () => {
    const phrase = explicationRegle(REGLE_PAR_DEFAUT);
    expect(phrase).not.toContain("quart d'heure");
  });

  it("n'est pas la même phrase pour les deux règles", () => {
    expect(explicationRegle(REGLE_PAR_DEFAUT)).not.toBe(
      explicationRegle(REGLE_HISTORIQUE),
    );
  });

  it("se compose à partir des fragments du dictionnaire, pas d'une phrase en dur", () => {
    const phrase = explicationRegle(REGLE_PAR_DEFAUT);
    expect(
      phrase.startsWith(fr["intervention.cloture.explication_plancher_avant"]),
    ).toBe(true);
    expect(phrase).toContain(
      fr["intervention.cloture.explication_palier_milieu"],
    );
  });
});

import { describe, expect, it } from "vitest";

import { t } from "@/lib/i18n/fr";
import {
  ligneNonConforme,
  suiteAvecLigne,
} from "@/lib/checklists/suite-preremplie";

/**
 * LE PRÉREMPLISSAGE DE « SUITE À DONNER » (9K21-CHECKLIST-TERRAIN-SAISIE,
 * CK5, point 3) — FONCTIONS PURES. `checklist-terrain.tsx` compose la ligne,
 * `rapport-automatique.tsx` l'ajoute sans jamais la dupliquer.
 */

describe("ligneNonConforme", () => {
  it("compose « section — libellé : Non conforme » avec les séparateurs du dictionnaire", () => {
    expect(ligneNonConforme("Freins", "Plaquette avant")).toBe(
      `Freins${t("ponctuation.separateur")}Plaquette avant${t(
        "ponctuation.deux_points",
      )}${t("checklist.terrain.non_conforme")}`,
    );
  });
});

describe("suiteAvecLigne", () => {
  it("ajoute la ligne à une suite vide", () => {
    expect(suiteAvecLigne("", "Freins — Plaquette avant : Non conforme")).toBe(
      "Freins — Plaquette avant : Non conforme",
    );
  });

  it("ajoute la ligne à la fin d'une suite déjà écrite, séparée par un retour à la ligne", () => {
    expect(
      suiteAvecLigne("Déjà écrit par le technicien.", "Freins : Non conforme"),
    ).toBe("Déjà écrit par le technicien.\nFreins : Non conforme");
  });

  it("jamais en double — la ligne déjà présente laisse le texte inchangé", () => {
    const suite = "Avant.\nFreins : Non conforme\nAprès.";
    expect(suiteAvecLigne(suite, "Freins : Non conforme")).toBe(suite);
  });

  it("une ligne EFFACÉE par le technicien est réécrite au prochain passage à non conforme", () => {
    // Le technicien a retiré la ligne lui-même — cette fonction ne connaît
    // que le texte ACTUEL, jamais un historique de ce qui a déjà été ajouté.
    expect(
      suiteAvecLigne("Texte du technicien.", "Freins : Non conforme"),
    ).toBe("Texte du technicien.\nFreins : Non conforme");
  });
});

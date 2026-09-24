import { describe, expect, it } from "vitest";

import { formatAdresseSite } from "@/lib/interventions/bon";

/**
 * `formatAdresseSite` (BON-3) — LA RUE DE `site.adresse` PUIS LA COMMUNE, EN
 * UNE LIGNE.
 *
 * Le constat du ticket : le bon n'affichait ni l'adresse ni le numéro de
 * série d'une machine — cette fonction porte la première moitié du correctif,
 * testée seule, hors de toute lecture en base (`lireBonIntervention` reste
 * couvert par `tests/isolation/bon-intervention.test.ts` et par
 * `tests/e2e/bon-3.spec.ts`).
 */
describe("formatAdresseSite", () => {
  it("rend null quand ni l'adresse ni la commune ne sont renseignées", () => {
    expect(formatAdresseSite(null, null)).toBeNull();
  });

  it("rend la commune seule quand l'adresse est absente", () => {
    expect(formatAdresseSite(null, "Nouméa")).toBe("Nouméa");
  });

  it("rend la rue seule quand la commune est absente", () => {
    expect(formatAdresseSite({ rue: "1 rue de la Démonstration" }, null)).toBe(
      "1 rue de la Démonstration",
    );
  });

  it("rend la rue et la commune, jointes par une virgule", () => {
    expect(
      formatAdresseSite({ rue: "1 rue de la Démonstration" }, "Nouméa"),
    ).toBe("1 rue de la Démonstration, Nouméa");
  });

  it("ignore une adresse sans clé « rue » exploitable", () => {
    expect(formatAdresseSite({ boite_postale: "BP 1" }, "Nouméa")).toBe(
      "Nouméa",
    );
  });

  it("jamais undefined, même sur une adresse et une commune vides", () => {
    expect(formatAdresseSite({ rue: "" }, "")).toBeNull();
  });
});

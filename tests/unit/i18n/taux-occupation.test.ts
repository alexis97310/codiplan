import { describe, expect, it } from "vitest";

import { fr } from "@/lib/i18n/fr";

/**
 * LE TAUX D'OCCUPATION, ET LE MOT QU'IL NE FAUT PAS EMPLOYER (D76).
 *
 * Le rapport mesure une OCCUPATION — tout le temps passé en intervention,
 * facturé ou non. « Productivité » ferait lire un rendement là où il y a une
 * occupation, et quelqu'un déciderait sur ce chiffre. Le nom est fixé au
 * dictionnaire AVANT que l'écran existe (lot 3), avec sa formule à côté, et ce
 * gardien refuse que l'autre mot y entre — à la forme près (§9, 26/08) : casse,
 * accent, pluriel, adjectif.
 */
describe("le taux d'occupation a son nom, sa formule, et pas d'autre nom", () => {
  it("porte le nom, la formule et la définition, côte à côte", () => {
    expect(fr["vocabulaire.taux_occupation"]).toBe("Taux d'occupation");
    expect(fr["vocabulaire.taux_occupation.formule"]).toContain("÷");
    expect(fr["vocabulaire.taux_occupation.formule"]).toMatch(
      /heures d'intervention/,
    );
    expect(fr["vocabulaire.taux_occupation.formule"]).toMatch(
      /heures travaillées/,
    );
    expect(fr["vocabulaire.taux_occupation.definition"]).toMatch(/factur/);
  });

  it("le mot « productivité » n'entre pas dans le dictionnaire, sous aucune forme", () => {
    const fautives = Object.entries(fr).filter(([, valeur]) =>
      /producti[fv]/i.test(valeur),
    );
    expect(
      fautives.map(([cle]) => cle),
      "un rendement là où il y a une occupation : le nom est « taux d'occupation » (D76)",
    ).toEqual([]);
  });

  it("TÉMOIN — le gardien reconnaît bien la forme qu'il refuse", () => {
    const formes = ["Productivité", "PRODUCTIVITE", "productif", "productive"];
    for (const forme of formes) {
      expect(/producti[fv]/i.test(forme), forme).toBe(true);
    }
  });
});

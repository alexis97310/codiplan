import { describe, expect, it } from "vitest";

import { fr, t } from "@/lib/i18n/fr";

// Arbitrage D26 — dictionnaire plat, aucune chaîne visible en dur dans un composant.
describe("dictionnaire français", () => {
  it("est plat : toutes les valeurs sont des chaînes non vides", () => {
    for (const [cle, valeur] of Object.entries(fr)) {
      expect(typeof valeur, `la clé ${cle} n'est pas une chaîne`).toBe(
        "string",
      );
      expect(valeur.trim().length, `la clé ${cle} est vide`).toBeGreaterThan(0);
    }
  });

  it("expose le nom du produit tel qu'il doit s'afficher", () => {
    expect(t("app.nom")).toBe("CODIPLAN");
  });
});

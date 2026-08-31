import { describe, expect, it } from "vitest";

import { fr, t } from "@/lib/i18n/fr";

/**
 * Le dictionnaire français (arbitrage D26, tickets L0-01 et L0-11).
 *
 * **C'est ici, et seulement ici, qu'une chaîne attendue s'écrit en toutes
 * lettres.** Le dictionnaire est le SUJET de ce scénario : vérifier que
 * `app.nom` vaut bien « CODIPLAN » y est une assertion sur le contenu, et non
 * une chaîne visible échappée du dictionnaire. Les scénarios de rendu, eux, ne
 * recopient rien — ils comparent l'écran au dictionnaire (voir
 * `sans-chaine-visible-en-dur.test.ts`). C'est la coupure de L0-11 appliquée
 * aux tests : le texte a le droit d'être écrit là où il est vérifié, jamais là
 * où il est affiché.
 */
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
    expect(t("accueil.titre")).toBe("CODIPLAN");
  });
});

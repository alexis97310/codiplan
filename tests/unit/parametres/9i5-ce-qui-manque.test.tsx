import { describe, expect, it } from "vitest";

import { fr } from "@/lib/i18n/fr";

/**
 * 9I5-ECRANS-INCOMPLETS-LE-DISENT — « Données à compléter » dit ce qu'elle
 * ne compte pas encore.
 *
 * **CE FICHIER NE REND PLUS RIEN (9IC-CORRECTIFS-COURTS, réserve du solde
 * 596)** — une version antérieure rendait son PROPRE `<Page>`/`<p>`,
 * tautologique. La preuve que la page l'affiche RÉELLEMENT est désormais
 * `tests/e2e/9i5-ce-qui-manque.spec.ts`, qui ouvre `/parametres/donnees` et
 * lit la phrase (clés + mots composés) dans la vraie page rendue. Ce
 * fichier ne garde que ce qui se mesure sans rendu — la FORME des trois
 * clés elles-mêmes.
 */
describe("donnees_a_completer.sous_titre_manquant_* — la forme de la phrase", () => {
  it("nomme les cinq points hors de ce lot (D170, QE-19 (a)), sans promettre de date, sans écrire « site » ni « agence »", () => {
    for (const cle of [
      "donnees_a_completer.sous_titre_manquant_1",
      "donnees_a_completer.sous_titre_manquant_2",
      "donnees_a_completer.sous_titre_manquant_3",
    ] as const) {
      expect(fr[cle].toLowerCase()).not.toMatch(/\b(?:agences?|sites?)\b/);
      expect(fr[cle].toLowerCase()).not.toMatch(/bientôt|prochainement|lot \d/);
    }
    expect(fr["donnees_a_completer.sous_titre_manquant_1"]).toContain(
      "Cinq autres",
    );
  });
});

import { describe, expect, it } from "vitest";

import { fr } from "@/lib/i18n/fr";

/**
 * 9I5-ECRANS-INCOMPLETS-LE-DISENT — la fiche machine dit ce qu'elle ne
 * montre pas encore.
 *
 * **CE FICHIER NE REND PLUS RIEN (9IC-CORRECTIFS-COURTS, réserve du solde
 * 596)** — une version antérieure rendait son PROPRE `<Page sousTitre=…>`,
 * tautologique. La preuve que la page l'affiche RÉELLEMENT est désormais
 * `tests/e2e/9i5-ce-qui-manque.spec.ts`, qui ouvre une vraie fiche machine
 * et lit la phrase dans le sous-titre de `Page`. Ce fichier ne garde que ce
 * qui se mesure sans rendu — la FORME de la phrase elle-même.
 */
describe("machine.fiche.sous_titre_manquant — la forme de la phrase", () => {
  it("nomme les gestes et la carte VGP absents (D192, QT-12), au présent, sans promettre de date", () => {
    const texte = fr["machine.fiche.sous_titre_manquant"];
    expect(texte).toContain("l'historique de ses interventions");
    expect(texte).toContain("gestes sur la machine");
    expect(texte).toContain("carte VGP séparée");
    expect(texte.toLowerCase()).not.toMatch(/bientôt|prochainement|lot \d/);
  });
});

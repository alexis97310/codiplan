import { describe, expect, it } from "vitest";

import { fr } from "@/lib/i18n/fr";

/**
 * 9I5-ECRANS-INCOMPLETS-LE-DISENT — le registre VGP dit ce qu'il ne montre
 * pas encore.
 *
 * **CE FICHIER NE REND PLUS RIEN (9IC-CORRECTIFS-COURTS, réserve du solde
 * 596)** — une version antérieure rendait son PROPRE `<Page>`/`<p>`,
 * tautologique. La preuve que la page l'affiche RÉELLEMENT est désormais
 * `tests/e2e/9i5-ce-qui-manque.spec.ts`, qui ouvre `/vgp` et lit la phrase
 * dans la vraie page rendue. Ce fichier ne garde que ce qui se mesure sans
 * rendu — la FORME de la phrase elle-même.
 */
describe("vgp.sous_titre_manquant — la forme de la phrase", () => {
  it("nomme l'absence de l'onglet « Réserves », au présent, sans promettre de date", () => {
    const texte = fr["vgp.sous_titre_manquant"];
    expect(texte).toContain("réserves");
    expect(texte.toLowerCase()).not.toMatch(/bientôt|prochainement|lot \d/);
  });
});

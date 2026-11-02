import { describe, expect, it } from "vitest";

import { fr } from "@/lib/i18n/fr";

/**
 * 9I5-ECRANS-INCOMPLETS-LE-DISENT — « Ma journée » dit ce qu'elle ne montre
 * pas encore.
 *
 * **CE FICHIER NE REND PLUS RIEN (9IC-CORRECTIFS-COURTS, réserve du solde
 * 596)** — une version antérieure rendait son PROPRE `<p>{t("terrain.
 * sous_titre_manquant")}`, tautologique : elle passait même si la VRAIE
 * page perdait la phrase. La preuve que la page l'affiche RÉELLEMENT est
 * désormais `tests/e2e/9i5-ce-qui-manque.spec.ts`, qui ouvre `/terrain` et
 * lit la phrase dans la vraie page rendue. Ce fichier ne garde que ce qui
 * se mesure sans rendu — la FORME de la phrase elle-même.
 */
describe("terrain.sous_titre_manquant — la forme de la phrase", () => {
  it("nomme l'absence de la liste des machines (D161, TP-PARC), sans promettre de date", () => {
    const texte = fr["terrain.sous_titre_manquant"];
    expect(texte).toContain("La liste de vos machines");
    expect(texte.toLowerCase()).not.toMatch(/bientôt|prochainement|lot \d/);
  });
});

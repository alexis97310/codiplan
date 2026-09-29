import { describe, expect, it } from "vitest";

import { fr } from "@/lib/i18n/fr";

/**
 * DEUX AIDES PROMETTAIENT UN USAGE QUE D107 Q3 DIFFÈRE (CS34, audit du
 * 28/09/2026).
 *
 * D74 écrivait que le temps de trajet sert « au calcul de charge et à
 * l'ordonnancement des tournées » ; D107 Q3 (docs/arbitrages.md) diffère les
 * tournées. Les deux aides qui répétaient cette promesse — celle du champ sur
 * la fiche d'un site, et celle du réglage de société — ne doivent plus
 * mentionner les tournées.
 */
describe("les aides de temps de trajet ne promettent plus les tournées (D107 Q3)", () => {
  it.each([
    "site.temps_trajet_min.aide",
    "trajets.explication_planification",
  ] as const)("%s ne contient pas « tournées »", (cle) => {
    expect(fr[cle]).not.toMatch(/tourn[ée]es?/i);
  });
});

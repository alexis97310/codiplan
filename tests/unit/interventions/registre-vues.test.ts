import { describe, expect, it } from "vitest";

import {
  schemaRechercheInterventions,
  VUES_REGISTRE,
} from "@/lib/interventions/saisie";

/**
 * LES SIX ONGLETS DU REGISTRE (52-REGISTRE-1, SAV-07) — LA PART PURE.
 *
 * `schemaRechercheInterventions` ne touche pas la base (comme
 * `tests/unit/interventions/recherche.test.ts` l'éprouve déjà pour les
 * quatre autres filtres) : une `vue` INCONNUE retombe à `null` (« aucune
 * vue »), jamais une erreur — un favori périmé ou une URL tapée à la main ne
 * doit pas faire échouer toute la recherche.
 *
 * **Le CRITÈRE que chaque vue produit** — `criteresVue`,
 * `lib/interventions/depot.ts` — n'est PAS testé ICI : elle est PRIVÉE, sans
 * appelant hors de son fichier, et R3-12 refuse qu'une fonction de dépôt
 * EXPORTÉE reste sans chemin depuis `app/` (`tests/unit/gardiens/chemins-de-depot.test.ts`).
 * L'exporter pour cette seule épreuve aurait été l'exception que ce gardien
 * existe pour refuser. Son critère est donc éprouvé là où il est ATTEINT :
 * sous la vraie table, par `tests/isolation/ecran-intervention.test.ts`, à
 * travers les fonctions réellement exportées et réellement appelées depuis
 * `/interventions` — `listerInterventions`, `compterInterventions`,
 * `compterParVue`.
 */

describe("schemaRechercheInterventions — la vue", () => {
  it("aucune vue fournie : `null`", () => {
    expect(schemaRechercheInterventions.parse({}).vue).toBeNull();
  });

  it("accepte chacune des six vues, une par une — témoin de population", () => {
    for (const vue of VUES_REGISTRE) {
      expect(schemaRechercheInterventions.parse({ vue }).vue).toBe(vue);
    }
  });

  it("une vue INCONNUE retombe à `null`, JAMAIS une erreur", () => {
    const analyse = schemaRechercheInterventions.safeParse({
      vue: "n-importe-quoi",
    });
    expect(analyse.success).toBe(true);
    expect(analyse.success && analyse.data.vue).toBeNull();
  });

  it("une chaîne vide (case vide) retombe aussi à `null`", () => {
    expect(schemaRechercheInterventions.parse({ vue: "" }).vue).toBeNull();
  });

  it("une valeur qui n'est pas une chaîne (tableau, nombre…) retombe à `null`, jamais une erreur", () => {
    expect(
      schemaRechercheInterventions.safeParse({
        vue: ["a_planifier", "en_cours"],
      }).success,
    ).toBe(true);
    expect(
      schemaRechercheInterventions.parse({ vue: ["a_planifier", "en_cours"] })
        .vue,
    ).toBeNull();
  });
});

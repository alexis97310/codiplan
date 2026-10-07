import { describe, expect, it } from "vitest";

import {
  PRIORITES,
  schemaRechercheInterventions,
  VALEURS_SUIVI,
  VUES_REGISTRE,
} from "@/lib/interventions/saisie";

/**
 * LES HUIT ONGLETS DU REGISTRE (52-REGISTRE-1, SAV-07 ; `en_retard` et
 * `a_venir` ajoutées par PG-C1c-EN-RETARD-REGISTRE) — LA PART PURE.
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

  it("accepte chacune des huit vues, une par une — témoin de population", () => {
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

  // DÉCISION 13 D'ALEXIS DU 05/10/2026 (TP-UX3-1-REGISTRE-1) — `"toutes"`
  // n'est PAS dans `VUES_REGISTRE` : elle retombe à `null` par le même
  // chemin qu'une valeur inconnue, jamais une neuvième valeur ajoutée à la
  // liste fermée. C'est `vueEffectiveDuRegistre`
  // (`app/(back-office)/interventions/presentation.ts`), pas ce schéma, qui
  // distingue « toutes » de « absent ».
  it("« toutes » retombe à `null`, par le MÊME chemin qu'une valeur inconnue", () => {
    expect(
      schemaRechercheInterventions.parse({ vue: "toutes" }).vue,
    ).toBeNull();
  });
});

describe("schemaRechercheInterventions — la priorité (TP-UX3-1-REGISTRE-1)", () => {
  it("aucune priorité fournie : `null`", () => {
    expect(schemaRechercheInterventions.parse({}).priorite).toBeNull();
  });

  it("accepte chacune des quatre priorités", () => {
    for (const priorite of PRIORITES) {
      expect(schemaRechercheInterventions.parse({ priorite }).priorite).toBe(
        priorite,
      );
    }
  });

  it("une valeur invalide fait échouer tout le schéma — même défense que `type`/`statut`, deux autres `<select>` fermés", () => {
    expect(
      schemaRechercheInterventions.safeParse({ priorite: "p9" }).success,
    ).toBe(false);
  });

  it("une chaîne vide retombe à `null`", () => {
    expect(
      schemaRechercheInterventions.parse({ priorite: "" }).priorite,
    ).toBeNull();
  });
});

describe("schemaRechercheInterventions — le suivi (TP-UX3-1-REGISTRE-1, QE-8)", () => {
  it("aucun suivi fourni : `null`", () => {
    expect(schemaRechercheInterventions.parse({}).suivi).toBeNull();
  });

  // LA POPULATION EXACTE — DEUX valeurs, jamais trois : « Retours sous 30
  // jours » (RG-INT-10) en est délibérément absente (voir l'en-tête de
  // `VALEURS_SUIVI`), pas oubliée. Un `toEqual` sur un TABLEAU partiel ne le
  // prouverait pas — une troisième valeur AJOUTÉE passerait quand même la
  // boucle ci-dessous.
  it("VALEURS_SUIVI — EXACTEMENT deux valeurs, dans cet ordre", () => {
    expect(VALEURS_SUIVI).toEqual(["sans_duree_a_venir", "garantie_ouvertes"]);
  });

  it("accepte « sans_duree_a_venir » et « garantie_ouvertes », une par une", () => {
    for (const suivi of VALEURS_SUIVI) {
      expect(schemaRechercheInterventions.parse({ suivi }).suivi).toBe(suivi);
    }
  });

  it("une valeur inconnue retombe à `null`, jamais une erreur", () => {
    const analyse = schemaRechercheInterventions.safeParse({
      suivi: "n-importe-quoi",
    });
    expect(analyse.success).toBe(true);
    expect(analyse.success && analyse.data.suivi).toBeNull();
  });

  // « RETOURS SOUS 30 JOURS » NOMMÉMENT — pas un témoin générique
  // (« n'importe quoi » ci-dessus) : CETTE valeur précise, que la spécification
  // nomme et que `VALEURS_SUIVI` exclut par choix (le pilote C1), retombe au
  // MÊME `null` qu'une valeur inconnue — jamais une option acceptée en
  // silence si quelqu'un la réintroduisait côté client sans toucher ce
  // schéma.
  it("« retours_30_jours » — ABSENTE de la liste fermée, retombe à `null`", () => {
    const analyse = schemaRechercheInterventions.safeParse({
      suivi: "retours_30_jours",
    });
    expect(analyse.success).toBe(true);
    expect(analyse.success && analyse.data.suivi).toBeNull();
  });
});

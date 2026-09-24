import { describe, expect, it } from "vitest";

import { criteresVue } from "@/lib/interventions/depot";
import {
  schemaRechercheInterventions,
  VUES_REGISTRE,
} from "@/lib/interventions/saisie";

/**
 * LES SIX ONGLETS DU REGISTRE (52-REGISTRE-1, SAV-07).
 *
 * Deux choses, pures, sans base :
 *
 * 1. `schemaRechercheInterventions` — une `vue` INCONNUE retombe à `null`
 *    (« aucune vue »), jamais une erreur : un favori périmé ou une URL tapée
 *    à la main ne doit pas faire échouer toute la recherche.
 * 2. `criteresVue` — chaque vue produit EXACTEMENT le critère que le ticket
 *    nomme, ni plus ni moins ; `null` (« Toutes », ou une vue inconnue déjà
 *    ramenée à `null` par le schéma) n'ajoute rien.
 *
 * `filtreDesInterventions`, qui compose ce critère avec les autres filtres du
 * formulaire, reste privée : elle est éprouvée sous la vraie table par
 * `tests/isolation/ecran-intervention.test.ts`.
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
});

describe("criteresVue — le critère de chaque onglet", () => {
  const AUJOURDHUI = {
    debut: new Date("2026-09-24T00:00:00.000Z"),
    fin: new Date("2026-09-25T00:00:00.000Z"),
  };

  it("`null` — « Toutes » — n'ajoute rien", () => {
    expect(criteresVue(null, AUJOURDHUI)).toEqual({});
    expect(criteresVue(null, null)).toEqual({});
  });

  it("`a_planifier` — le statut, et lui seul", () => {
    expect(criteresVue("a_planifier", AUJOURDHUI)).toEqual({
      statut: "a_planifier",
    });
  });

  it("`en_cours` — le statut, et lui seul", () => {
    expect(criteresVue("en_cours", AUJOURDHUI)).toEqual({
      statut: "en_cours",
    });
  });

  it("`bloquees` — le statut `suspendue`", () => {
    expect(criteresVue("bloquees", AUJOURDHUI)).toEqual({
      statut: "suspendue",
    });
  });

  it("`a_controler` — le statut `terminee`, jamais `cloturee`", () => {
    expect(criteresVue("a_controler", AUJOURDHUI)).toEqual({
      statut: "terminee",
    });
  });

  it("`historique` — `cloturee` OU `annulee`, les deux fins de cycle", () => {
    expect(criteresVue("historique", AUJOURDHUI)).toEqual({
      statut: { in: ["cloturee", "annulee"] },
    });
  });

  it("`aujourdhui` — la borne du jour civil, EXCLUSIVE en fin", () => {
    expect(criteresVue("aujourdhui", AUJOURDHUI)).toEqual({
      date_planifiee: { gte: AUJOURDHUI.debut, lt: AUJOURDHUI.fin },
    });
  });

  it("`aujourdhui` SANS la borne du jour — l'appelant ne l'a pas calculée — n'ajoute rien", () => {
    // Même économie que `sans_duree_a_venir` : `listerInterventions` ne
    // calcule `debutDuJour` que lorsque cette vue est active. Si jamais elle
    // manquait, le critère ne doit pas fabriquer une borne fausse.
    expect(criteresVue("aujourdhui", null)).toEqual({});
  });
});

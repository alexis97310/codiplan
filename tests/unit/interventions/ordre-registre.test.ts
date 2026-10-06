import { describe, expect, it } from "vitest";

import { ordreDuRegistre } from "@/lib/interventions/ordre-registre";
import { fr } from "@/lib/i18n";
import { VUES_REGISTRE } from "@/lib/interventions/saisie";

/**
 * L'ORDRE DU REGISTRE, PAR ONGLET (TP-UX3-1-REGISTRE-1, QE-8) — LA PART
 * PURE : `ordreDuRegistre` ne touche pas la base, elle dit seulement
 * l'`orderBy` et la clé de texte que chaque vue porte.
 *
 * Le fait que cet `orderBy` retrouve réellement les bonnes lignes, DANS LE
 * BON ORDRE, sous la vraie table, est éprouvé ailleurs
 * (`tests/isolation/ecran-intervention.test.ts`) — jamais recopié ici.
 */
describe("ordreDuRegistre — chaque vue porte un ordre ET une clé de texte", () => {
  it("témoin de non-vacuité — les huit vues, plus « Toutes », ont chacune un ordre", () => {
    const vues: readonly (typeof VUES_REGISTRE)[number][] = VUES_REGISTRE;
    expect(vues.length).toBe(8);
  });

  it("« Toutes » (vue=null) place les lignes SANS DATE en tête", () => {
    const ordre = ordreDuRegistre(null);
    expect(ordre.orderBy[0]).toEqual({
      date_planifiee: { sort: "desc", nulls: "first" },
    });
    expect(ordre.cleTri).toBe("interventions.ordre.toutes");
  });

  it("« À planifier » trie par priorité, puis par la plus ancienne création", () => {
    const ordre = ordreDuRegistre("a_planifier");
    expect(ordre.orderBy[0]).toEqual({ priorite: "asc" });
    expect(ordre.orderBy[1]).toEqual({ cree_le: "asc" });
    expect(ordre.cleTri).toBe("interventions.ordre.a_planifier");
  });

  it("« Aujourd'hui » et « En cours » trient par heure de créneau", () => {
    expect(ordreDuRegistre("aujourdhui").orderBy[0]).toEqual({
      creneau_debut: { sort: "asc", nulls: "last" },
    });
    expect(ordreDuRegistre("en_cours").orderBy[0]).toEqual({
      creneau_debut: { sort: "asc", nulls: "last" },
    });
  });

  it("« En retard » et « À contrôler » trient par la date prévue la plus ancienne", () => {
    expect(ordreDuRegistre("en_retard").orderBy[0]).toEqual({
      date_planifiee: "asc",
    });
    expect(ordreDuRegistre("a_controler").orderBy[0]).toEqual({
      date_planifiee: "asc",
    });
  });

  it("« Suspendues » trie par la suspension la plus ancienne", () => {
    expect(ordreDuRegistre("bloquees").orderBy[0]).toEqual({
      suspendue_le: { sort: "asc", nulls: "last" },
    });
  });

  it("« À venir » et « Historique » gardent le MÊME ordre qu'avant ce ticket", () => {
    const aVenir = ordreDuRegistre("a_venir");
    const historique = ordreDuRegistre("historique");
    expect(aVenir.orderBy).toEqual(historique.orderBy);
    expect(aVenir.orderBy[0]).toEqual({
      date_planifiee: { sort: "desc", nulls: "last" },
    });
    expect(aVenir.cleTri).toBe(historique.cleTri);
  });

  it("`id` départage toujours en dernier — la pagination reste stable", () => {
    for (const vue of [null, ...VUES_REGISTRE]) {
      const ordre = ordreDuRegistre(vue);
      expect(ordre.orderBy.at(-1)).toEqual({ id: "desc" });
    }
  });

  it("chaque `cleTri` existe réellement dans le dictionnaire", () => {
    for (const vue of [null, ...VUES_REGISTRE]) {
      const cle = ordreDuRegistre(vue).cleTri;
      expect(fr[cle], cle).toBeDefined();
      expect(typeof fr[cle]).toBe("string");
    }
  });
});

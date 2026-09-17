import { describe, expect, it } from "vitest";

import {
  LIMITE_RECHERCHE_PAR_DEFAUT,
  schemaRechercheInterventions,
  STATUTS_INTERVENTION,
  TYPES_INTERVENTION,
} from "@/lib/interventions/saisie";

/**
 * LA RECHERCHE DU REGISTRE (AT-07) — les quatre filtres que la maquette
 * annonce (agence, type, statut, période), et la pagination.
 *
 * Ce module est PUR : `lib/interventions/depot.ts` applique ces critères sous
 * le contexte cloisonné (`tests/isolation/ecran-intervention.test.ts`
 * confronte les deux).
 */

describe("schemaRechercheInterventions", () => {
  it("cherche tout, sans critère", () => {
    const analyse = schemaRechercheInterventions.parse({});
    expect(analyse.texte).toBeNull();
    expect(analyse.agence_id).toBeNull();
    expect(analyse.type).toBeNull();
    expect(analyse.statut).toBeNull();
    expect(analyse.du).toBeNull();
    expect(analyse.au).toBeNull();
    expect(analyse.page).toBe(1);
  });

  it("ramène un texte vide à `null` — pas de filtre sur du vide", () => {
    expect(
      schemaRechercheInterventions.parse({ texte: "   " }).texte,
    ).toBeNull();
  });

  describe("les filtres à choix — une case vide soumet une chaîne vide, jamais `null`", () => {
    it("un `<select>` d'agence non choisi (chaîne vide) redevient `null`", () => {
      expect(
        schemaRechercheInterventions.parse({ agence_id: "" }).agence_id,
      ).toBeNull();
    });

    it("accepte chacun des types et des statuts réels, un par un", () => {
      // Témoin de population : un type ou un statut ajouté demain doit encore
      // passer, sans qu'on ait eu à toucher ce test.
      for (const type of TYPES_INTERVENTION) {
        expect(schemaRechercheInterventions.parse({ type }).type).toBe(type);
      }
      for (const statut of STATUTS_INTERVENTION) {
        expect(schemaRechercheInterventions.parse({ statut }).statut).toBe(
          statut,
        );
      }
    });

    it("un type ou un statut hors énumération est REFUSÉ, jamais accepté par hasard", () => {
      expect(
        schemaRechercheInterventions.safeParse({ type: "n_importe_quoi" })
          .success,
      ).toBe(false);
      expect(
        schemaRechercheInterventions.safeParse({ statut: "n_importe_quoi" })
          .success,
      ).toBe(false);
    });

    it("une case vide (chaîne vide) redevient `null`, pour type ET statut", () => {
      expect(schemaRechercheInterventions.parse({ type: "" }).type).toBeNull();
      expect(
        schemaRechercheInterventions.parse({ statut: "" }).statut,
      ).toBeNull();
    });
  });

  describe("la période", () => {
    it("accepte une borne de début seule, une borne de fin seule, ou les deux", () => {
      expect(
        schemaRechercheInterventions.parse({ du: "2026-01-01" }).du,
      ).toEqual(new Date("2026-01-01"));
      expect(
        schemaRechercheInterventions.parse({ au: "2026-01-31" }).au,
      ).toEqual(new Date("2026-01-31"));
    });

    it("REFUSE une fin qui précède le début — la période ne veut rien dire", () => {
      expect(
        schemaRechercheInterventions.safeParse({
          du: "2026-02-01",
          au: "2026-01-01",
        }).success,
      ).toBe(false);
    });

    it("LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON : une fin égale au début est permise", () => {
      // Une seule journée est une période valide — sans ce cas, un refus câblé
      // sur `au <= du` passerait l'épreuve précédente pour la mauvaise raison.
      expect(
        schemaRechercheInterventions.safeParse({
          du: "2026-01-15",
          au: "2026-01-15",
        }).success,
      ).toBe(true);
    });
  });

  describe("la pagination (AT-07)", () => {
    it("pagine à partir de 1, et refuse une page absurde", () => {
      expect(schemaRechercheInterventions.parse({}).page).toBe(1);
      expect(schemaRechercheInterventions.parse({ page: "3" }).page).toBe(3);
      expect(schemaRechercheInterventions.safeParse({ page: 0 }).success).toBe(
        false,
      );
    });

    it("la taille de page tient sous une valeur raisonnable — le seuil du 50 lignes du 16/09", () => {
      expect(LIMITE_RECHERCHE_PAR_DEFAUT).toBeLessThanOrEqual(50);
    });
  });
});

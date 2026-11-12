import { describe, expect, it } from "vitest";

import { prestationsProposees } from "@/lib/prestations/regle-type";
import { schemaPrestation } from "@/lib/prestations/saisie";
import {
  preparerUnePrestation,
  typesDepuisLaCellule,
  MOTIF_TYPE_INTERVENTION_INCONNU,
} from "@/lib/imports/modeles";

/**
 * 9K29-PRESTATIONS-PAR-TYPE-INTERVENTION, D243.
 *
 * Décision d'Alexis du 11/11/2026 : une prestation SANS type renseigné reste
 * proposée pour TOUS les types ; dès qu'un type au moins est coché, elle
 * n'est proposée que pour ces types. Une prestation déjà déclarée réalisée
 * reste affichée, quelle que soit la règle.
 */

const familles = { parCode: new Map() };

describe("schemaPrestation — les types d'intervention", () => {
  it("VIDE par défaut quand rien n'est saisi", () => {
    const analyse = schemaPrestation.safeParse({
      code: "ENT-1",
      libelle: "Entretien",
    });
    expect(analyse.success).toBe(true);
    expect(analyse.success && analyse.data.types).toEqual([]);
  });

  it("accepte une liste de types connus", () => {
    const analyse = schemaPrestation.safeParse({
      code: "ENT-1",
      libelle: "Entretien",
      types: ["curatif", "garantie"],
    });
    expect(analyse.success).toBe(true);
  });

  it("refuse un type qui ne figure pas au chapitre 11.2", () => {
    const analyse = schemaPrestation.safeParse({
      code: "ENT-1",
      libelle: "Entretien",
      types: ["invente"],
    });
    expect(analyse.success).toBe(false);
  });

  it("refuse un type coché deux fois — la base le garantit déjà, la saisie ne le laisse pas passer", () => {
    const analyse = schemaPrestation.safeParse({
      code: "ENT-1",
      libelle: "Entretien",
      types: ["curatif", "curatif"],
    });
    expect(analyse.success).toBe(false);
  });
});

describe("prestationsProposees — VIDE = tous, une réalisation ne disparaît jamais", () => {
  const SANS_TYPE = { id: "p1", types: [] as const };
  const CURATIF_SEUL = { id: "p2", types: ["curatif"] as const };
  const PREVENTIFS = {
    id: "p3",
    types: ["preventif_contrat", "preventif_hors_contrat"] as const,
  };
  const catalogue = [SANS_TYPE, CURATIF_SEUL, PREVENTIFS];

  it("une prestation sans type est toujours proposée", () => {
    const proposees = prestationsProposees(catalogue, "curatif", new Set());
    expect(proposees.map((p) => p.id)).toContain("p1");
  });

  it("sur un préventif, la prestation « curatif seulement » n'est PAS proposée", () => {
    const proposees = prestationsProposees(
      catalogue,
      "preventif_contrat",
      new Set(),
    );
    expect(proposees.map((p) => p.id)).toEqual(["p1", "p3"]);
  });

  it("sur un curatif, elle EST proposée", () => {
    const proposees = prestationsProposees(catalogue, "curatif", new Set());
    expect(proposees.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("déjà déclarée réalisée, elle reste affichée même hors de son type", () => {
    const proposees = prestationsProposees(
      catalogue,
      "preventif_contrat",
      new Set(["p2"]),
    );
    expect(proposees.map((p) => p.id).sort()).toEqual(["p1", "p2", "p3"]);
  });
});

describe("typesDepuisLaCellule — libellés du dictionnaire, séparés par « ; »", () => {
  it("une cellule vide ou absente vaut TOUS les types", () => {
    expect(typesDepuisLaCellule(undefined)).toEqual([]);
    expect(typesDepuisLaCellule("")).toEqual([]);
    expect(typesDepuisLaCellule("   ")).toEqual([]);
  });

  it("un seul libellé connu se résout", () => {
    expect(typesDepuisLaCellule("Curatif")).toEqual(["curatif"]);
  });

  it("plusieurs libellés, séparés par « ; », sans doublon à l'arrivée", () => {
    expect(
      typesDepuisLaCellule("Curatif ; Préventif sous contrat ; Curatif"),
    ).toEqual(["curatif", "preventif_contrat"]);
  });

  it("un libellé inconnu refuse la cellule ENTIÈRE — jamais résolu par approximation", () => {
    expect(typesDepuisLaCellule("Curatif ; Un jour férié")).toBeNull();
  });
});

describe("preparerUnePrestation — la colonne « Types d'intervention »", () => {
  it("une cellule vide prépare une saisie « tous les types »", () => {
    const prepare = preparerUnePrestation(familles, {
      Code: "ENT-1",
      Libellé: "Entretien",
    });
    expect(prepare.prete).toBe(true);
    expect(prepare.prete && prepare.saisie.types).toEqual([]);
  });

  it("un libellé inconnu est REFUSÉ, avec son motif propre (I6)", () => {
    const prepare = preparerUnePrestation(familles, {
      Code: "ENT-1",
      Libellé: "Entretien",
      "Types d'intervention": "Un jour férié",
    });
    expect(prepare.prete).toBe(false);
    expect(!prepare.prete && prepare.motif).toBe(
      MOTIF_TYPE_INTERVENTION_INCONNU,
    );
  });

  it("des libellés connus préparent la bonne liste de codes", () => {
    const prepare = preparerUnePrestation(familles, {
      Code: "ENT-1",
      Libellé: "Entretien",
      "Types d'intervention": "Curatif ; Garantie",
    });
    expect(prepare.prete).toBe(true);
    expect(prepare.prete && prepare.saisie.types).toEqual([
      "curatif",
      "garantie",
    ]);
  });
});

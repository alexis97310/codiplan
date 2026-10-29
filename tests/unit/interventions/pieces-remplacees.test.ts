import { describe, expect, it } from "vitest";

import {
  schemaPieceRemplacee,
  schemaPiecesRemplacees,
  schemaRapportTexte,
} from "@/lib/interventions/depot-rapport-terrain";
import {
  aSectionPiecesRemplacees,
  TYPES_INTERVENTION,
} from "@/lib/interventions/saisie";

/**
 * `schemaPieceRemplacee` (ticket 9I7B, décision d'Alexis du 29/10/2026,
 * verbatim « choix libre ») — DÉSIGNATION OBLIGATOIRE (≤ 200 caractères),
 * RÉFÉRENCE FACULTATIVE (≤ 80), QUANTITÉ ENTIÈRE ≥ 1. Aucun champ de prix :
 * un relevé déclaratif, distinct de l'arbitrage 3.7.
 *
 * Couvre le schéma seul, hors de toute écriture en base — `enregistrerRapport
 * Texte` est couvert par `tests/isolation/rapport-terrain.test.ts`.
 */

describe("schemaPieceRemplacee — désignation", () => {
  it("refuse une désignation vide", () => {
    const analyse = schemaPieceRemplacee.safeParse({
      designation: "",
      reference: null,
      quantite: 1,
    });
    expect(analyse.success).toBe(false);
  });

  it("refuse une désignation de 201 caractères", () => {
    const analyse = schemaPieceRemplacee.safeParse({
      designation: "a".repeat(201),
      reference: null,
      quantite: 1,
    });
    expect(analyse.success).toBe(false);
  });

  it("accepte une désignation de 200 caractères", () => {
    const analyse = schemaPieceRemplacee.safeParse({
      designation: "a".repeat(200),
      reference: null,
      quantite: 1,
    });
    expect(analyse.success).toBe(true);
  });

  it("recadre les espaces superflus", () => {
    const analyse = schemaPieceRemplacee.safeParse({
      designation: "  Vis M6  ",
      reference: null,
      quantite: 1,
    });
    expect(analyse.success).toBe(true);
    expect(analyse.success && analyse.data.designation).toBe("Vis M6");
  });
});

describe("schemaPieceRemplacee — référence, facultative", () => {
  it("accepte `null`", () => {
    const analyse = schemaPieceRemplacee.safeParse({
      designation: "Vis M6",
      reference: null,
      quantite: 1,
    });
    expect(analyse.success).toBe(true);
  });

  it("refuse une référence de 81 caractères", () => {
    const analyse = schemaPieceRemplacee.safeParse({
      designation: "Vis M6",
      reference: "a".repeat(81),
      quantite: 1,
    });
    expect(analyse.success).toBe(false);
  });

  it("accepte une référence de 80 caractères", () => {
    const analyse = schemaPieceRemplacee.safeParse({
      designation: "Vis M6",
      reference: "a".repeat(80),
      quantite: 1,
    });
    expect(analyse.success).toBe(true);
  });
});

describe("schemaPieceRemplacee — quantité, entière ≥ 1", () => {
  it("refuse zéro", () => {
    const analyse = schemaPieceRemplacee.safeParse({
      designation: "Vis M6",
      reference: null,
      quantite: 0,
    });
    expect(analyse.success).toBe(false);
  });

  it("refuse une quantité négative", () => {
    const analyse = schemaPieceRemplacee.safeParse({
      designation: "Vis M6",
      reference: null,
      quantite: -1,
    });
    expect(analyse.success).toBe(false);
  });

  it("refuse une quantité non entière", () => {
    const analyse = schemaPieceRemplacee.safeParse({
      designation: "Vis M6",
      reference: null,
      quantite: 1.5,
    });
    expect(analyse.success).toBe(false);
  });

  it("accepte une quantité entière ≥ 1", () => {
    const analyse = schemaPieceRemplacee.safeParse({
      designation: "Vis M6",
      reference: null,
      quantite: 2,
    });
    expect(analyse.success).toBe(true);
  });

  // AUCUN PRIX — le schéma n'a pas de champ à rejeter puisqu'il n'en déclare
  // aucun ; `.strict()` n'est PAS posé ici (à la différence de
  // `schemaSignature`) : une clé en trop (ex. `prix_unitaire` envoyé par un
  // client ancien ou malveillant) est silencieusement écartée par Zod, jamais
  // écrite, puisque `enregistrerRapportTexte` ne lit que les trois champs
  // déclarés sur chaque élément validé.
  it("un champ de prix envoyé en plus n'est jamais lu", () => {
    const analyse = schemaPieceRemplacee.safeParse({
      designation: "Vis M6",
      reference: null,
      quantite: 1,
      prix_unitaire: 999,
    });
    expect(analyse.success).toBe(true);
    expect(analyse.success && "prix_unitaire" in analyse.data).toBe(false);
  });
});

describe("schemaPiecesRemplacees — l'ensemble", () => {
  it("accepte un tableau vide", () => {
    expect(schemaPiecesRemplacees.safeParse([]).success).toBe(true);
  });

  it("refuse 51 lignes", () => {
    const lignes = Array.from({ length: 51 }, (_v, i) => ({
      designation: `Pièce ${i}`,
      reference: null,
      quantite: 1,
    }));
    expect(schemaPiecesRemplacees.safeParse(lignes).success).toBe(false);
  });

  it("accepte 50 lignes", () => {
    const lignes = Array.from({ length: 50 }, (_v, i) => ({
      designation: `Pièce ${i}`,
      reference: null,
      quantite: 1,
    }));
    expect(schemaPiecesRemplacees.safeParse(lignes).success).toBe(true);
  });
});

describe("schemaRapportTexte — pieces_remplacees facultatif", () => {
  it("absent : le reste du schéma reste valide (appelants antérieurs à 9I7B)", () => {
    const analyse = schemaRapportTexte.safeParse({
      commentaire_technicien: null,
      suite_a_donner: null,
    });
    expect(analyse.success).toBe(true);
    expect(analyse.success && analyse.data.pieces_remplacees).toBeUndefined();
  });

  it("un tableau, même vide, est accepté — c'est lui qui déclenche le remplacement intégral", () => {
    const analyse = schemaRapportTexte.safeParse({
      commentaire_technicien: null,
      suite_a_donner: null,
      pieces_remplacees: [],
    });
    expect(analyse.success).toBe(true);
    expect(analyse.success && analyse.data.pieces_remplacees).toEqual([]);
  });
});

describe("aSectionPiecesRemplacees — curatif, garantie, reprise seulement", () => {
  const ATTENDU: Record<string, boolean> = {
    preventif_contrat: false,
    preventif_hors_contrat: false,
    curatif: true,
    installation: false,
    garantie: true,
    controle_reglementaire: false,
    expertise: false,
    reprise: true,
    recensement: false,
  };

  it.each(TYPES_INTERVENTION)("%s", (type) => {
    expect(aSectionPiecesRemplacees(type)).toBe(ATTENDU[type]);
  });
});

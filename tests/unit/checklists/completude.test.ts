import { describe, expect, it } from "vitest";

import { etatDeCompletude } from "@/lib/checklists/completude";

/**
 * LA COMPLÉTUDE (9K18-CHECKLIST-DOMAINE) — FONCTION PURE dont CK7 (le
 * blocage de « Terminer », hors territoire ici) se servira. Un NON CONFORME
 * ne bloque JAMAIS « Terminer » (décision d'Alexis du 29/10/2026 ; D235) :
 * ce module le COMPTE, il ne le juge pas.
 */

describe("etatDeCompletude", () => {
  it("compte les points répondus, les non conformes, et la liste NOMMÉE des obligatoires manquants", () => {
    const points = [
      { id: "p1", libelle: "Freins", obligatoire: true },
      { id: "p2", libelle: "Éclairage", obligatoire: true },
      { id: "p3", libelle: "Carrosserie", obligatoire: false },
    ];
    const reponses = [
      { checklistPointId: "p1", nonConforme: true },
      { checklistPointId: "p3", nonConforme: false },
    ];

    const etat = etatDeCompletude(points, reponses);

    expect(etat.totalPoints).toBe(3);
    expect(etat.pointsRepondus).toBe(2);
    expect(etat.nonConformes).toBe(1);
    expect(etat.obligatoiresManquants).toEqual([
      { id: "p2", libelle: "Éclairage" },
    ]);
  });

  it("aucun point : complétude vide, aucun obligatoire manquant", () => {
    const etat = etatDeCompletude([], []);
    expect(etat).toEqual({
      totalPoints: 0,
      pointsRepondus: 0,
      nonConformes: 0,
      obligatoiresManquants: [],
    });
  });

  it("tous les obligatoires répondus : la liste des manquants est vide", () => {
    const points = [{ id: "p1", libelle: "Freins", obligatoire: true }];
    const reponses = [{ checklistPointId: "p1", nonConforme: false }];
    expect(etatDeCompletude(points, reponses).obligatoiresManquants).toEqual(
      [],
    );
  });

  it("une réponse sur un point FACULTATIF non conforme compte dans nonConformes, jamais dans les manquants", () => {
    const points = [{ id: "p1", libelle: "Carrosserie", obligatoire: false }];
    const reponses = [{ checklistPointId: "p1", nonConforme: true }];
    const etat = etatDeCompletude(points, reponses);
    expect(etat.nonConformes).toBe(1);
    expect(etat.obligatoiresManquants).toEqual([]);
  });
});

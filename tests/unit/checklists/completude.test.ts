import { describe, expect, it } from "vitest";

import { etatDeCompletude } from "@/lib/checklists/completude";

/**
 * LA COMPLÉTUDE (9K18-CHECKLIST-DOMAINE) — FONCTION PURE dont CK7
 * (9K23-CHECKLIST-BLOCAGE-TERMINER) se sert pour bloquer « Terminer » sur
 * `obligatoiresManquants`. Un NON CONFORME ne bloque PAS « Terminer » par le
 * seul fait d'être non conforme (décision d'Alexis du 29/10/2026 ; D235,
 * D240) : ce module le COMPTE, il ne le juge pas sur ce seul critère.
 *
 * **D264 (16/11/2026, 9L08E) : un non conforme SANS SUITE entre dans
 * `suitesNonConformesManquantes`**, jamais dans `obligatoiresManquants` —
 * les deux listes restent closes et distinctes.
 */

describe("etatDeCompletude", () => {
  it("compte les points répondus, les non conformes, et la liste NOMMÉE des obligatoires manquants", () => {
    const points = [
      { id: "p1", section: "Sécurité", libelle: "Freins", obligatoire: true },
      {
        id: "p2",
        section: "Sécurité",
        libelle: "Éclairage",
        obligatoire: true,
      },
      {
        id: "p3",
        section: "Esthétique",
        libelle: "Carrosserie",
        obligatoire: false,
      },
    ];
    const reponses = [
      { checklistPointId: "p1", nonConforme: true, suiteDonnee: true },
      { checklistPointId: "p3", nonConforme: false, suiteDonnee: true },
    ];

    const etat = etatDeCompletude(points, reponses);

    expect(etat.totalPoints).toBe(3);
    expect(etat.pointsRepondus).toBe(2);
    expect(etat.nonConformes).toBe(1);
    expect(etat.obligatoiresManquants).toEqual([
      { id: "p2", section: "Sécurité", libelle: "Éclairage" },
    ]);
  });

  it("aucun point : complétude vide, aucun obligatoire manquant, aucune suite manquante", () => {
    const etat = etatDeCompletude([], []);
    expect(etat).toEqual({
      totalPoints: 0,
      pointsRepondus: 0,
      nonConformes: 0,
      obligatoiresManquants: [],
      suitesNonConformesManquantes: [],
    });
  });

  it("tous les obligatoires répondus : la liste des manquants est vide", () => {
    const points = [
      { id: "p1", section: "Sécurité", libelle: "Freins", obligatoire: true },
    ];
    const reponses = [
      { checklistPointId: "p1", nonConforme: false, suiteDonnee: true },
    ];
    expect(etatDeCompletude(points, reponses).obligatoiresManquants).toEqual(
      [],
    );
  });

  it("une réponse sur un point FACULTATIF non conforme AVEC suite compte dans nonConformes, jamais dans les manquants ni dans les suites manquantes", () => {
    const points = [
      {
        id: "p1",
        section: "Esthétique",
        libelle: "Carrosserie",
        obligatoire: false,
      },
    ];
    const reponses = [
      { checklistPointId: "p1", nonConforme: true, suiteDonnee: true },
    ];
    const etat = etatDeCompletude(points, reponses);
    expect(etat.nonConformes).toBe(1);
    expect(etat.obligatoiresManquants).toEqual([]);
    expect(etat.suitesNonConformesManquantes).toEqual([]);
  });

  it("D264 — un point non conforme SANS suite entre dans suitesNonConformesManquantes, même non obligatoire, jamais dans obligatoiresManquants", () => {
    const points = [
      {
        id: "p1",
        section: "Esthétique",
        libelle: "Carrosserie",
        obligatoire: false,
      },
    ];
    const reponses = [
      { checklistPointId: "p1", nonConforme: true, suiteDonnee: false },
    ];
    const etat = etatDeCompletude(points, reponses);
    expect(etat.obligatoiresManquants).toEqual([]);
    expect(etat.suitesNonConformesManquantes).toEqual([
      { id: "p1", section: "Esthétique", libelle: "Carrosserie" },
    ]);
  });

  it("D264 — un point conforme sans suite n'entre jamais dans suitesNonConformesManquantes (la suite ne concerne que le non conforme)", () => {
    const points = [
      { id: "p1", section: "Sécurité", libelle: "Freins", obligatoire: true },
    ];
    const reponses = [
      { checklistPointId: "p1", nonConforme: false, suiteDonnee: false },
    ];
    expect(
      etatDeCompletude(points, reponses).suitesNonConformesManquantes,
    ).toEqual([]);
  });
});

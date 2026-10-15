import { describe, expect, it } from "vitest";

import { cibleAccesConnue } from "@/app/(back-office)/parametres/equipe/presentation";

/**
 * SOLDE 182 (relecture de 9ET-COMPTES-BUREAU-2) — le bandeau « Lien envoyé
 * à »/« Le lien n'est pas parti » doit reconnaître la cible d'un envoi, que
 * le geste vienne de la fiche d'un TECHNICIEN (`?technicien=<id>`) ou de
 * l'onglet « Comptes de bureau » (`?compte=<id>`) : deux routes distinctes
 * nomment leur cible par un paramètre différent, voir
 * `app/(back-office)/parametres/equipe/presentation.ts`.
 */

const TECHNICIENS = [{ utilisateurId: "tech-1" }, { utilisateurId: "tech-2" }];
const COMPTES_BUREAU = [{ utilisateurId: "bureau-1" }];

describe("cibleAccesConnue", () => {
  it("reconnaît un technicien de la société par son identifiant", () => {
    expect(
      cibleAccesConnue("tech-1", undefined, TECHNICIENS, COMPTES_BUREAU),
    ).toBe(true);
  });

  it("reconnaît un compte de bureau de la société par son identifiant", () => {
    expect(
      cibleAccesConnue(undefined, "bureau-1", TECHNICIENS, COMPTES_BUREAU),
    ).toBe(true);
  });

  it("refuse un identifiant qui n'appartient à aucune des deux listes", () => {
    expect(
      cibleAccesConnue("inconnu", undefined, TECHNICIENS, COMPTES_BUREAU),
    ).toBe(false);
    expect(
      cibleAccesConnue(undefined, "inconnu", TECHNICIENS, COMPTES_BUREAU),
    ).toBe(false);
  });

  it("refuse quand aucun des deux identifiants n'est fourni", () => {
    expect(
      cibleAccesConnue(undefined, undefined, TECHNICIENS, COMPTES_BUREAU),
    ).toBe(false);
  });
});

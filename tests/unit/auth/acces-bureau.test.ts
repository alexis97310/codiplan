import { describe, expect, it } from "vitest";

import {
  estRoleDeBureau,
  ROLES_DE_BUREAU,
  schemaCreationCompteDeBureau,
} from "@/lib/auth/acces-bureau";
import { Role } from "@/lib/auth/roles";

/**
 * `estRoleDeBureau` / `ROLES_DE_BUREAU` (D196, 9ET-COMPTES-BUREAU-1) — la
 * liste close des cinq rôles qu'un administrateur de société peut donner
 * depuis Équipe, et la seule part de `lib/auth/acces-bureau.ts` qui se mesure
 * SANS base.
 */
describe("ROLES_DE_BUREAU", () => {
  it("porte exactement les cinq rôles de la décision 78 d'Alexis", () => {
    expect([...ROLES_DE_BUREAU].sort()).toEqual(
      [
        Role.adv,
        Role.responsable_materiel,
        Role.responsable_sav,
        Role.direction,
        Role.admin_societe,
      ].sort(),
    );
  });

  it("accepte les cinq rôles de bureau", () => {
    for (const role of ROLES_DE_BUREAU) {
      expect(estRoleDeBureau(role)).toBe(true);
    }
  });

  it("refuse le technicien, le client et l'administrateur de plateforme", () => {
    expect(estRoleDeBureau(Role.technicien)).toBe(false);
    expect(estRoleDeBureau(Role.client)).toBe(false);
    expect(estRoleDeBureau(Role.admin_plateforme)).toBe(false);
  });

  it("refuse les deux autres rôles éditeur, absents des cinq (D37)", () => {
    expect(estRoleDeBureau(Role.editeur_commercial)).toBe(false);
    expect(estRoleDeBureau(Role.editeur_support)).toBe(false);
  });
});

describe("schemaCreationCompteDeBureau", () => {
  it("accepte une saisie complète, y compris un rôle hors liste (forme large, voir l'en-tête)", () => {
    const analyse = schemaCreationCompteDeBureau.safeParse({
      nom: "Compte d'épreuve",
      courriel: "compte.epreuve@codima.test",
      role: Role.technicien,
    });
    expect(analyse.success).toBe(true);
  });

  it("refuse un nom vide", () => {
    const analyse = schemaCreationCompteDeBureau.safeParse({
      nom: "   ",
      courriel: "compte.epreuve@codima.test",
      role: Role.adv,
    });
    expect(analyse.success).toBe(false);
  });

  it("refuse un courriel malformé", () => {
    const analyse = schemaCreationCompteDeBureau.safeParse({
      nom: "Compte d'épreuve",
      courriel: "pas-un-courriel",
      role: Role.adv,
    });
    expect(analyse.success).toBe(false);
  });

  it("refuse un rôle qui n'est pas dans l'énumération", () => {
    const analyse = schemaCreationCompteDeBureau.safeParse({
      nom: "Compte d'épreuve",
      courriel: "compte.epreuve@codima.test",
      role: "pas-un-role",
    });
    expect(analyse.success).toBe(false);
  });
});

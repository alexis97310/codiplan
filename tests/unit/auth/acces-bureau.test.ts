import { describe, expect, it, vi } from "vitest";

import {
  estRoleDeBureau,
  parTranchesDeCinq,
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

/**
 * `parTranchesDeCinq` (9IC-CORRECTIFS-COURTS, point 2) — partagée par
 * `etatsAccesDesComptes` et `etatsAccesDesTechniciens`
 * (`lib/auth/acces-technicien.ts`) pour plafonner les lectures `compte` de
 * l'écran Équipe. Mesurée ICI, sur la fonction nue, plutôt que sur les deux
 * appelants en base : une mesure par comptage de transactions en vol contre
 * `clientApp()` (tentée dans `tests/isolation/9ic-equipe-par-tranches.test.ts`)
 * s'est révélée instable sous `pnpm test:isolation` complet — polluée par le
 * `Promise.all` SANS plafond, déjà existant et hors territoire, qui lit le
 * journal d'accès d'autant d'administrateurs que la société en accumule
 * (jusqu'à 35 mesurés dans SOCIETE_A sur la suite entière). La fonction
 * partagée, elle, ne dépend d'aucune fixture : la preuve est déterministe.
 */
describe("parTranchesDeCinq", () => {
  it("N=12 — jamais plus de 5 appels en vol à la fois", async () => {
    const DELAI_MS = 10;
    let enVol = 0;
    let maxVu = 0;
    const fn = vi.fn(async (item: number) => {
      enVol += 1;
      maxVu = Math.max(maxVu, enVol);
      await new Promise((resolve) => setTimeout(resolve, DELAI_MS));
      enVol -= 1;
      return item * 10;
    });

    const items = Array.from({ length: 12 }, (_, i) => i);
    const resultats = await parTranchesDeCinq(items, fn);

    expect(fn).toHaveBeenCalledTimes(12);
    expect(maxVu).toBeLessThanOrEqual(5);
    // La mesure doit être CAPABLE de voir un dépassement : au moins deux
    // appels se sont chevauchés (sinon le délai artificiel n'a servi à
    // rien, et « ≤ 5 » serait vrai par accident, même sans tranches).
    expect(maxVu).toBeGreaterThan(1);
    // Ordre conservé, aucune confusion entre tranches.
    expect(resultats).toEqual(items.map((i) => i * 10));
  });

  it("tableau vide — rend un tableau vide sans appeler `fn`", async () => {
    const fn = vi.fn();
    const resultats = await parTranchesDeCinq([], fn);
    expect(resultats).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });
});

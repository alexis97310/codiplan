import { describe, expect, it } from "vitest";

import {
  estRole,
  estRoleEditeur,
  estRoleInterne,
  estRolePortail,
  exigeSecondFacteur,
  Role,
  ROLES,
  ROLES_EDITEUR,
  ROLES_INTERNES,
  ROLES_SECOND_FACTEUR_OBLIGATOIRE,
  schemaRole,
} from "@/lib/auth/roles";

/**
 * Énumération canonique des rôles (ticket L0-06 ; arbitrage gravité 4).
 *
 * La liste attendue est écrite ici EN TOUTES LETTRES, et c'est le seul endroit
 * du dépôt où elle l'est. C'est voulu : un test qui dériverait sa liste de la
 * même source que le code ne vérifierait rien. Ici, la liste de l'arbitrage est
 * confrontée à ce que le schéma Prisma produit ; si l'une des deux bouge sans
 * l'autre, ce test tombe.
 */
const LISTE_ARBITRAGE = [
  "admin_plateforme",
  "editeur_commercial",
  "editeur_support",
  "direction",
  "responsable_materiel",
  "responsable_sav",
  "adv",
  "technicien",
  "client",
];

describe("énumération canonique des rôles", () => {
  it("compte exactement les neuf rôles de l'arbitrage, dans l'ordre", () => {
    expect([...ROLES]).toEqual(LISTE_ARBITRAGE);
  });

  it("l'objet réexporté depuis Prisma porte les mêmes valeurs", () => {
    expect(Object.values(Role)).toEqual(LISTE_ARBITRAGE);
  });

  it("la liste est figée — on ne l'étend pas au fil de l'eau", () => {
    expect(Object.isFrozen(ROLES)).toBe(true);
  });

  it("le schéma Zod accepte un rôle canonique et refuse tout le reste", () => {
    expect(schemaRole.safeParse(Role.adv).success).toBe(true);
    expect(schemaRole.safeParse("admin").success).toBe(false);
    expect(schemaRole.safeParse("ADV").success).toBe(false);
    expect(schemaRole.safeParse("").success).toBe(false);
    expect(schemaRole.safeParse(null).success).toBe(false);
  });

  it("`estRole` affine correctement", () => {
    expect(estRole("technicien")).toBe(true);
    expect(estRole("technicienne")).toBe(false);
  });
});

describe("familles de rôles", () => {
  it("les trois familles partitionnent l'énumération, sans reste ni doublon", () => {
    const reunies = [...ROLES_EDITEUR, ...ROLES_INTERNES, Role.client];

    expect(new Set(reunies).size).toBe(reunies.length);
    expect([...reunies].sort()).toEqual([...ROLES].sort());
  });

  it("chaque rôle appartient à une famille et à une seule", () => {
    for (const role of ROLES) {
      const familles = [
        estRoleEditeur(role),
        estRoleInterne(role),
        estRolePortail(role),
      ].filter(Boolean);
      expect(familles).toHaveLength(1);
    }
  });

  it("les rôles éditeur sont ceux du §22.5", () => {
    expect([...ROLES_EDITEUR]).toEqual([
      Role.admin_plateforme,
      Role.editeur_commercial,
      Role.editeur_support,
    ]);
  });
});

describe("second facteur obligatoire", () => {
  it("l'exige sur `admin_plateforme` et `direction`, et sur eux seuls", () => {
    expect([...ROLES_SECOND_FACTEUR_OBLIGATOIRE]).toEqual([
      Role.admin_plateforme,
      Role.direction,
    ]);

    const exigeants = ROLES.filter(exigeSecondFacteur);
    expect(exigeants).toEqual([Role.admin_plateforme, Role.direction]);
  });

  it("ne l'exige pas des rôles opérationnels ni du portail", () => {
    for (const role of [
      Role.editeur_commercial,
      Role.editeur_support,
      Role.responsable_materiel,
      Role.responsable_sav,
      Role.adv,
      Role.technicien,
      Role.client,
    ]) {
      expect(exigeSecondFacteur(role)).toBe(false);
    }
  });
});

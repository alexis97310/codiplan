import { afterAll, describe, expect, it } from "vitest";

import { estRoleEditeur, Role, ROLES } from "@/lib/auth/roles";

import {
  avecPortail,
  avecSocieteEtRole,
  clientOwner,
  fermerClients,
} from "./setup/db";
import {
  AGENCE_A,
  AGENCE_B,
  CLIENT_A1,
  CLIENT_A2,
  MACHINE_A1,
  MACHINE_A2,
  MACHINE_B1,
  MODELE_PLATEFORME,
  MODELE_SURCHARGE_A,
  MODELE_SURCHARGE_B,
  SOCIETE_A,
} from "./setup/fixtures";

/**
 * Un scénario par rôle, côté BASE (ticket L0-06, point 5).
 *
 * Chaque rôle est éprouvé sur ce qu'il voit ET sur ce qu'il ne voit pas. Le
 * positif n'est pas décoratif : un rôle qui ne lirait rien satisferait tous les
 * scénarios négatifs sans prouver que le cloisonnement fonctionne — il
 * prouverait seulement que la connexion est cassée.
 *
 * Deux axes se croisent ici, et c'est le fond du ticket :
 *   - la SOCIÉTÉ active décide de quelles lignes cloisonnées sont lisibles ;
 *   - le RÔLE décide de ce qui est modifiable dans les référentiels de
 *     plateforme (I1 — « modifiables par les seuls rôles éditeur »).
 *
 * Les trois rôles éditeur n'ont aucune habilitation, donc aucune société
 * active : c'est le principe du §22.5, et il rend leur négatif réel.
 */

/** Lit les identifiants d'agences visibles dans le contexte courant. */
async function agencesVisibles(
  societeId: string | null,
  role: Role,
): Promise<string[]> {
  const agences = await avecSocieteEtRole(societeId, role, (tx) =>
    tx.agence.findMany({ select: { id: true } }),
  );
  return agences.map((agence) => agence.id);
}

/** Lit les identifiants de modèles visibles dans le contexte courant. */
async function modelesVisibles(
  societeId: string | null,
  role: Role,
): Promise<string[]> {
  const modeles = await avecSocieteEtRole(societeId, role, (tx) =>
    tx.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "modele_materiel"`,
    ),
  );
  return modeles.map((modele) => modele.id);
}

/** Tente d'écrire un référentiel de plateforme (`societe_id NULL`). */
function ecrirePlateforme(
  societeId: string | null,
  role: Role,
  id: string,
): Promise<unknown> {
  return avecSocieteEtRole(societeId, role, (tx) =>
    tx.$executeRawUnsafe(
      `INSERT INTO "modele_materiel" ("id", "societe_id", "libelle")
       VALUES ($1::uuid, NULL, 'Écriture de plateforme')`,
      id,
    ),
  );
}

/** Identifiants jetables, dérivés du rang du rôle : lisibles à l'échec. */
function idEcriture(rang: number): string {
  return `00000000-0000-7000-8000-0000000008${String(rang).padStart(2, "0")}`;
}

describe("énumération des rôles — base et TypeScript", () => {
  afterAll(fermerClients);

  it("le type PostgreSQL porte exactement les neuf rôles, dans le même ordre", async () => {
    const valeurs = await clientOwner().$queryRawUnsafe<
      Array<{ valeur: string }>
    >(`
      SELECT e."enumlabel"::text AS "valeur"
      FROM pg_catalog.pg_enum e
      JOIN pg_catalog.pg_type t ON t."oid" = e."enumtypid"
      WHERE t."typname" = 'Role'
      ORDER BY e."enumsortorder"
    `);

    expect(valeurs.map((ligne) => ligne.valeur)).toEqual([...ROLES]);
  });

  it("`app_est_role_editeur()` répond comme `estRoleEditeur` sur les neuf rôles", async () => {
    // La règle « seuls les rôles éditeur modifient les référentiels de
    // plateforme » est écrite deux fois — une fois en SQL, une fois en
    // TypeScript. Ce scénario est ce qui interdit qu'elles divergent.
    for (const role of ROLES) {
      const [ligne] = await avecSocieteEtRole(null, role, (tx) =>
        tx.$queryRawUnsafe<Array<{ editeur: boolean }>>(
          `SELECT "app_est_role_editeur"() AS "editeur"`,
        ),
      );
      expect(ligne?.editeur, `désaccord sur ${role}`).toBe(
        estRoleEditeur(role),
      );
    }
  });

  it("hors contexte, `app_role()` est nul et aucun rôle n'est éditeur", async () => {
    const [ligne] = await avecSocieteEtRole(null, null, (tx) =>
      tx.$queryRawUnsafe<Array<{ role: string | null; editeur: boolean }>>(
        `SELECT "app_role"()::text AS "role", "app_est_role_editeur"() AS "editeur"`,
      ),
    );
    expect(ligne?.role).toBeNull();
    expect(ligne?.editeur).toBe(false);
  });
});

describe("rôles éditeur — au-dessus des sociétés, dedans jamais (§22.5)", () => {
  afterAll(fermerClients);

  const editeurs = ROLES.filter(estRoleEditeur);

  it("les trois rôles éditeur sont bien ceux attendus", () => {
    expect(editeurs).toEqual([
      Role.admin_plateforme,
      Role.editeur_commercial,
      Role.editeur_support,
    ]);
  });

  editeurs.forEach((role, rang) => {
    describe(role, () => {
      it("VOIT les référentiels de plateforme", async () => {
        const visibles = await modelesVisibles(null, role);
        expect(visibles).toContain(MODELE_PLATEFORME);
      });

      it("PEUT écrire un référentiel de plateforme (I1)", async () => {
        const id = idEcriture(rang);
        await expect(ecrirePlateforme(null, role, id)).resolves.toBe(1);

        const visibles = await modelesVisibles(null, role);
        expect(visibles).toContain(id);
      });

      it("NE VOIT aucune donnée cloisonnée — aucune société active", async () => {
        expect(await agencesVisibles(null, role)).toEqual([]);
        // Ni la surcharge d'une société, qui est cloisonnée comme le reste.
        const visibles = await modelesVisibles(null, role);
        expect(visibles).not.toContain(MODELE_SURCHARGE_A);
        expect(visibles).not.toContain(MODELE_SURCHARGE_B);
      });
    });
  });
});

describe("rôles internes — une société active, la leur", () => {
  afterAll(fermerClients);

  const internes = [
    Role.direction,
    Role.responsable_materiel,
    Role.responsable_sav,
    Role.adv,
    Role.technicien,
  ];

  internes.forEach((role, rang) => {
    describe(role, () => {
      it("VOIT l'agence de sa société et les référentiels de plateforme", async () => {
        expect(await agencesVisibles(SOCIETE_A, role)).toEqual([AGENCE_A]);

        const visibles = await modelesVisibles(SOCIETE_A, role);
        expect(visibles).toContain(MODELE_PLATEFORME);
        expect(visibles).toContain(MODELE_SURCHARGE_A);
      });

      it("NE VOIT ni l'agence ni la surcharge de l'autre société", async () => {
        expect(await agencesVisibles(SOCIETE_A, role)).not.toContain(AGENCE_B);
        expect(await modelesVisibles(SOCIETE_A, role)).not.toContain(
          MODELE_SURCHARGE_B,
        );
      });

      it("NE PEUT PAS écrire un référentiel de plateforme (I1)", async () => {
        await expect(
          ecrirePlateforme(SOCIETE_A, role, idEcriture(50 + rang)),
        ).rejects.toThrow(/row-level security|violates/i);
      });
    });
  });
});

describe("rôle client — le portail, et rien d'autre (D10)", () => {
  afterAll(fermerClients);

  const contexte = { societeId: SOCIETE_A, clientId: CLIENT_A1 };

  it("VOIT son client et ses machines", async () => {
    const clients = await avecPortail(contexte, (tx) =>
      tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "client"`),
    );
    expect(clients.map((c) => c.id)).toEqual([CLIENT_A1]);

    const machines = await avecPortail(contexte, (tx) =>
      tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "machine"`),
    );
    expect(machines.map((m) => m.id).sort()).toEqual(
      [MACHINE_A1, MACHINE_A2].sort(),
    );
  });

  it("NE VOIT pas l'autre client de sa société, ni la machine de l'autre société", async () => {
    const clients = await avecPortail(contexte, (tx) =>
      tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "client"`),
    );
    expect(clients.map((c) => c.id)).not.toContain(CLIENT_A2);

    const machines = await avecPortail(contexte, (tx) =>
      tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "machine"`),
    );
    expect(machines.map((m) => m.id)).not.toContain(MACHINE_B1);
  });

  it("NE PEUT PAS écrire un référentiel de plateforme (I1)", async () => {
    await expect(
      ecrirePlateforme(SOCIETE_A, Role.client, idEcriture(90)),
    ).rejects.toThrow(/row-level security|violates/i);
  });
});

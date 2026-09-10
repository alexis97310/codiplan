import { afterAll, describe, expect, it } from "vitest";

import { estRoleEditeur, Role, ROLES } from "@/lib/auth/roles";

import {
  avecPortail,
  sousSocieteEtRole,
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
  MACHINE_A3,
  MACHINE_B1,
  MODELE_A,
  MODELE_B,
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
 *
 * Depuis D37, l'énumération compte dix rôles : `admin_societe` s'ajoute aux
 * rôles internes. C'est le point de l'arbitrage — administrer une société est
 * une affaire de société, pas d'éditeur — et le scénario négatif d'`admin_societe`
 * sur les référentiels de plateforme est ce qui le rend vérifiable.
 */

/** Lit les identifiants d'agences visibles dans le contexte courant. */
async function agencesVisibles(
  societeId: string | null,
  role: Role,
): Promise<string[]> {
  const agences = await sousSocieteEtRole(societeId, role, (tx) =>
    tx.agence.findMany({ select: { id: true } }),
  );
  return agences.map((agence) => agence.id);
}

/**
 * Lit les identifiants d'un RÉFÉRENTIEL DE PLATEFORME dans le contexte courant.
 *
 * **`jour_ferie` a remplacé `modele_materiel` au ticket L1-05**, et le
 * remplacement est le ticket : le modèle n'est plus un référentiel de
 * plateforme, l'amendement à D4 en a fait une table métier cloisonnée. Ce
 * fichier éprouve ce que peuvent les rôles ÉDITEUR sur la deuxième catégorie de
 * I1 ; il lui faut donc une table qui y soit encore.
 */
async function referentielsVisibles(
  societeId: string | null,
  role: Role,
): Promise<string[]> {
  const feries = await sousSocieteEtRole(societeId, role, (tx) =>
    tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "jour_ferie"`),
  );
  return feries.map((ferie) => ferie.id);
}

/**
 * Lit les identifiants de modèles visibles — table MÉTIER cloisonnée depuis
 * L1-05. Un rôle éditeur, qui n'a aucune société active, n'en voit AUCUN.
 */
async function modelesVisibles(
  societeId: string | null,
  role: Role,
): Promise<string[]> {
  const modeles = await sousSocieteEtRole(societeId, role, (tx) =>
    tx.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "modele_materiel"`,
    ),
  );
  return modeles.map((modele) => modele.id);
}

/**
 * Tente d'écrire un référentiel de plateforme.
 *
 * La DATE est dérivée du rang, et le TERRITOIRE est propre à ce fichier :
 * `jour_ferie` porte `UNIQUE (territoire, date)`, et la base jetable est
 * PARTAGÉE par tous les fichiers de la suite. Une date commune ferait échouer le
 * deuxième rôle — ou le fichier voisin — sur une collision d'unicité plutôt que
 * sur un refus de politique, et le scénario mesurerait le refus du voisin
 * (§9, 08/09). Mesuré : `journal-audit.test.ts` écrit déjà en `ZZ`.
 */
function ecrirePlateforme(
  societeId: string | null,
  role: Role,
  id: string,
  rang: number,
): Promise<unknown> {
  return sousSocieteEtRole(societeId, role, (tx) =>
    tx.$executeRawUnsafe(
      `INSERT INTO "jour_ferie" ("id", "territoire", "date", "libelle", "mobile")
       VALUES ($1::uuid, 'ZR', DATE '2098-01-01' + $2::int, 'Écriture de plateforme', false)`,
      id,
      rang,
    ),
  );
}

/** Identifiants jetables, dérivés du rang du rôle : lisibles à l'échec. */
function idEcriture(rang: number): string {
  return `00000000-0000-7000-8000-0000000008${String(rang).padStart(2, "0")}`;
}

describe("énumération des rôles — base et TypeScript", () => {
  afterAll(fermerClients);

  it("le type PostgreSQL porte exactement les dix rôles, dans le même ordre", async () => {
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

  it("`app_est_role_editeur()` répond comme `estRoleEditeur` sur les dix rôles", async () => {
    // La règle « seuls les rôles éditeur modifient les référentiels de
    // plateforme » est écrite deux fois — une fois en SQL, une fois en
    // TypeScript. Ce scénario est ce qui interdit qu'elles divergent.
    for (const role of ROLES) {
      const [ligne] = await sousSocieteEtRole(null, role, (tx) =>
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
    const [ligne] = await sousSocieteEtRole(null, null, (tx) =>
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
        const visibles = await referentielsVisibles(null, role);
        // TÉMOIN : la table est peuplée. Sans lui, « le rôle voit tout ce
        // qu'il y a » serait vrai d'une table vide.
        expect(visibles.length).toBeGreaterThan(0);
      });

      it("PEUT écrire un référentiel de plateforme (I1)", async () => {
        const id = idEcriture(rang);
        await expect(ecrirePlateforme(null, role, id, rang)).resolves.toBe(1);

        const visibles = await referentielsVisibles(null, role);
        expect(visibles).toContain(id);

        // ── ET LE SCÉNARIO REPREND CE QU'IL A ÉCRIT ───────────────────────
        //
        // La base jetable est PARTAGÉE par toute la suite, et `jour_ferie` est
        // énumérée exhaustivement ailleurs (`calendriers.test.ts` compare la
        // liste des territoires à un ensemble exact). Une ligne laissée ici
        // ferait rougir un scénario voisin sur une population qu'il ne
        // contrôle pas — mesuré, pas supposé.
        //
        // La reprise se fait sous le PROPRIÉTAIRE : le rôle applicatif n'a pas
        // à savoir défaire ce qu'un scénario a écrit.
        await clientOwner().$executeRawUnsafe(
          `DELETE FROM "jour_ferie" WHERE "id" = $1::uuid`,
          id,
        );
      });

      it("NE VOIT aucune donnée cloisonnée — aucune société active", async () => {
        expect(await agencesVisibles(null, role)).toEqual([]);
        // ET AUCUN MODÈLE, ce qui est NOUVEAU depuis L1-05 : `modele_materiel`
        // était un référentiel de plateforme, un rôle éditeur en voyait donc la
        // ligne partagée. L'amendement à D4 en fait une table métier, et un
        // rôle éditeur — qui n'a aucune société active — n'en voit plus rien.
        expect(await modelesVisibles(null, role)).toEqual([]);
      });
    });
  });
});

describe("rôles internes — une société active, la leur", () => {
  afterAll(fermerClients);

  const internes = [
    // D37 — `admin_societe` est un rôle INTERNE : il administre sa société,
    // il ne modifie pas les référentiels de plateforme (I1). Le scénario
    // négatif ci-dessous le prouve en base, pas seulement en TypeScript.
    Role.admin_societe,
    Role.direction,
    Role.responsable_materiel,
    Role.responsable_sav,
    Role.adv,
    Role.technicien,
  ];

  internes.forEach((role, rang) => {
    describe(role, () => {
      it("VOIT l'agence de sa société, ses modèles, et les référentiels", async () => {
        expect(await agencesVisibles(SOCIETE_A, role)).toEqual([AGENCE_A]);
        expect(
          (await referentielsVisibles(SOCIETE_A, role)).length,
        ).toBeGreaterThan(0);
        expect(await modelesVisibles(SOCIETE_A, role)).toContain(MODELE_A);
      });

      it("NE VOIT ni l'agence ni le modèle de l'autre société", async () => {
        expect(await agencesVisibles(SOCIETE_A, role)).not.toContain(AGENCE_B);
        expect(await modelesVisibles(SOCIETE_A, role)).not.toContain(MODELE_B);
      });

      it("NE PEUT PAS écrire un référentiel de plateforme (I1)", async () => {
        await expect(
          ecrirePlateforme(SOCIETE_A, role, idEcriture(50 + rang), 50 + rang),
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
      [MACHINE_A1, MACHINE_A2, MACHINE_A3].sort(),
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
      ecrirePlateforme(SOCIETE_A, Role.client, idEcriture(90), 90),
    ).rejects.toThrow(/row-level security|violates/i);
  });
});

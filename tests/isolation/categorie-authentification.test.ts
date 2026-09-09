import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EvenementAcces } from "@prisma/client";

import { creerAuth } from "@/lib/auth/config";
import { avecDesignationAuth } from "@/lib/auth/lecture-identite";
import { Role } from "@/lib/auth/roles";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  ROLE_APP,
  SOCIETE_A,
  UTILISATEUR_PAR_ROLE,
  PORTAIL_A_CLIENT,
} from "./setup/fixtures";

/**
 * LA TROISIÈME CATÉGORIE DE I1 A UN PLANCHER (ticket L1-02d).
 *
 * Cinq tables portaient, jusqu'au 07/09/2026, AUCUNE sécurité au niveau des
 * lignes et les quatre verbes pour le rôle applicatif. Mesuré ce jour-là, sous
 * un contexte de `technicien` : suppression de n'importe quelle ligne de
 * `second_facteur` toutes sociétés confondues, lecture d'une empreinte de mot
 * de passe et d'un jeton de session.
 *
 * L'exploitation a tranché pour la CATÉGORIE ENTIÈRE — « traiter une table et
 * laisser ses quatre voisines dans le même état, c'est réparer une liste au
 * lieu de la fermer ».
 */

const SUJET = UTILISATEUR_PAR_ROLE[Role.technicien];
const AUTRUI = UTILISATEUR_PAR_ROLE[Role.adv];
const ADMIN = UTILISATEUR_PAR_ROLE[Role.admin_societe];

const TABLES = [
  "session",
  "compte",
  "verification",
  "second_facteur",
  "journal_acces",
] as const;

const JETON_SUJET = "jeton-l1-02d-sujet";
const JETON_AUTRUI = "jeton-l1-02d-autrui";
const IDENT_SUJET = "verif-l1-02d-sujet";

/** Repose une population connue sous le PROPRIÉTAIRE, avant chaque mesure. */
async function poserPopulation(): Promise<void> {
  const owner = clientOwner();
  await owner.$executeRawUnsafe(
    `DELETE FROM "second_facteur" WHERE "utilisateur_id" IN ($1::uuid, $2::uuid)`,
    SUJET,
    AUTRUI,
  );
  await owner.$executeRawUnsafe(
    `DELETE FROM "session" WHERE "token" IN ($1, $2)`,
    JETON_SUJET,
    JETON_AUTRUI,
  );
  await owner.$executeRawUnsafe(
    `DELETE FROM "verification" WHERE "identifiant" = $1`,
    IDENT_SUJET,
  );
  await owner.$executeRawUnsafe(
    `INSERT INTO "second_facteur" ("id","utilisateur_id","secret","codes_secours")
     VALUES ($1::uuid, $2::uuid, 'SECRET-SUJET', 'CODES-SUJET'),
            ($3::uuid, $4::uuid, 'SECRET-AUTRUI', 'CODES-AUTRUI')`,
    uuidv7(),
    SUJET,
    uuidv7(),
    AUTRUI,
  );
  await owner.$executeRawUnsafe(
    `INSERT INTO "session" ("id","token","utilisateur_id","expire_le","cree_le","modifie_le")
     VALUES ($1::uuid, $2, $3::uuid, now() + interval '1 day', now(), now()),
            ($4::uuid, $5, $6::uuid, now() + interval '1 day', now(), now())`,
    uuidv7(),
    JETON_SUJET,
    SUJET,
    uuidv7(),
    JETON_AUTRUI,
    AUTRUI,
  );
  await owner.$executeRawUnsafe(
    `INSERT INTO "verification" ("id","identifiant","valeur","expire_le","cree_le","modifie_le")
     VALUES ($1::uuid, $2, 'valeur', now() + interval '1 day', now(), now())`,
    uuidv7(),
    IDENT_SUJET,
  );
}

beforeAll(poserPopulation);
afterAll(fermerClients);

describe("TÉMOIN PRÉALABLE — les politiques sont en vigueur, et elles mordent", () => {
  it("les CINQ tables portent les DEUX drapeaux", async () => {
    // `ENABLE` seul ne concerne pas le propriétaire : ce qui ne se prouve pas
    // par la lecture se prouve par l'attribut, et il se lit en deux drapeaux
    // (§9, 31/08).
    const etats = await clientOwner().$queryRawUnsafe<
      { table: string; activee: boolean; forcee: boolean }[]
    >(
      `SELECT relname AS "table", relrowsecurity AS "activee",
              relforcerowsecurity AS "forcee"
         FROM pg_class WHERE relname = ANY($1)`,
      [...TABLES],
    );

    expect(etats).toHaveLength(TABLES.length);
    for (const etat of etats) {
      expect(etat.activee, `${etat.table} : ENABLE`).toBe(true);
      expect(etat.forcee, `${etat.table} : FORCE`).toBe(true);
    }
  });

  it("chacune rend ZÉRO ligne sans aucun contexte", async () => {
    // Et la population, elle, existe — sans quoi zéro ressemblerait à un
    // sans-faute (§9, 30/08).
    for (const table of TABLES) {
      const [vu] = await clientApp().$queryRawUnsafe<{ n: bigint }[]>(
        `SELECT count(*) AS n FROM "${table}"`,
      );
      expect(Number(vu?.n), `${table} sans contexte`).toBe(0);
    }

    for (const table of ["second_facteur", "session", "verification"]) {
      const [total] = await clientOwner().$queryRawUnsafe<{ n: bigint }[]>(
        `SELECT count(*) AS n FROM "${table}"`,
      );
      expect(Number(total?.n), `population de ${table}`).toBeGreaterThan(0);
    }
  });
});

describe("LA RÉPARATION — obtenirSession n'était plus qu'un NULL", () => {
  it("une session fraîchement ouverte se relit par son jeton, avec son identité", async () => {
    // Le défaut mesuré le 07/09 : Better Auth lit la session avec
    // `join: { user: true }`, Prisma rend cela par DEUX instructions SQL pour
    // UNE opération de client, et l'enveloppe ne voyait donc jamais d'opération
    // `utilisateur`. `getSession` rendait NULL pour tout compte connecté.
    const auth = creerAuth(clientApp());
    const authAdmin = creerAuth(clientApp(), {
      societeId: SOCIETE_A,
      role: Role.admin_societe,
    });
    const email = `reparation-${Date.now()}@iso.test`;
    const motDePasse = "mot-de-passe-de-test-suffisamment-long";
    await authAdmin.api.signUpEmail({
      body: { email, password: motDePasse, name: "Réparation" },
    });

    const reponse = await auth.api.signInEmail({
      body: { email, password: motDePasse },
      asResponse: true,
    });
    const cookie = (reponse.headers.getSetCookie?.() ?? [])
      .map((c) => c.split(";")[0])
      .join("; ");

    const session = await auth.api.getSession({
      headers: new Headers({ cookie }),
    });

    expect(session).not.toBeNull();
    expect(session?.user.email).toBe(email);
  });
});

describe("CE QUE CHAQUE CONTEXTE VOIT — la mesure, table par table", () => {
  it("un compte INTERNE ne voit que ce qu'il désigne ou ce qui est à lui", async () => {
    await poserPopulation();
    const vu = await avecContexteRls(
      clientApp(),
      { societeId: SOCIETE_A, role: Role.technicien, auteurId: SUJET },
      async (tx) => ({
        // Sa propre ligne, par `app.utilisateur_id`.
        facteurs: await tx.$queryRawUnsafe<{ utilisateur_id: string }[]>(
          `SELECT "utilisateur_id" FROM "second_facteur"`,
        ),
        // Bornée aux jetons de ce scénario : d'autres suites ouvrent des
        // sessions sur les mêmes comptes, et un total dépendrait de leur ordre
        // d'exécution. Ce qui est mesuré reste entier — la session d'AUTRUI est
        // dans le même lot, et elle doit rester invisible.
        sessions: await tx.$queryRawUnsafe<{ token: string }[]>(
          `SELECT "token" FROM "session" WHERE "token" LIKE 'jeton-l1-02d-%'`,
        ),
        // `verification` ne s'ouvre QUE par son identifiant : un contexte de
        // société n'en montre rien, et c'est voulu.
        verifications: await tx.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT count(*) AS n FROM "verification"`,
        ),
      }),
    );

    expect(vu.facteurs.map((f) => f.utilisateur_id)).toEqual([SUJET]);
    expect(vu.sessions.map((s) => s.token)).toEqual([JETON_SUJET]);
    expect(Number(vu.verifications[0]?.n)).toBe(0);
  });

  it("un compte PORTAIL ne voit rien de plus, et surtout rien du personnel", async () => {
    await poserPopulation();
    const vu = await avecContexteRls(
      clientApp(),
      {
        societeId: SOCIETE_A,
        role: Role.client,
        // LE COMPTE PORTAIL, ET NON L'INTERNE (D70). Ce scénario portait
        // `UTILISATEUR_PORTAIL_A` — un nom qui désignait le compte INTERNE,
        // sans aucune ligne dans `utilisateur_client`. Le contexte armé ici
        // ne pouvait donc pas exister en production, et rien ne le disait :
        // c'est la validation de D70 qui l'a refusé, un ticket plus tard.
        auteurId: PORTAIL_A_CLIENT,
        clientId: CLIENT_A1,
      },
      async (tx) => ({
        facteurs: await tx.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT count(*) AS n FROM "second_facteur"`,
        ),
        comptes: await tx.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT count(*) AS n FROM "compte"`,
        ),
        sessions: await tx.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT count(*) AS n FROM "session"`,
        ),
      }),
    );

    expect(Number(vu.facteurs[0]?.n)).toBe(0);
    expect(Number(vu.comptes[0]?.n)).toBe(0);
    expect(Number(vu.sessions[0]?.n)).toBe(0);
  });

  it("un ADMINISTRATEUR de société n'y gagne RIEN — administrer n'est pas voir", async () => {
    // C'est le point le moins évident de la mesure, et il mérite son scénario :
    // `admin_societe` administre les IDENTITÉS (matrice §5.2), pas le matériau
    // d'authentification. Aucune des cinq politiques ne lit son rôle.
    await poserPopulation();
    const vu = await avecContexteRls(
      clientApp(),
      { societeId: SOCIETE_A, role: Role.admin_societe, auteurId: ADMIN },
      async (tx) => ({
        facteurs: await tx.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT count(*) AS n FROM "second_facteur"`,
        ),
        comptes: await tx.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT count(*) AS n FROM "compte"`,
        ),
      }),
    );

    expect(Number(vu.facteurs[0]?.n)).toBe(0);
    expect(Number(vu.comptes[0]?.n)).toBe(0);
  });
});

describe("LA BORNE — nommer une ligne n'en ouvre aucune autre", () => {
  it("le jeton du sujet n'ouvre pas la session d'autrui", async () => {
    await poserPopulation();
    const vues = await avecDesignationAuth(clientApp()).session.findMany({
      where: { token: JETON_SUJET },
    });
    expect(vues.map((v) => v.token)).toEqual([JETON_SUJET]);

    // Et un balayage sous la même désignation ne rend que la ligne nommée.
    const balayage = await clientApp().$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT set_config('app.authentification_jeton_session', $1, true)",
        JETON_SUJET,
      );
      return tx.$queryRawUnsafe<{ token: string }[]>(
        `SELECT "token" FROM "session" WHERE "token" LIKE 'jeton-l1-02d-%'`,
      );
    });
    expect(balayage.map((b) => b.token)).toEqual([JETON_SUJET]);
  });

  it("… et il ne désigne QUE la session : l'identité se nomme par son id", async () => {
    // Une branche avait été ajoutée à `utilisateur_lecture` pour que le jeton
    // désigne aussi son identité. Le jumeau l'a démentie — retirée, la chaîne
    // complète restait verte — et elle a été supprimée : une branche inutile
    // dans une politique d'identité est un élargissement sans objet. Ce
    // scénario constate l'état retenu, pour qu'on ne la remette pas par
    // habitude.
    await poserPopulation();
    const identites = await clientApp().$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT set_config('app.authentification_jeton_session', $1, true)",
        JETON_SUJET,
      );
      return tx.$queryRawUnsafe<{ id: string }[]>(
        `SELECT "id" FROM "utilisateur"`,
      );
    });
    expect(identites).toHaveLength(0);
  });
});

describe("RENDEZ-VOUS — L7-01 devra ouvrir la suppression, et lui seul", () => {
  it("le retrait d'un second facteur n'est ouvert à PERSONNE, et c'est décidé", async () => {
    // ── CE SCÉNARIO N'EST PAS UNE GARANTIE : C'EST UN RENDEZ-VOUS ──────────
    //
    // `second_facteur` n'a AUCUNE politique de suppression : sous `FORCE`, le
    // verbe est refusé pour tout le monde — le sujet comme l'administrateur.
    // C'est le bon défaut, et il est tenu.
    //
    // Mais L7-01 existe précisément pour débloquer un `admin_societe` qui a
    // perdu son second facteur, et il est aujourd'hui INIMPLÉMENTABLE. Ce n'est
    // pas un défaut : c'est une échéance. Sans ce scénario, celui qui écrira
    // L7-01 recevrait ZÉRO LIGNE sans explication — le refus d'une politique de
    // suppression est silencieux — et chercherait un bug là où il y a une
    // décision. Une EMBUSCADE. Avec lui, il reçoit un rendez-vous.
    await poserPopulation();

    const efface = await avecContexteRls(
      clientApp(),
      { societeId: SOCIETE_A, role: Role.admin_plateforme, auteurId: ADMIN },
      (tx) =>
        tx.$executeRawUnsafe(
          `DELETE FROM "second_facteur" WHERE "utilisateur_id" = $1::uuid`,
          SUJET,
        ),
    );

    expect(
      efface,
      "LE RETRAIT D'UN SECOND FACTEUR VIENT DE RÉUSSIR. Il n'est ouvert à " +
        "PERSONNE aujourd'hui — ni au sujet, ni à un administrateur — et c'est " +
        "une décision (D58, D59). Si ce scénario tombe, c'est que quelqu'un a " +
        "ouvert une politique de suppression sur `second_facteur`. L7-01 devra " +
        "en ouvrir UNE, et elle sera la SEULE : `admin_plateforme` seul, " +
        "journalisée dans `journal_acces`, avec réactivation obligatoire d'un " +
        "second facteur avant retour des droits d'administration. Tout autre " +
        "élargissement demande un arbitrage, pas une rustine.",
    ).toBe(0);

    // Et la contre-épreuve : le refus ne tient pas au hasard du rôle choisi.
    // Aucun des dix rôles n'ouvre ce verbe, parce qu'aucune politique ne le
    // couvre — c'est le VERBE qui est fermé, pas un rôle qui manque.
    const [politiques] = await clientOwner().$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM pg_policies
        WHERE tablename = 'second_facteur' AND cmd = 'DELETE'`,
    );
    expect(Number(politiques?.n)).toBe(0);
  });
});

describe("LE VERBE QUI EST LE CŒUR DU PROBLÈME — la suppression", () => {
  it("le sujet ne peut PLUS supprimer son second facteur", async () => {
    await poserPopulation();
    const efface = await avecContexteRls(
      clientApp(),
      { societeId: SOCIETE_A, role: Role.technicien, auteurId: SUJET },
      (tx) =>
        tx.$executeRawUnsafe(
          `DELETE FROM "second_facteur" WHERE "utilisateur_id" = $1::uuid`,
          SUJET,
        ),
    );

    // Le refus est SILENCIEUX — un `USING` qui ne retient aucune ligne n'est pas
    // une erreur, c'est zéro ligne. Il fallait le dire plutôt que d'attendre une
    // exception qui ne viendra pas.
    expect(efface).toBe(0);

    const [reste] = await clientOwner().$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM "second_facteur" WHERE "utilisateur_id" = $1::uuid`,
      SUJET,
    );
    expect(Number(reste?.n)).toBe(1);
  });

  it("ni personne d'autre : un balayage sans WHERE n'efface rien", async () => {
    await poserPopulation();
    const efface = await avecContexteRls(
      clientApp(),
      { societeId: SOCIETE_A, role: Role.admin_societe, auteurId: ADMIN },
      (tx) => tx.$executeRawUnsafe(`DELETE FROM "second_facteur"`),
    );
    expect(efface).toBe(0);
  });

  it("JUMEAU — rendez la politique de suppression, et l'effacement passe", async () => {
    // Le jumeau du §9 (24/08) : un test de refus prouve que le verrou mordait
    // le jour où on l'a écrit. Celui-ci retire LE verrou visé — l'absence de
    // politique `DELETE` — et montre que la faute passe alors.
    //
    // Tout se joue sur la connexion du PROPRIÉTAIRE, dans une transaction
    // annulée : le DDL est transactionnel en PostgreSQL, et `SET LOCAL ROLE`
    // fait tomber la même transaction sous le rôle applicatif, RLS comprise.
    // Deux connexions n'auraient pas marché — un DDL non validé n'est pas
    // visible ailleurs.
    await poserPopulation();

    const efface = await clientOwner()
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `CREATE POLICY "jumeau_suppression" ON "second_facteur"
             FOR DELETE USING (true)`,
        );
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "${ROLE_APP}"`);
        // Le contexte de LECTURE est posé aussi, et ce n'est pas une facilité :
        // PostgreSQL applique les politiques de SELECT aux lignes qu'un DELETE
        // doit d'abord retrouver. Sans lui, le jumeau rendrait zéro pour la
        // mauvaise raison — il éprouverait la lecture au lieu de la suppression,
        // et c'est très exactement le jumeau qui retire un verrou VOISIN
        // (§9, 24/08).
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.utilisateur_id', $1, true)",
          SUJET,
        );
        const n = await tx.$executeRawUnsafe(
          `DELETE FROM "second_facteur" WHERE "utilisateur_id" = $1::uuid`,
          SUJET,
        );
        throw new Annulation(String(n));
      })
      .catch((erreur: unknown) =>
        erreur instanceof Annulation ? Number(erreur.message) : -1,
      );

    // La violation a bien eu lieu : sans ce décompte, le jumeau serait creux.
    expect(efface).toBe(1);

    // Et la transaction annulée n'a rien laissé derrière elle.
    const [reste] = await clientOwner().$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM "second_facteur" WHERE "utilisateur_id" = $1::uuid`,
      SUJET,
    );
    expect(Number(reste?.n)).toBe(1);
    const [politique] = await clientOwner().$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM pg_policies
        WHERE tablename = 'second_facteur' AND policyname = 'jumeau_suppression'`,
    );
    expect(Number(politique?.n)).toBe(0);
  });
});

describe("JOURNAL_ACCES — une trace, pas un matériau d'authentification", () => {
  it("ne se modifie ni ne s'efface, et le refus est silencieux", async () => {
    const id = uuidv7();
    await avecDesignationAuth(clientApp()).journalAcces.create({
      data: {
        id,
        utilisateur_id: SUJET,
        evenement: EvenementAcces.bascule_societe,
        detail: "scénario L1-02d",
      },
    });

    // Le refus vient ici du PRIVILÈGE, pas de la politique : le rôle applicatif
    // ne détient que `INSERT` et `SELECT` sur cette table. Deux verrous
    // indépendants la gardent donc — l'absence de privilège, et l'absence de
    // politique sous `FORCE` —, et c'est le premier qui parle. On l'assert tel
    // qu'il se produit plutôt que tel qu'on l'imaginait.
    const refus = async (sql: string): Promise<string> =>
      avecContexteRls(
        clientApp(),
        { societeId: SOCIETE_A, role: Role.technicien, auteurId: SUJET },
        (tx) => tx.$executeRawUnsafe(sql, id),
      ).then(
        () => "PASSÉ",
        (erreur: unknown) => (erreur as Error).message,
      );

    expect(
      await refus(
        `UPDATE "journal_acces" SET "detail" = 'réécrit' WHERE "id" = $1::uuid`,
      ),
    ).toContain("permission denied");
    expect(
      await refus(`DELETE FROM "journal_acces" WHERE "id" = $1::uuid`),
    ).toContain("permission denied");

    const [reste] = await clientOwner().$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM "journal_acces" WHERE "id" = $1::uuid`,
      id,
    );
    expect(Number(reste?.n)).toBe(1);
  });

  it("sa lecture est BORNÉE : les lignes d'autrui restent invisibles", async () => {
    const id = uuidv7();
    await avecDesignationAuth(clientApp()).journalAcces.create({
      data: {
        id,
        utilisateur_id: AUTRUI,
        evenement: EvenementAcces.bascule_societe,
        detail: "ligne d'autrui",
      },
    });

    const vues = await avecContexteRls(
      clientApp(),
      { societeId: SOCIETE_A, role: Role.technicien, auteurId: SUJET },
      (tx) =>
        tx.$queryRawUnsafe<{ id: string }[]>(
          `SELECT "id" FROM "journal_acces" WHERE "id" = $1::uuid`,
          id,
        ),
    );
    expect(vues).toHaveLength(0);
  });
});

describe("LES CODES DE SECOURS NE SONT PLUS EN CLAIR", () => {
  it("ce qui est en base n'est pas ce qui a été rendu à l'utilisateur", async () => {
    const auth = creerAuth(clientApp());
    const authAdmin = creerAuth(clientApp(), {
      societeId: SOCIETE_A,
      role: Role.admin_societe,
    });
    const email = `secours-${Date.now()}@iso.test`;
    const motDePasse = "mot-de-passe-de-test-suffisamment-long";
    const cree = await authAdmin.api.signUpEmail({
      body: { email, password: motDePasse, name: "Codes de secours" },
    });

    const reponse = await auth.api.signInEmail({
      body: { email, password: motDePasse },
      asResponse: true,
    });
    const cookie = (reponse.headers.getSetCookie?.() ?? [])
      .map((c) => c.split(";")[0])
      .join("; ");

    const active = await auth.api.enableTwoFactor({
      body: { password: motDePasse },
      headers: new Headers({ cookie }),
    });
    const codes = (active as { backupCodes?: string[] }).backupCodes ?? [];
    // TÉMOIN : sans codes rendus, l'assertion suivante ne prouverait rien.
    expect(codes.length).toBeGreaterThan(0);

    const [ligne] = await clientOwner().$queryRawUnsafe<
      { codes_secours: string }[]
    >(
      `SELECT "codes_secours" FROM "second_facteur" WHERE "utilisateur_id" = $1::uuid`,
      cree.user.id,
    );
    expect(ligne?.codes_secours).toBeTruthy();
    for (const code of codes) {
      expect(ligne?.codes_secours).not.toContain(code);
    }
  });
});

/** Sentinelle d'annulation : elle fait retomber la transaction, sans erreur. */
class Annulation extends Error {}

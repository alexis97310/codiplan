import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import {
  TABLES_FILIATION,
  ecartsListeFiliation,
} from "../../scripts/lib/politiques-rls";
import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  SITE_A1_S1,
  SITE_A1_S2,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * TECHNICIENS ET HABILITATIONS (ticket L1-04 ; D9, D60, RG-PLA-04).
 *
 * **`site_habilitation_requise` est la PREMIÈRE table fille réelle d'une table
 * du parc**, et donc la première à porter la sixième forme de politique —
 * « filiation » —, tranchée à L1-02 et construite ici. Ce fichier éprouve ce que
 * cette forme apporte, et rien d'autre ne l'apporterait : *un compte portail
 * restreint au site S1 ne lit pas les exigences du site S2 du même client.*
 *
 * La forme « société » aurait laissé les deux visibles, et **la faute n'aurait
 * rien cassé de visible** — la liste se serait allongée, pas raccourcie. C'est le
 * jumeau, plus bas, qui le montre en acte.
 */

/** Sentinelle d'annulation : elle fait retomber la transaction, sans erreur. */
class Annulation extends Error {}

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien];
const ADV = UTILISATEUR_PAR_ROLE[Role.adv];

const HAB_A = "0192f0a0-1004-7000-8000-00000000000a";
const HAB_B = "0192f0a0-1004-7000-8000-00000000000b";
const EXIGENCE_S1 = "0192f0a0-1004-7000-8000-0000000000c1";
const EXIGENCE_S2 = "0192f0a0-1004-7000-8000-0000000000c2";

/** Sous un contexte de compte PORTAIL, avec son périmètre de sites. */
function sousPortail<T>(
  perimetre: readonly string[],
  travail: (tx: {
    $queryRawUnsafe: <R>(sql: string, ...p: unknown[]) => Promise<R>;
  }) => Promise<T>,
): Promise<T> {
  return clientApp().$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "SELECT set_config('app.societe_id',$1,true), set_config('app.role',$2,true)," +
        " set_config('app.client_id',$3,true), set_config('app.perimetre_sites',$4,true)",
      SOCIETE_A,
      Role.client,
      CLIENT_A1,
      perimetre.join(","),
    );
    return travail(tx as never);
  });
}

/** Sous un contexte INTERNE : aucun `client_id`, tout le parc de la société. */
function sousInterne<T>(
  societeId: string,
  travail: (tx: {
    $queryRawUnsafe: <R>(sql: string, ...p: unknown[]) => Promise<R>;
    $executeRawUnsafe: (sql: string, ...p: unknown[]) => Promise<number>;
  }) => Promise<T>,
): Promise<T> {
  return avecContexteRls(
    clientApp(),
    { societeId, role: Role.adv, auteurId: ADV },
    travail as never,
  );
}

beforeAll(async () => {
  // L'amorçage passe par le CHEMIN DE PRODUCTION — contexte de société, rôle
  // interne — plutôt que par le propriétaire : un harnais plus riche que la
  // production est un harnais qui ment (§9, 01/09).
  await sousInterne(SOCIETE_A, async (tx) => {
    await tx.$executeRawUnsafe(
      `INSERT INTO "habilitation" ("id","societe_id","code","libelle")
         VALUES ($1::uuid, $2::uuid, 'ISO-B1V', 'Basse tension, scénario L1-04')
       ON CONFLICT ("id") DO NOTHING`,
      HAB_A,
      SOCIETE_A,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO "site_habilitation_requise" ("id","societe_id","site_id","habilitation_id","bloquant")
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, true)
       ON CONFLICT ("id") DO NOTHING`,
      EXIGENCE_S1,
      SOCIETE_A,
      SITE_A1_S1,
      HAB_A,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO "site_habilitation_requise" ("id","societe_id","site_id","habilitation_id","bloquant")
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, false)
       ON CONFLICT ("id") DO NOTHING`,
      EXIGENCE_S2,
      SOCIETE_A,
      SITE_A1_S2,
      HAB_A,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO "technicien_habilitation"
         ("id","societe_id","utilisateur_id","habilitation_id","date_obtention","date_expiration")
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, DATE '2026-01-01', DATE '2027-01-01')
       ON CONFLICT ("id") DO NOTHING`,
      uuidv7(),
      SOCIETE_A,
      TECHNICIEN,
      HAB_A,
    );
  });

  await sousInterne(SOCIETE_B, (tx) =>
    tx.$executeRawUnsafe(
      `INSERT INTO "habilitation" ("id","societe_id","code","libelle")
         VALUES ($1::uuid, $2::uuid, 'ISO-B1V', 'Basse tension, société B')
       ON CONFLICT ("id") DO NOTHING`,
      HAB_B,
      SOCIETE_B,
    ),
  );
});

afterAll(fermerClients);

describe("TÉMOIN PRÉALABLE — les trois politiques sont en vigueur", () => {
  it("les trois tables portent les DEUX drapeaux", async () => {
    const etats = await clientOwner().$queryRawUnsafe<
      { table: string; activee: boolean; forcee: boolean }[]
    >(
      `SELECT relname AS "table", relrowsecurity AS "activee",
              relforcerowsecurity AS "forcee"
         FROM pg_class WHERE relname = ANY($1)`,
      ["habilitation", "technicien_habilitation", "site_habilitation_requise"],
    );
    expect(etats).toHaveLength(3);
    for (const etat of etats) {
      expect(etat.activee, `${etat.table} : ENABLE`).toBe(true);
      expect(etat.forcee, `${etat.table} : FORCE`).toBe(true);
    }
  });

  it("chacune rend ZÉRO sans contexte, et la population existe", async () => {
    for (const table of [
      "habilitation",
      "technicien_habilitation",
      "site_habilitation_requise",
    ]) {
      const [vu] = await clientApp().$queryRawUnsafe<{ n: bigint }[]>(
        `SELECT count(*) AS n FROM "${table}"`,
      );
      expect(Number(vu?.n), `${table} sans contexte`).toBe(0);

      const [total] = await clientOwner().$queryRawUnsafe<{ n: bigint }[]>(
        `SELECT count(*) AS n FROM "${table}"`,
      );
      expect(Number(total?.n), `population de ${table}`).toBeGreaterThan(0);
    }
  });

  it("la liste « filiation » est close des DEUX côtés", () => {
    expect(ecartsListeFiliation()).toEqual([]);
    // L'ADDITION.
    expect(
      ecartsListeFiliation([
        ...TABLES_FILIATION.map((e) => e.table),
        "utilisateur_client",
      ]),
    ).toHaveLength(1);
    // Le RETRAIT — le geste dangereux : il ne casse rien de visible.
    expect(ecartsListeFiliation([])).toHaveLength(TABLES_FILIATION.length);
  });
});

describe("LA FILIATION — un compte portail ne voit que les exigences de SON périmètre", () => {
  it("restreint à S1, il voit l'exigence de S1", async () => {
    const vues = await sousPortail([SITE_A1_S1], (tx) =>
      tx.$queryRawUnsafe<{ id: string }[]>(
        `SELECT "id" FROM "site_habilitation_requise"`,
      ),
    );
    expect(vues.map((v) => v.id)).toContain(EXIGENCE_S1);
  });

  it("… et PAS celle de S2, hors de son périmètre", async () => {
    const vues = await sousPortail([SITE_A1_S1], (tx) =>
      tx.$queryRawUnsafe<{ id: string }[]>(
        `SELECT "id" FROM "site_habilitation_requise"`,
      ),
    );
    expect(vues.map((v) => v.id)).not.toContain(EXIGENCE_S2);
    // Exactement une des deux : c'est le couple qui démontre. Deux
    // disparitions seraient la faute ; zéro serait un périmètre inerte.
    expect(vues).toHaveLength(1);
  });

  it("sans restriction, il voit les DEUX — le périmètre vide n'est pas « aucun »", async () => {
    const vues = await sousPortail([], (tx) =>
      tx.$queryRawUnsafe<{ id: string }[]>(
        `SELECT "id" FROM "site_habilitation_requise"`,
      ),
    );
    expect(vues.map((v) => v.id).sort()).toEqual(
      [EXIGENCE_S1, EXIGENCE_S2].sort(),
    );
  });

  it("JUMEAU — remplacez la filiation par la clause de société, et S2 réapparaît", async () => {
    // Le jumeau du §9 (24/08), et il retire LE verrou visé : la clause de
    // filiation, remplacée par celle qu'un correcteur bien intentionné
    // écrirait — la forme « société », qui est la forme par défaut d'une table
    // métier ordinaire. Tout se joue sur la connexion du PROPRIÉTAIRE, dans une
    // transaction annulée : le DDL est transactionnel, et `SET LOCAL ROLE` fait
    // tomber la même transaction sous le rôle applicatif, RLS comprise.
    const vues = await clientOwner()
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP POLICY "cloisonnement_filiation" ON "site_habilitation_requise"`,
        );
        await tx.$executeRawUnsafe(
          `CREATE POLICY "jumeau_societe" ON "site_habilitation_requise"
             USING ("societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid)
             WITH CHECK ("societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid)`,
        );
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "codiplan_app"`);
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.societe_id',$1,true), set_config('app.role',$2,true)," +
            " set_config('app.client_id',$3,true), set_config('app.perimetre_sites',$4,true)",
          SOCIETE_A,
          Role.client,
          CLIENT_A1,
          SITE_A1_S1,
        );
        const lues = await tx.$queryRawUnsafe<{ id: string }[]>(
          `SELECT "id" FROM "site_habilitation_requise"`,
        );
        throw new Annulation(JSON.stringify(lues.map((l) => l.id)));
      })
      .catch((erreur: unknown) =>
        erreur instanceof Annulation
          ? (JSON.parse(erreur.message) as string[])
          : [],
      );

    // LA VIOLATION A BIEN EU LIEU : sous la clause de société seule, le compte
    // portail restreint à S1 voit AUSSI l'exigence de S2. Sans cette assertion,
    // le jumeau serait creux.
    expect(vues).toContain(EXIGENCE_S2);
    expect(vues).toHaveLength(2);

    // Et la transaction annulée n'a rien laissé derrière elle.
    const [restante] = await clientOwner().$queryRawUnsafe<{ nom: string }[]>(
      `SELECT policyname AS "nom" FROM pg_policies
        WHERE tablename = 'site_habilitation_requise'`,
    );
    expect(restante?.nom).toBe("cloisonnement_filiation");
  });
});

describe("LE CLOISONNEMENT DE SOCIÉTÉ tient sur les trois tables", () => {
  it("la société A ne voit pas l'habilitation de la société B", async () => {
    const vues = await sousInterne(SOCIETE_A, (tx) =>
      tx.$queryRawUnsafe<{ id: string }[]>(`SELECT "id" FROM "habilitation"`),
    );
    expect(vues.map((v) => v.id)).toContain(HAB_A);
    expect(vues.map((v) => v.id)).not.toContain(HAB_B);
  });

  it("… alors que les deux portent le MÊME code : c'est bien la société qui sépare", async () => {
    // Témoin : sans deux lignes homonymes, le scénario ci-dessus passerait sur
    // une base où B n'a simplement rien.
    const [total] = await clientOwner().$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM "habilitation" WHERE "code" = 'ISO-B1V'`,
    );
    expect(Number(total?.n)).toBe(2);
  });
});

describe("LES CHAÎNAGES COMPOSITES refusent ce qu'une politique ne verrait pas", () => {
  it("on n'exige pas au site d'une société l'habilitation d'une AUTRE", async () => {
    // La clé composite `(societe_id, habilitation_id)` le tient
    // DÉCLARATIVEMENT — et les contrôles d'intégrité référentielle contournent
    // les politiques RLS par construction, donc c'est bien la clé qui parle.
    await expect(
      sousInterne(SOCIETE_A, (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "site_habilitation_requise" ("id","societe_id","site_id","habilitation_id")
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid)`,
          uuidv7(),
          SOCIETE_A,
          SITE_A1_S1,
          HAB_B,
        ),
      ),
    ).rejects.toThrow(/site_habilitation_requise_habilitation_fkey/);
  });

  it("on n'habilite pas quelqu'un qui n'appartient pas à la société", async () => {
    // Le chaînage vers `utilisateur_societe`, et non vers `utilisateur` seul :
    // une habilitation est tenue par une personne EN TANT QUE salarié.
    const etranger = UTILISATEUR_PAR_ROLE[Role.admin_plateforme];
    await expect(
      sousInterne(SOCIETE_A, (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "technicien_habilitation"
             ("id","societe_id","utilisateur_id","habilitation_id","date_obtention")
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, DATE '2026-01-01')`,
          uuidv7(),
          SOCIETE_A,
          etranger,
          HAB_A,
        ),
      ),
    ).rejects.toThrow(/technicien_habilitation_technicien_fkey/);
  });

  it("une expiration antérieure à l'obtention est refusée par la BASE", async () => {
    // Zod le refuse aussi, et les deux ne se remplacent pas : Zod ne voit ni
    // l'import Excel de L1-08 ni une correction faite à la main.
    await expect(
      sousInterne(SOCIETE_A, (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "technicien_habilitation"
             ("id","societe_id","utilisateur_id","habilitation_id","date_obtention","date_expiration")
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, DATE '2026-06-01', DATE '2026-01-01')`,
          uuidv7(),
          SOCIETE_A,
          ADV,
          HAB_A,
        ),
      ),
    ).rejects.toThrow(/technicien_habilitation_dates_ordonnees/);
  });
});

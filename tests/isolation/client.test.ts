import { afterAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "@prisma/client";

import {
  avecPortail,
  avecSociete,
  clientApp,
  clientOwner,
  fermerClients,
} from "./setup/db";
import { exigence } from "./setup/contrat";
import {
  CLIENT_A1,
  CLIENT_A2,
  CLIENT_B1,
  SOCIETE_A,
  SOCIETE_B,
  VAR_SOCIETE,
} from "./setup/fixtures";

/**
 * La fiche client, éprouvée sur la VRAIE table (ticket L1-01 ; I1 ; D10, D22,
 * D29 ; RG-IMP-05, RG-SOC-04).
 *
 * **Ce fichier existe parce que la fixture s'est effacée.** Jusqu'à ce ticket,
 * `client` était une table du harnais. La migration `20260901120000_client_l1_01`
 * l'a créée pour de bon, et `global.ts` ne fabrique plus la fixture : ce sont la
 * table réelle et SA politique — celle de la migration — que tous les scénarios
 * de `tests/isolation/` traversent désormais. Les scénarios portail de
 * `portail-client.test.ts` s'y sont reportés sans qu'une ligne change, ce qui
 * était tout l'objet du contrat de R0-a.
 *
 * Ce que ce fichier ajoute, et que le report ne donnait pas :
 *   1. la POLITIQUE en écriture — un utilisateur de A ne peut pas fabriquer un
 *      client de B, et le refus vient du `WITH CHECK` de la forme « parc » ;
 *   2. l'UNICITÉ du code externe, qui est par société et jamais globale — sans
 *      quoi deux sociétés vendues séparément ne pourraient pas porter le même
 *      code dans leurs ERP respectifs (RG-SOC-04, D29) ;
 *   3. la RAISON SOCIALE non vide, contrôlée en base et pas seulement par Zod ;
 *   4. la preuve PAR LECTURE que la clause société seule ferait fuir le
 *      portail — là où `politiques-rls.test.ts` prouve seulement que le gardien
 *      s'en apercevrait. Les deux sont nécessaires : un gardien qui rougit ne
 *      dit pas ce qui aurait fui, et une fuite mesurée ne dit pas qu'un gardien
 *      l'aurait vue (CLAUDE.md §9, 31/08 — « la preuve par lecture est la plus
 *      forte »).
 *
 * **Chaque refus a son jumeau** (CLAUDE.md §9, 24/08) : un scénario qui retire
 * RÉELLEMENT le verrou visé, dans une transaction annulée, et montre que
 * l'écriture fautive passe alors. Sans lui, un test vert ne dirait pas si c'est
 * le verrou attendu qui a mordu ou un voisin.
 */

/** Sentinelle d'annulation : elle fait retomber la transaction, sans erreur. */
class Annulation extends Error {}

/** Identifiants jetables, jamais écrits durablement (les scénarios annulent). */
const CLIENT_NEUF = "aaaaaaaa-0000-7000-8000-0000000000f1";
const CLIENT_NEUF_BIS = "aaaaaaaa-0000-7000-8000-0000000000f2";

/**
 * Exécute `travail` sous le PROPRIÉTAIRE, après avoir réellement défait le
 * verrou nommé, puis ANNULE tout.
 *
 * Le DDL est transactionnel en PostgreSQL : la contrainte revient au
 * `ROLLBACK`, et le jumeau rejoue à chaque `pnpm verify` au lieu d'être une
 * vérification faite une fois à la main. Le contexte société est posé parce que
 * `FORCE ROW LEVEL SECURITY` soumet le propriétaire lui-même aux politiques.
 */
async function sansVerrou(
  retrait: readonly string[],
  societeId: string,
  travail: (tx: PrismaClient) => Promise<void>,
): Promise<void> {
  try {
    await clientOwner().$transaction(async (tx) => {
      for (const instruction of retrait) {
        await tx.$executeRawUnsafe(instruction);
      }
      await tx.$executeRawUnsafe(
        "SELECT set_config($1, $2, true)",
        VAR_SOCIETE,
        societeId,
      );
      await travail(tx as unknown as PrismaClient);
      throw new Annulation();
    });
  } catch (erreur) {
    if (!(erreur instanceof Annulation)) {
      throw erreur;
    }
  }
}

/** Insère une fiche client par SQL brut — le chemin que rien ne filtre côté code. */
function insererClient(
  tx: PrismaClient,
  valeurs: {
    id: string;
    societeId: string;
    codeExterne: string | null;
    raisonSociale: string;
  },
): Promise<number> {
  return tx.$executeRawUnsafe(
    `INSERT INTO "client" ("id", "societe_id", "code_externe", "raison_sociale")
     VALUES ($1::uuid, $2::uuid, $3, $4)`,
    valeurs.id,
    valeurs.societeId,
    valeurs.codeExterne,
    valeurs.raisonSociale,
  );
}

describe("la fiche client (L1-01)", () => {
  afterAll(fermerClients);

  // ── 1. La politique en ÉCRITURE — forme « parc », moitié WITH CHECK ───────

  it("un utilisateur de A ne peut pas écrire un client de B", async () => {
    // Le cloisonnement n'est pas seulement une affaire de lecture : sans
    // `WITH CHECK`, une société pourrait DÉPOSER des lignes chez une autre —
    // qu'elle ne relirait jamais, mais que l'autre lirait.
    await expect(
      avecSociete(SOCIETE_A, (tx) =>
        insererClient(tx, {
          id: CLIENT_NEUF,
          societeId: SOCIETE_B,
          codeExterne: null,
          raisonSociale: "Fiche déposée chez le voisin",
        }),
      ),
    ).rejects.toThrow(/row-level security|violates row-level security/i);
  });

  it("ÉPREUVE PAR RETRAIT : sans le WITH CHECK, la fiche part chez le voisin", async () => {
    // Le verrou VISÉ est bien la moitié écriture de la politique, et non la
    // clé étrangère vers `societe` : on remplace la politique par une variante
    // ouverte, tout le reste du schéma est intact, et l'écriture passe.
    let lignes = -1;

    await sansVerrou(
      [
        'DROP POLICY "cloisonnement_parc" ON "client"',
        'CREATE POLICY "tout_ouvert" ON "client" USING (true) WITH CHECK (true)',
      ],
      SOCIETE_A,
      async (tx) => {
        lignes = await insererClient(tx, {
          id: CLIENT_NEUF,
          societeId: SOCIETE_B,
          codeExterne: null,
          raisonSociale: "Fiche déposée chez le voisin",
        });
      },
    );

    expect(lignes).toBe(1);
  });

  // ── 2. L'unicité du code externe : PAR SOCIÉTÉ, jamais globale ────────────

  it("deux SOCIÉTÉS portent le même code externe — c'est RG-SOC-04", async () => {
    // Le jeu du harnais donne `C-001` au client A1 et au client B1. Une unicité
    // globale les aurait rendus impossibles à coexister : deux sociétés vendues
    // séparément ont chacune son ERP, et leurs codes n'ont aucune raison de ne
    // pas se recouvrir.
    const codeA = await avecSociete(SOCIETE_A, (tx) =>
      tx.$queryRawUnsafe<Array<{ code_externe: string | null }>>(
        `SELECT "code_externe" FROM "client" WHERE "id" = $1::uuid`,
        CLIENT_A1,
      ),
    );
    const codeB = await avecSociete(SOCIETE_B, (tx) =>
      tx.$queryRawUnsafe<Array<{ code_externe: string | null }>>(
        `SELECT "code_externe" FROM "client" WHERE "id" = $1::uuid`,
        CLIENT_B1,
      ),
    );

    expect(codeA[0]?.code_externe).toBe("C-001");
    expect(codeB[0]?.code_externe).toBe("C-001");
  });

  it("deux fiches d'une MÊME société ne peuvent pas partager un code externe", async () => {
    // C'est la condition d'existence de RG-IMP-05 : le rapprochement se fait
    // « sur le code externe s'il existe ». Deux fiches qui le partagent
    // rendraient la règle indéterminée sans qu'aucune erreur ne se produise.
    //
    // **DÉSIGNER LE VERROU SANS POUVOIR LE NOMMER.** CLAUDE.md §9 (24/08)
    // demande que l'assertion nomme la contrainte, « sans quoi un refus venu
    // d'ailleurs passe pour le bon ». Mesuré ici : Prisma n'expose PAS le nom.
    // Sur une requête brute il rend `Raw query failed. Code: 23505. Message:
    // Unique constraint failed:` — le nom est tronqué ; par le client typé, il
    // rend `P2002` avec `meta.target` à `null`. Aucune graphie du nom n'est
    // donc atteignable, et un `toThrow(/client_societe_id_code_externe_key/)`
    // serait un test qu'on ne peut pas écrire, pas un test qu'on a oublié.
    //
    // Le verrou est donc désigné par TROIS observations conjointes, et
    // ensemble elles sont plus étroites qu'une comparaison de chaîne :
    //   1. le SQLSTATE est `23505` — violation d'UNICITÉ. Ce n'est ni la
    //      politique (`42501`), ni un `CHECK` (`23514`), ni une clé étrangère
    //      (`23503`) ;
    //   2. les deux DISCRIMINANTS ci-dessous réussissent — même société avec un
    //      autre code, autre société avec le même code. Aucune autre unicité de
    //      la table ne peut produire ce triplet : la clé primaire porte sur
    //      `id`, qui diffère dans les trois écritures ;
    //   3. le JUMEAU juste en dessous retire cet index NOMMÉMENT, et l'écriture
    //      passe alors.
    await expect(
      avecSociete(SOCIETE_A, (tx) =>
        insererClient(tx, {
          id: CLIENT_NEUF,
          societeId: SOCIETE_A,
          codeExterne: "C-001",
          raisonSociale: "Doublon de code externe",
        }),
      ),
    ).rejects.toThrow(/23505/);

    // Discriminant 1 — même société, autre code : accepté.
    let memeSocieteAutreCode = -1;
    await sansVerrou([], SOCIETE_A, async (tx) => {
      memeSocieteAutreCode = await insererClient(tx, {
        id: CLIENT_NEUF,
        societeId: SOCIETE_A,
        codeExterne: "C-999",
        raisonSociale: "Code externe libre",
      });
    });
    expect(memeSocieteAutreCode).toBe(1);

    // Discriminant 2 — autre société, même code : accepté. C'est la moitié
    // « par société » de l'unicité, et RG-SOC-04 l'exige.
    let autreSocieteMemeCode = -1;
    await sansVerrou([], SOCIETE_B, async (tx) => {
      autreSocieteMemeCode = await insererClient(tx, {
        id: "bbbbbbbb-0000-7000-8000-0000000000f3",
        societeId: SOCIETE_B,
        codeExterne: "C-002",
        raisonSociale: "Code déjà porté par une fiche de la société A",
      });
    });
    expect(autreSocieteMemeCode).toBe(1);
  });

  it("ÉPREUVE PAR RETRAIT : sans l'index unique, le doublon de code passe", async () => {
    let lignes = -1;

    await sansVerrou(
      ['DROP INDEX "client_societe_id_code_externe_key"'],
      SOCIETE_A,
      async (tx) => {
        lignes = await insererClient(tx, {
          id: CLIENT_NEUF,
          societeId: SOCIETE_A,
          codeExterne: "C-001",
          raisonSociale: "Doublon de code externe",
        });
      },
    );

    expect(lignes).toBe(1);
  });

  it("plusieurs fiches SANS code externe coexistent — D29 l'exige", async () => {
    // « Son absence ne suffit plus à rejeter la ligne » (D29). Les NULL ne se
    // heurtent pas dans un index unique PostgreSQL, et c'est la propriété sur
    // laquelle repose cette phrase.
    let lignes = 0;

    await sansVerrou([], SOCIETE_A, async (tx) => {
      lignes += await insererClient(tx, {
        id: CLIENT_NEUF,
        societeId: SOCIETE_A,
        codeExterne: null,
        raisonSociale: "Sans code externe, premier",
      });
      lignes += await insererClient(tx, {
        id: CLIENT_NEUF_BIS,
        societeId: SOCIETE_A,
        codeExterne: null,
        raisonSociale: "Sans code externe, second",
      });
    });

    expect(lignes).toBe(2);
  });

  // ── 3. La raison sociale, contrôlée EN BASE ───────────────────────────────

  it("la base refuse une raison sociale vide", async () => {
    // Zod le refuse aussi (`lib/clients/saisie.ts`), et ce n'est pas une
    // redondance : Zod ne voit ni l'import Excel de L1-08, ni une correction
    // faite à la main en `psql`.
    await expect(
      avecSociete(SOCIETE_A, (tx) =>
        insererClient(tx, {
          id: CLIENT_NEUF,
          societeId: SOCIETE_A,
          codeExterne: null,
          raisonSociale: "   ",
        }),
      ),
    ).rejects.toThrow(/client_raison_sociale_non_vide/);
  });

  it("ÉPREUVE PAR RETRAIT : sans la contrainte, la fiche sans nom passe", async () => {
    let lignes = -1;

    await sansVerrou(
      ['ALTER TABLE "client" DROP CONSTRAINT "client_raison_sociale_non_vide"'],
      SOCIETE_A,
      async (tx) => {
        lignes = await insererClient(tx, {
          id: CLIENT_NEUF,
          societeId: SOCIETE_A,
          codeExterne: null,
          raisonSociale: "   ",
        });
      },
    );

    expect(lignes).toBe(1);
  });

  // ── 4. La forme « parc », prouvée PAR LECTURE ─────────────────────────────

  it(
    exigence(
      "portail_autre_client",
      "la clause société SEULE ferait fuir la fiche de l'autre client (D10)",
    ),
    async () => {
      // **La réparation naturelle, mesurée par ses conséquences.**
      // `politiques-rls.test.ts` prouve que le gardien de formes rougit quand on
      // remplace la politique de `client` par la clause société seule. Ce
      // scénario-ci prouve l'autre moitié, et c'est la plus concrète : ce que le
      // compte portail LIT alors. A1 et A2 sont deux clients de la MÊME société ;
      // le filtre société ne les sépare pas, seul `app.client_id` le fait.
      let visibles: string[] = [];

      await sansVerrou(
        [
          'DROP POLICY "cloisonnement_parc" ON "client"',
          `CREATE POLICY "cloisonnement_societe" ON "client"
             USING ("societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid)
             WITH CHECK ("societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid)`,
          // Le propriétaire est BYPASSRLS sur cette base jetable : la lecture se
          // fait donc sous le rôle applicatif, hors de cette transaction. On se
          // contente ici de poser la faute, et on lit juste après.
        ],
        SOCIETE_A,
        async (tx) => {
          const lues = await tx.$queryRawUnsafe<Array<{ id: string }>>(
            `SELECT "id" FROM "client"
              WHERE "societe_id" = $1::uuid
                AND "id" = ANY(ARRAY[$2::uuid, $3::uuid])
              ORDER BY "id"`,
            SOCIETE_A,
            CLIENT_A1,
            CLIENT_A2,
          );
          visibles = lues.map((ligne) => ligne.id);
        },
      );

      // Sous la clause société seule, les DEUX clients de la société sont
      // atteignables : c'est exactement la fuite que D10 interdit.
      expect(visibles).toEqual([CLIENT_A1, CLIENT_A2].sort());

      // Et sous la politique réelle, rétablie par le ROLLBACK, le compte
      // portail du client A1 n'en voit qu'un.
      const sousLaVraiePolitique = await avecPortail(
        { societeId: SOCIETE_A, clientId: CLIENT_A1 },
        (tx) =>
          tx.$queryRawUnsafe<Array<{ id: string }>>(
            `SELECT "id" FROM "client" ORDER BY "id"`,
          ),
      );
      expect(sousLaVraiePolitique.map((ligne) => ligne.id)).toEqual([
        CLIENT_A1,
      ]);
    },
  );

  // ── 5. Le témoin : la table est bien celle de la migration ────────────────

  it("le gardien lit la table RÉELLE, et non une fixture du harnais", async () => {
    // Témoin de non-vacuité (CLAUDE.md §9, 30/08) : si le harnais fabriquait
    // encore sa fixture, les colonnes du chapitre 11.2 seraient absentes et ces
    // scénarios éprouveraient une autre table que celle de la production.
    const colonnes = await clientApp().$queryRawUnsafe<
      Array<{ column_name: string }>
    >(
      `SELECT "column_name"::text FROM "information_schema"."columns"
        WHERE "table_schema" = 'public' AND "table_name" = 'client'
        ORDER BY "column_name"`,
    );
    const noms = colonnes.map((colonne) => colonne.column_name);

    expect(noms).toContain("ridet");
    expect(noms).toContain("categorie");
    expect(noms).toContain("adresse_facturation");
    expect(noms).toContain("conditions_reglement");
    expect(noms).toContain("commercial_referent");
    // Et surtout : jamais `code_winpro`. C'est la colonne que D29 a renommée,
    // et le chapitre 11 l'écrit encore ainsi (écart É8 de la revue R0).
    expect(noms).not.toContain("code_winpro");
    expect(noms).toContain("code_externe");
  });
});

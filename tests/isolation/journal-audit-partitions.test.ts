import { afterAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "@prisma/client";

import { Role } from "@/lib/auth/roles";
import {
  ecartsHorizonPartitions,
  ecartsPartitionDefaut,
  type EtatPartitions,
} from "@/lib/db/partitions";
import { uuidv7 } from "@/lib/db/uuid";

import {
  ecartsDurcissementPartitions,
  ROLE_APPLICATIF,
  SQL_PARTITIONS_JOURNAL,
  versPartitionsJournal,
  type LignePartitionJournal,
} from "../../scripts/lib/privileges-journal";
import { sousSocieteEtRole, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  SOCIETE_A,
  SOCIETE_B,
  VAR_ROLE,
  VAR_SOCIETE,
} from "./setup/fixtures";

/** Sentinelle d'annulation des scénarios de durcissement (D55). */
class AnnulationDurcissement extends Error {}

/**
 * **Le journal naît PARTITIONNÉ** (ticket L0-10), et ce fichier éprouve les
 * trois choses que le partitionnement change, contre un vrai PostgreSQL.
 *
 *   1. **Le trou qu'un partitionnement naïf ouvrirait.** Une partition est une
 *      table : elle hérite d'`ALTER DEFAULT PRIVILEGES` — qui accorde `UPDATE`
 *      et `DELETE` au rôle applicatif sur toute table nouvelle — et n'hérite
 *      PAS des politiques du parent, lesquelles ne s'appliquent que si l'on
 *      interroge le parent. Nommer la partition contournerait donc à la fois le
 *      cloisonnement de I1 et l'ajout seul de I8, **dans la table qui porte les
 *      valeurs avant/après de tout le métier**. Le durcissement est éprouvé
 *      ici, et son jumeau le retire réellement pour montrer ce qui arriverait.
 *   2. **La partition par défaut n'est pas une précaution.** Sans elle, une
 *      écriture hors plage est refusée — et comme le déclencheur d'audit vit
 *      dans la transaction de l'écriture métier, c'est l'écriture métier qui
 *      échoue. Éprouvé en la retirant réellement.
 *   3. **Les deux contrôles datés mordent**, sur l'état réel de la base.
 */

/** Sentinelle d'annulation : elle fait retomber la transaction, sans erreur. */
class Annulation extends Error {}

/** Exécute `travail` sous le PROPRIÉTAIRE, dans une transaction ANNULÉE. */
async function dansUneTransactionAnnulee(
  travail: (tx: PrismaClient) => Promise<void>,
): Promise<void> {
  try {
    await clientOwner().$transaction(async (tx) => {
      await travail(tx as unknown as PrismaClient);
      throw new Annulation();
    });
  } catch (erreur) {
    if (!(erreur instanceof Annulation)) {
      throw erreur;
    }
  }
}

/** L'état des partitions, lu comme le script de contrôle le lit. */
async function etatPartitions(): Promise<EtatPartitions> {
  const owner = clientOwner();
  const [horloge] = await owner.$queryRawUnsafe<{ mois: string }[]>(
    "SELECT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM') AS mois",
  );
  const couverts = await owner.$queryRawUnsafe<{ mois: string }[]>(
    'SELECT mois FROM "journal_audit_partitions_couvertes"() ORDER BY mois',
  );
  const [defaut] = await owner.$queryRawUnsafe<{ presente: boolean }[]>(
    `SELECT count(*) > 0 AS presente FROM pg_catalog.pg_class
      WHERE relname = 'journal_audit_defaut' AND relkind = 'r'`,
  );
  const [lignes] = await owner.$queryRawUnsafe<{ lignes: bigint }[]>(
    'SELECT count(*) AS lignes FROM ONLY "journal_audit_defaut"',
  );
  return {
    moisCourant: horloge?.mois ?? "",
    moisCouverts: couverts.map((ligne) => ligne.mois),
    defautPresente: defaut?.presente ?? false,
    lignesParDefaut: Number(lignes?.lignes ?? 0),
  };
}

describe("le journal d'audit naît partitionné (L0-10)", () => {
  afterAll(fermerClients);

  it("la table est PARTITIONNÉE par mois, et sa clé primaire porte l'horodatage", async () => {
    const [table] = await clientOwner().$queryRawUnsafe<{ genre: string }[]>(
      `SELECT relkind::text AS genre FROM pg_catalog.pg_class
        WHERE oid = 'public.journal_audit'::regclass`,
    );
    // 'p' — table partitionnée. 'r' voudrait dire qu'elle est ordinaire, et
    // qu'il faudra un jour la réécrire sous ACCESS EXCLUSIVE.
    expect(table?.genre).toBe("p");

    const colonnes = await clientOwner().$queryRawUnsafe<{ colonne: string }[]>(
      `SELECT a.attname AS colonne
         FROM pg_catalog.pg_index i
         JOIN pg_catalog.pg_attribute a
           ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = 'public.journal_audit'::regclass AND i.indisprimary
        ORDER BY a.attname`,
    );
    // PostgreSQL EXIGE la clé de partitionnement dans toute contrainte
    // d'unicité : la clé primaire est donc composite, et ce test le rappelle à
    // quiconque voudrait la ramener à `id`.
    expect(colonnes.map((ligne) => ligne.colonne)).toEqual([
      "horodatage",
      "id",
    ]);
  });

  it("les écritures sont ROUTÉES vers la partition du mois, jamais par défaut", async () => {
    const [rangement] = await clientOwner().$queryRawUnsafe<
      { partition: string }[]
    >(
      `SELECT tableoid::regclass::text AS partition FROM "journal_audit"
        ORDER BY "horodatage" DESC LIMIT 1`,
    );
    // L'amorçage a écrit des lignes ; elles doivent être dans une partition
    // mensuelle, pas dans le filet.
    expect(rangement?.partition).toMatch(/^journal_audit_\d{4}_\d{2}$/);

    const etat = await etatPartitions();
    expect(etat.lignesParDefaut).toBe(0);
  });

  it("aucune partition ne laisse au rôle applicatif le moindre privilège", async () => {
    // Le durcissement, observé et non déclaré. Le rôle applicatif n'adresse que
    // le parent ; tout privilège sur une partition ne pourrait servir qu'à le
    // contourner.
    const privileges = await clientOwner().$queryRawUnsafe<
      { table: string; privilege: string }[]
    >(
      `SELECT g."table_name"::text AS "table", g."privilege_type"::text AS "privilege"
         FROM "information_schema"."role_table_grants" g
         JOIN pg_catalog.pg_class c ON c.relname = g."table_name"
         JOIN pg_catalog.pg_inherits i ON i.inhrelid = c.oid
        WHERE g."grantee" = $1
          AND i.inhparent = 'public.journal_audit'::regclass`,
      ROLE_APPLICATIF,
    );

    expect(privileges).toEqual([]);
  });

  it("chaque partition a RLS ACTIVÉE **et** FORCÉE — les deux drapeaux", async () => {
    // Ce scénario ne regardait d'abord que `relforcerowsecurity`, et il aurait
    // laissé passer une RLS inerte : mesuré en base, `FORCE` sans `ENABLE`
    // laisse la ligne LISIBLE en nommant la partition. Les deux drapeaux sont
    // donc exigés, ici comme dans le contrôle permanent.
    const partitions = await clientOwner().$queryRawUnsafe<
      { nom: string; activee: boolean; forcee: boolean }[]
    >(
      `SELECT c.relname AS nom,
              c.relrowsecurity AS activee,
              c.relforcerowsecurity AS forcee
         FROM pg_catalog.pg_class c
         JOIN pg_catalog.pg_inherits i ON i.inhrelid = c.oid
        WHERE i.inhparent = 'public.journal_audit'::regclass
        ORDER BY c.relname`,
    );

    // Le mois courant, douze d'avance, et le filet.
    expect(partitions.length).toBeGreaterThanOrEqual(14);
    expect(
      partitions.filter((partition) => !partition.activee || !partition.forcee),
    ).toEqual([]);
  });

  /** Le durcissement, lu comme `controle-cloisonnement.mts` le lit. */
  async function partitionsObservees(tx?: PrismaClient) {
    const client = tx ?? clientOwner();
    const lignes = await client.$queryRawUnsafe<LignePartitionJournal[]>(
      SQL_PARTITIONS_JOURNAL,
      ROLE_APPLICATIF,
    );
    return versPartitionsJournal(lignes);
  }

  it("LE CONTRÔLE PERMANENT juge chaque partition, et il en voit", async () => {
    // La même requête et la même règle que le script joue contre la base
    // hébergée à chaque migration : les deux éprouvent la MÊME observation.
    const partitions = await partitionsObservees();

    expect(ecartsDurcissementPartitions(partitions)).toEqual([]);
    // Et il ne s'exerce pas sur le vide — le témoin, sans quoi le scénario
    // précédent serait vert pour la mauvaise raison.
    expect(partitions.length).toBeGreaterThanOrEqual(14);
  });

  it("ÉPREUVE : une partition RÉELLEMENT créée nue fait échouer le contrôle", async () => {
    // Le défaut tel qu'il se commettra : une migration future, ou une main
    // humaine un soir de production, qui écrit `CREATE TABLE … PARTITION OF`
    // sans passer par `journal_audit_partition_creer`. Mesuré avant correction,
    // le contrôle permanent répondait VERT sur exactement cette partition.
    let ecarts: string[] = [];

    await dansUneTransactionAnnulee(async (tx) => {
      await tx.$executeRawUnsafe(
        `CREATE TABLE public."journal_audit_2099_01" PARTITION OF "journal_audit"
           FOR VALUES FROM (timestamptz '2099-01-01 00:00:00+00')
                        TO (timestamptz '2099-02-01 00:00:00+00')`,
      );
      ecarts = ecartsDurcissementPartitions(await partitionsObservees(tx));
    });

    // Deux écarts : les privilèges hérités d'ALTER DEFAULT PRIVILEGES, et
    // l'absence de RLS. L'assertion NOMME la partition, sans quoi un écart venu
    // d'ailleurs passerait pour celui-ci.
    expect(ecarts).toHaveLength(2);
    expect(ecarts.join("\n")).toContain("journal_audit_2099_01");
    expect(ecarts.join("\n")).toContain("ALTER DEFAULT PRIVILEGES");
    expect(ecarts.join("\n")).toContain("NON activée, NON forcée");
  });

  it("ÉPREUVE : une partition À MOITIÉ durcie est refusée elle aussi", async () => {
    // La forme voisine, celle qu'un correcteur bien intentionné écrirait : il
    // retire les privilèges, pose FORCE, et oublie ENABLE. Mesuré en base, la
    // ligne reste alors lisible en nommant la partition.
    let ecarts: string[] = [];

    await dansUneTransactionAnnulee(async (tx) => {
      await tx.$executeRawUnsafe(
        `CREATE TABLE public."journal_audit_2099_02" PARTITION OF "journal_audit"
           FOR VALUES FROM (timestamptz '2099-02-01 00:00:00+00')
                        TO (timestamptz '2099-03-01 00:00:00+00')`,
      );
      await tx.$executeRawUnsafe(
        `REVOKE ALL ON public."journal_audit_2099_02" FROM "${ROLE_APPLICATIF}"`,
      );
      await tx.$executeRawUnsafe(
        `ALTER TABLE public."journal_audit_2099_02" FORCE ROW LEVEL SECURITY`,
      );
      ecarts = ecartsDurcissementPartitions(await partitionsObservees(tx));
    });

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("journal_audit_2099_02");
    expect(ecarts[0]).toContain("NON activée, forcée");
  });

  it("la FONCTION du dépôt, elle, produit une partition qui passe le contrôle", async () => {
    // Le témoin positif : sans lui, les deux épreuves ci-dessus prouveraient
    // seulement que le contrôle sait dire non.
    let ecarts: string[] = [];

    await dansUneTransactionAnnulee(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT "journal_audit_partition_creer"(date '2099-01-01')`,
      );
      ecarts = ecartsDurcissementPartitions(await partitionsObservees(tx));
    });

    expect(ecarts).toEqual([]);
  });

  it("ÉPREUVE : sans durcissement, une partition laisse TOUT passer", async () => {
    // Le jumeau du §9, et il porte sur le verrou visé — le durcissement, pas un
    // voisin. Le scénario est placé là où le défaut RÉUSSIT : on rend à la
    // partition les privilèges par défaut et on lui retire RLS, exactement ce
    // qu'un `CREATE TABLE … PARTITION OF` nu aurait laissé.
    const [cible] = await clientOwner().$queryRawUnsafe<{ nom: string }[]>(
      `SELECT c.relname AS nom FROM pg_catalog.pg_class c
         JOIN pg_catalog.pg_inherits i ON i.inhrelid = c.oid
        WHERE i.inhparent = 'public.journal_audit'::regclass
          AND c.relname ~ '^journal_audit_[0-9]'
        ORDER BY c.relname LIMIT 1`,
    );
    const partition = cible?.nom as string;
    expect(partition).toBeDefined();

    let vuesSansDurcissement = -1;
    let reecrites = -1;

    await dansUneTransactionAnnulee(async (tx) => {
      await tx.$executeRawUnsafe(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON public."${partition}" TO "${ROLE_APPLICATIF}"`,
      );
      await tx.$executeRawUnsafe(
        `ALTER TABLE public."${partition}" NO FORCE ROW LEVEL SECURITY`,
      );
      await tx.$executeRawUnsafe(
        `ALTER TABLE public."${partition}" DISABLE ROW LEVEL SECURITY`,
      );

      await tx.$executeRawUnsafe(
        "SELECT set_config($1, $2, true)",
        VAR_SOCIETE,
        SOCIETE_A,
      );
      await tx.$executeRawUnsafe(
        "SELECT set_config($1, $2, true)",
        VAR_ROLE,
        Role.direction,
      );
      await tx.$executeRawUnsafe(`SET LOCAL ROLE "${ROLE_APPLICATIF}"`);

      const lignes = await tx.$queryRawUnsafe<{ n: bigint }[]>(
        `SELECT count(*) AS n FROM public."${partition}"
          WHERE "societe_id" <> $1::uuid`,
        SOCIETE_A,
      );
      vuesSansDurcissement = Number(lignes[0]?.n ?? 0);

      reecrites = await tx.$executeRawUnsafe(
        `UPDATE public."${partition}" SET "adresse_ip" = 'falsifiée'`,
      );
    });

    // Sans durcissement, la société A LIT les lignes d'audit d'une autre
    // société — dont B, que la fixture alimente — et les réécrit toutes.
    expect(vuesSansDurcissement).toBeGreaterThan(0);
    expect(reecrites).toBeGreaterThan(0);
  });

  it("durcie, la partition refuse d'être adressée — et le parent reste cloisonné", async () => {
    const [cible] = await clientOwner().$queryRawUnsafe<{ nom: string }[]>(
      `SELECT c.relname AS nom FROM pg_catalog.pg_class c
         JOIN pg_catalog.pg_inherits i ON i.inhrelid = c.oid
        WHERE i.inhparent = 'public.journal_audit'::regclass
          AND c.relname ~ '^journal_audit_[0-9]'
        ORDER BY c.relname LIMIT 1`,
    );

    await expect(
      sousSocieteEtRole(SOCIETE_A, Role.direction, (tx) =>
        tx.$queryRawUnsafe(`SELECT 1 FROM public."${cible?.nom}"`),
      ),
    ).rejects.toThrow(/permission denied/i);

    // Et l'accès légitime, par le parent, continue de ne rendre que sa société.
    const vues = await sousSocieteEtRole(SOCIETE_A, Role.direction, (tx) =>
      tx.$queryRawUnsafe<{ societe_id: string }[]>(
        'SELECT DISTINCT "societe_id"::text AS "societe_id" FROM "journal_audit"',
      ),
    );
    expect(vues.map((ligne) => ligne.societe_id)).toEqual([SOCIETE_A]);
    expect(vues.map((ligne) => ligne.societe_id)).not.toContain(SOCIETE_B);
  });

  /**
   * **LA GARANTIE DE SUBSTITUTION, PAYÉE COMPTANT** (D55).
   *
   * Depuis D55, `journal_audit` est HORS du domaine d'audit : elle n'est pas
   * tracée, parce qu'un gardien ne peut pas se garder lui-même (§9). Écrire
   * cela laisse un trou pour un lecteur futur, et le trou n'est acceptable que
   * si la garantie qui le remplace est **mesurée** : le journal n'est pas
   * audité, il est INALTÉRABLE.
   *
   * **Par TENTATIVE, jamais par lecture de privilèges.** `pg_privileges` dit ce
   * que la base a accordé ; il ne dit pas ce qui se passe quand on essaie. Les
   * deux verrous — le privilège retiré et l'absence de politique sous `FORCE
   * ROW LEVEL SECURITY` — se lisent à deux endroits différents, et une lecture
   * qui n'en regarderait qu'un serait juste et creuse. Une écriture refusée les
   * traverse tous les deux sans avoir à les connaître.
   *
   * **Sur CHAQUE partition, énumérée par `pg_inherits`, jamais sur la mère.**
   * Une partition EST une table : elle hérite d'`ALTER DEFAULT PRIVILEGES` — qui
   * accorde les quatre verbes au rôle applicatif sur toute table nouvelle — et
   * n'hérite NI des privilèges NI des politiques du parent. C'est exactement la
   * faille mesurée à L0-10, et elle se rejouerait ici si l'on interrogeait la
   * mère : la nommer, elle, donne le bon résultat pour la mauvaise raison.
   */
  describe("le journal n'est pas audité — il est INALTÉRABLE (D55)", () => {
    /** Toutes les partitions, la partition par défaut comprise. */
    async function partitions(): Promise<string[]> {
      const lignes = await clientOwner().$queryRawUnsafe<{ nom: string }[]>(
        `SELECT c.relname::text AS nom FROM pg_catalog.pg_class c
           JOIN pg_catalog.pg_inherits i ON i.inhrelid = c.oid
          WHERE i.inhparent = 'public.journal_audit'::regclass
          ORDER BY c.relname`,
      );
      return lignes.map((ligne) => ligne.nom);
    }

    it("sur la table MÈRE : `UPDATE` et `DELETE` sont refusés en acte", async () => {
      const [cible] = await clientOwner().$queryRawUnsafe<{ id: string }[]>(
        `SELECT "id"::text AS "id" FROM "journal_audit"
          WHERE "societe_id" = $1::uuid LIMIT 1`,
        SOCIETE_A,
      );
      // Témoin : sans ligne à réécrire, un refus ne prouverait rien — il
      // pourrait venir de l'absence de cible.
      expect(cible?.id).toBeDefined();

      await expect(
        sousSocieteEtRole(SOCIETE_A, Role.direction, (tx) =>
          tx.$executeRawUnsafe(
            `UPDATE "journal_audit" SET "adresse_ip" = 'falsifiée'
              WHERE "id" = $1::uuid`,
            cible?.id,
          ),
        ),
      ).rejects.toThrow(/permission denied|row-level security/i);

      await expect(
        sousSocieteEtRole(SOCIETE_A, Role.direction, (tx) =>
          tx.$executeRawUnsafe(
            `DELETE FROM "journal_audit" WHERE "id" = $1::uuid`,
            cible?.id,
          ),
        ),
      ).rejects.toThrow(/permission denied|row-level security/i);
    });

    it("sur CHAQUE partition : `UPDATE` et `DELETE` sont refusés en acte", async () => {
      const toutes = await partitions();

      // Témoin de non-vacuité, et il compte double ici : une énumération vide
      // rendrait la boucle silencieuse, et « aucune partition n'a laissé
      // passer » ressemblerait trait pour trait à « aucune partition n'a été
      // regardée » (§9, 30/08).
      expect(toutes.length).toBeGreaterThanOrEqual(13);
      expect(toutes).toContain("journal_audit_defaut");

      for (const partition of toutes) {
        await expect(
          sousSocieteEtRole(SOCIETE_A, Role.direction, (tx) =>
            tx.$executeRawUnsafe(
              `UPDATE public."${partition}" SET "adresse_ip" = 'falsifiée'`,
            ),
          ),
          `UPDATE sur ${partition}`,
        ).rejects.toThrow(/permission denied/i);

        await expect(
          sousSocieteEtRole(SOCIETE_A, Role.direction, (tx) =>
            tx.$executeRawUnsafe(`DELETE FROM public."${partition}"`),
          ),
          `DELETE sur ${partition}`,
        ).rejects.toThrow(/permission denied/i);
      }
    });

    it("ÉPREUVE PAR RETRAIT : le durcissement ôté, les DEUX verbes passent", async () => {
      // **Le jumeau de la boucle ci-dessus, et il porte sur le verrou visé.**
      // Sans lui, « aucune partition n'a laissé passer » et « la tentative ne
      // sait pas passer » se ressemblent trait pour trait — c'est la vacuité du
      // §9, et elle a failli être commise ici : une première rédaction de ce
      // jumeau desserrait la partition HORS transaction, et le harnais
      // recréait le schéma avant que les tests ne tournent. Le desserrage était
      // effacé, la boucle restait verte, et rien n'avait été prouvé.
      //
      // Le retrait se fait donc DANS la transaction, sous `SET LOCAL ROLE` :
      // le DDL non validé est visible du rôle qui l'a posé, et le `ROLLBACK`
      // rétablit tout.
      const [cible] = await clientOwner().$queryRawUnsafe<{ nom: string }[]>(
        `SELECT c.relname AS nom FROM pg_catalog.pg_class c
           JOIN pg_catalog.pg_inherits i ON i.inhrelid = c.oid
          WHERE i.inhparent = 'public.journal_audit'::regclass
            AND c.relname ~ '^journal_audit_[0-9]'
          ORDER BY c.relname LIMIT 1`,
      );
      const partition = cible?.nom as string;
      expect(partition).toBeDefined();

      let reecrites = -1;
      let effacees = -1;

      await dansUneTransactionAnnulee(async (tx) => {
        await tx.$executeRawUnsafe(
          `GRANT SELECT, INSERT, UPDATE, DELETE ON public."${partition}" TO "${ROLE_APPLICATIF}"`,
        );
        await tx.$executeRawUnsafe(
          `ALTER TABLE public."${partition}" NO FORCE ROW LEVEL SECURITY`,
        );
        await tx.$executeRawUnsafe(
          `ALTER TABLE public."${partition}" DISABLE ROW LEVEL SECURITY`,
        );
        await tx.$executeRawUnsafe(
          "SELECT set_config($1, $2, true)",
          VAR_SOCIETE,
          SOCIETE_A,
        );
        await tx.$executeRawUnsafe(
          "SELECT set_config($1, $2, true)",
          VAR_ROLE,
          Role.direction,
        );
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "${ROLE_APPLICATIF}"`);

        reecrites = await tx.$executeRawUnsafe(
          `UPDATE public."${partition}" SET "adresse_ip" = 'falsifiée'`,
        );
        effacees = await tx.$executeRawUnsafe(
          `DELETE FROM public."${partition}"`,
        );
      });

      // Les DEUX verbes passent. La boucle plus haut n'est donc pas verte
      // parce qu'une tentative ne saurait pas aboutir : elle est verte parce
      // que le durcissement mord.
      expect(reecrites).toBeGreaterThan(0);
      expect(effacees).toBeGreaterThan(0);
    });

    it("l'état NON DURCI n'est pas productible par le chemin du dépôt", async () => {
      // **Le troisième temps, et le seul qui parle de l'AVENIR.** Une épreuve
      // jouée sur les partitions d'aujourd'hui ne dit rien de celles de l'an
      // prochain. Ce qui le dit, c'est que le durcissement soit posé par la
      // fonction qui CRÉE la partition, dans la même transaction — comme le
      // `REVOKE` et la RLS l'ont été à L0-10.
      //
      // Mesuré ici, et pas lu dans la migration : on crée une partition par la
      // fonction du dépôt, puis on tente d'y écrire. Elle naît durcie.
      const futur = "2099-07-01";
      await clientOwner()
        .$transaction(async (tx) => {
          const [creee] = await tx.$queryRawUnsafe<{ nom: string }[]>(
            `SELECT "journal_audit_partition_creer"($1::date) AS nom`,
            futur,
          );
          const nom = creee?.nom ?? "";
          expect(nom).toBe("journal_audit_2099_07");

          // Le durcissement est là AVANT tout autre appel : aucune fenêtre entre
          // la création et le retrait des droits.
          const [prive] = await tx.$queryRawUnsafe<{ n: bigint }[]>(
            `SELECT count(*) AS n FROM information_schema.role_table_grants
            WHERE grantee = $1 AND table_schema = 'public' AND table_name = $2`,
            ROLE_APPLICATIF,
            nom,
          );
          expect(Number(prive?.n ?? -1)).toBe(0);

          const [drapeaux] = await tx.$queryRawUnsafe<
            { activee: boolean; forcee: boolean }[]
          >(
            `SELECT relrowsecurity AS activee, relforcerowsecurity AS forcee
             FROM pg_catalog.pg_class WHERE oid = ('public.' || $1)::regclass`,
            nom,
          );
          expect(drapeaux?.activee).toBe(true);
          expect(drapeaux?.forcee).toBe(true);

          // On annule : cette partition de 2099 n'a rien à faire dans la base.
          throw new AnnulationDurcissement();
        })
        .catch((erreur: unknown) => {
          if (!(erreur instanceof AnnulationDurcissement)) {
            throw erreur;
          }
        });
    });

    it("LA LIMITE, annoncée : une partition posée À LA MAIN naît nue", async () => {
      // **Ce que le dispositif ne peut pas tenir, et qui se dit plutôt que se
      // tait.** Rendre l'état non durci INPRODUCTIBLE demanderait un
      // déclencheur d'événement (`ddl_command_end`), et PostgreSQL en réserve
      // la création au superutilisateur — dont le rôle de migration ne dispose
      // pas sur la base hébergée. Le chemin du dépôt ne produit donc jamais de
      // partition nue ; un `CREATE TABLE … PARTITION OF` écrit à la main, si.
      //
      // Ce qui reste, et qui n'est pas rien : le contrôle DÉTECTIF de
      // `scripts/controle-cloisonnement.mts`, qui juge chaque partition à
      // chaque migration. Le préventif protège du problème, le détectif prouve
      // qu'il ne s'est pas produit — le couple du 30/08.
      //
      // La limite est MESURÉE, pas supposée : la partition nue est réellement
      // créée, et elle laisse réellement passer.
      let reecrites = -1;
      await clientOwner()
        .$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `CREATE TABLE public."journal_audit_2099_08"
             PARTITION OF "journal_audit"
             FOR VALUES FROM ('2099-08-01') TO ('2099-09-01')`,
          );
          const [prive] = await tx.$queryRawUnsafe<{ n: bigint }[]>(
            `SELECT count(*) AS n FROM information_schema.role_table_grants
            WHERE grantee = $1 AND table_schema = 'public' AND table_name = $2`,
            ROLE_APPLICATIF,
            "journal_audit_2099_08",
          );
          // Les quatre verbes, hérités d'`ALTER DEFAULT PRIVILEGES`.
          reecrites = Number(prive?.n ?? -1);
          throw new AnnulationDurcissement();
        })
        .catch((erreur: unknown) => {
          if (!(erreur instanceof AnnulationDurcissement)) {
            throw erreur;
          }
        });

      expect(reecrites).toBeGreaterThan(0);
    });
  });

  it("ÉPREUVE : sans partition par défaut, c'est l'ÉCRITURE MÉTIER qui échoue", async () => {
    // La raison d'être du filet, mesurée plutôt qu'affirmée. On retire réellement
    // la partition par défaut, puis on écrit une ligne métier dont l'audit
    // porterait un horodatage hors plage — ici en forçant l'horloge de la
    // transaction n'étant pas possible, on écrit directement une ligne d'audit
    // hors plage, ce que le déclencheur ferait si les partitions manquaient.
    let message = "";
    try {
      await clientOwner().$transaction(async (tx) => {
        await tx.$executeRawUnsafe('DROP TABLE public."journal_audit_defaut"');
        await tx.$executeRawUnsafe(
          `INSERT INTO "journal_audit"
             ("id", "societe_id", "entite", "entite_id", "action", "horodatage")
           VALUES ($1::uuid, $2::uuid, 'agence', $3::uuid, 'creation',
                   timestamptz '2050-01-15 00:00:00+00')`,
          uuidv7(),
          SOCIETE_A,
          AGENCE_A,
        );
        throw new Annulation();
      });
    } catch (erreur) {
      if (erreur instanceof Annulation) {
        throw new Error(
          "L'écriture hors plage a été acceptée sans partition par défaut : " +
            "le filet ne servirait donc à rien, ce qui contredit la migration.",
        );
      }
      message = erreur instanceof Error ? erreur.message : String(erreur);
    }

    // Le refus de PostgreSQL, mot pour mot : c'est lui qui remonterait à
    // l'écriture métier, puisque le déclencheur vit dans sa transaction.
    expect(message).toMatch(/no partition of relation .* found/i);
  });

  it("une ligne tombée par défaut INTERDIT ensuite de créer la partition de son mois", async () => {
    // Le point qui rend le contrôle détectif urgent : le rattrapage devient
    // impossible sans déplacer les lignes à la main. Mesuré, pas affirmé.
    let message = "";
    await dansUneTransactionAnnulee(async (tx) => {
      await tx.$executeRawUnsafe(
        `INSERT INTO "journal_audit"
           ("id", "societe_id", "entite", "entite_id", "action", "horodatage")
         VALUES ($1::uuid, $2::uuid, 'agence', $3::uuid, 'creation',
                 timestamptz '2050-01-15 00:00:00+00')`,
        uuidv7(),
        SOCIETE_A,
        AGENCE_A,
      );
      try {
        await tx.$executeRawUnsafe(
          `SELECT "journal_audit_partition_creer"(date '2050-01-01')`,
        );
      } catch (erreur) {
        message = erreur instanceof Error ? erreur.message : String(erreur);
      }
    });

    expect(message).toMatch(/default partition/i);
  });
});

describe("les deux contrôles datés mordent sur la base réelle (L0-10)", () => {
  afterAll(fermerClients);

  it("sur la base saine, les deux sont verts", async () => {
    const etat = await etatPartitions();

    expect(ecartsHorizonPartitions(etat)).toEqual([]);
    expect(ecartsPartitionDefaut(etat)).toEqual([]);
    // Et ils ne s'exercent pas sur le vide : la migration a bien posé le mois
    // courant et douze d'avance.
    expect(etat.moisCouverts.length).toBeGreaterThanOrEqual(13);
    expect(etat.defautPresente).toBe(true);
  });

  it("ÉPREUVE : les partitions d'avance réellement supprimées, le PRÉVENTIF mord", async () => {
    let etatAmputé: EtatPartitions | undefined;

    await dansUneTransactionAnnulee(async (tx) => {
      await tx.$executeRawUnsafe(`
        DO $$
        DECLARE t record;
        BEGIN
          FOR t IN
            SELECT c.relname FROM pg_catalog.pg_class c
              JOIN pg_catalog.pg_inherits i ON i.inhrelid = c.oid
             WHERE i.inhparent = 'public.journal_audit'::regclass
               AND c.relname ~ '^journal_audit_[0-9]'
               AND c.relname > 'journal_audit_' || to_char(now() AT TIME ZONE 'UTC', 'YYYY_MM')
          LOOP
            EXECUTE format('DROP TABLE public.%I', t.relname);
          END LOOP;
        END
        $$`);

      const couverts = await tx.$queryRawUnsafe<{ mois: string }[]>(
        'SELECT mois FROM "journal_audit_partitions_couvertes"() ORDER BY mois',
      );
      const [horloge] = await tx.$queryRawUnsafe<{ mois: string }[]>(
        "SELECT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM') AS mois",
      );
      etatAmputé = {
        moisCourant: horloge?.mois ?? "",
        moisCouverts: couverts.map((ligne) => ligne.mois),
        defautPresente: true,
        lignesParDefaut: 0,
      };
    });

    const ecarts = ecartsHorizonPartitions(etatAmputé as EtatPartitions);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("0 mois d'avance");
    // Et le DÉTECTIF reste vert : rien n'est encore tombé. C'est l'indépendance
    // des deux contrôles, constatée en base et non seulement en logique pure.
    expect(ecartsPartitionDefaut(etatAmputé as EtatPartitions)).toEqual([]);
  });

  it("ÉPREUVE : une ligne réellement rangée par défaut, le DÉTECTIF mord", async () => {
    let etatSali: EtatPartitions | undefined;

    await dansUneTransactionAnnulee(async (tx) => {
      await tx.$executeRawUnsafe(
        `INSERT INTO "journal_audit"
           ("id", "societe_id", "entite", "entite_id", "action", "horodatage")
         VALUES ($1::uuid, $2::uuid, 'agence', $3::uuid, 'creation',
                 timestamptz '2050-01-15 00:00:00+00')`,
        uuidv7(),
        SOCIETE_A,
        AGENCE_A,
      );

      const [lignes] = await tx.$queryRawUnsafe<{ lignes: bigint }[]>(
        'SELECT count(*) AS lignes FROM ONLY "journal_audit_defaut"',
      );
      const couverts = await tx.$queryRawUnsafe<{ mois: string }[]>(
        'SELECT mois FROM "journal_audit_partitions_couvertes"() ORDER BY mois',
      );
      const [horloge] = await tx.$queryRawUnsafe<{ mois: string }[]>(
        "SELECT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM') AS mois",
      );
      etatSali = {
        moisCourant: horloge?.mois ?? "",
        moisCouverts: couverts.map((ligne) => ligne.mois),
        defautPresente: true,
        lignesParDefaut: Number(lignes?.lignes ?? 0),
      };
    });

    expect((etatSali as EtatPartitions).lignesParDefaut).toBe(1);

    const ecarts = ecartsPartitionDefaut(etatSali as EtatPartitions);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("1 ligne(s)");
    // Et le PRÉVENTIF reste vert : l'horizon est intact, le mal est déjà fait.
    // C'est exactement ce qu'un contrôle unique ne saurait pas dire.
    expect(ecartsHorizonPartitions(etatSali as EtatPartitions)).toEqual([]);
  });
});

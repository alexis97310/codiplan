/**
 * Privilèges du rôle applicatif sur le journal d'audit — logique pure
 * (ticket L0-10, invariant I8, arbitrage D32).
 *
 * **Ce que ce contrôle établit.** Le journal d'audit est en AJOUT SEUL :
 * l'histoire s'écrit, elle ne se réécrit pas. Cette propriété ne tient pas à
 * une intention ni à une revue de code — elle tient à ce que la base a
 * réellement accordé au rôle applicatif : `SELECT` et `INSERT`, et rien
 * d'autre.
 *
 * **Pourquoi elle a besoin d'un contrôle PERMANENT, et pas seulement d'une
 * migration.** La migration `20260820130000_force_rls_role_applicatif` a posé
 * un `ALTER DEFAULT PRIVILEGES` qui accorde d'avance `SELECT, INSERT, UPDATE,
 * DELETE` au rôle applicatif sur **toute table créée ensuite**. `journal_audit`
 * reçoit donc les quatre à sa naissance, et deux lui sont retirés dans la
 * foulée. Le droit d'écriture n'est pas absent par nature : il est **retiré**.
 * Un `GRANT … ON ALL TABLES` distrait, un correctif appliqué à la main sur la
 * base hébergée, une migration qui recopie l'ancien bloc de droits, et il
 * revient — sans que rien ne le signale. C'est exactement la situation de
 * `codiplan_reporting` (D38), et elle appelle la même réponse : **observer, ne
 * pas déclarer.**
 *
 * **Pourquoi `information_schema.role_table_grants`.** C'est la vue qui dit ce
 * que la base a réellement accordé, et non ce que le dépôt croit avoir accordé.
 * Elle n'est lisible que pour les droits dont le rôle connecté est bénéficiaire
 * ou concédant : le contrôle s'exécute donc sous le rôle de MIGRATION, qui a
 * posé les `GRANT`. Sous un autre rôle, la requête rendrait zéro ligne — et le
 * vide ressemble beaucoup trop à la conformité pour qu'on l'accepte. D'où la
 * première règle ci-dessous : **zéro ligne est un échec.**
 */

/** Rôle applicatif contrôlé (migration `20260820130000`). */
export const ROLE_APPLICATIF = "codiplan_app";

/** La table dont l'ajout seul est la propriété (I8, D32). */
export const TABLE_JOURNAL_AUDIT = "journal_audit";

/**
 * Les deux privilèges — et les deux seuls — que le rôle applicatif doit
 * détenir sur le journal.
 *
 * `INSERT` est aussi contrôlé que `UPDATE` est interdit, et pour une raison
 * qu'on oublie facilement : le déclencheur d'audit s'exécute en `SECURITY
 * INVOKER`, donc avec les droits du rôle applicatif. `INSERT` retiré, ce n'est
 * pas le journal qui se dégrade — c'est **toute écriture métier** qui échoue.
 * Le contrôle échoue donc aussi bien sur un privilège de trop que sur un
 * privilège manquant.
 */
export const PRIVILEGES_ATTENDUS = ["INSERT", "SELECT"] as const;

/**
 * La requête, écrite une seule fois et partagée par
 * `scripts/controle-cloisonnement.mts` (base hébergée) et par
 * `tests/isolation/journal-audit.test.ts` (base jetable) : les deux éprouvent
 * la MÊME observation, pas deux formulations voisines. Rôle et table sont des
 * paramètres liés, jamais interpolés.
 */
export const SQL_PRIVILEGES_JOURNAL = `
  SELECT "privilege_type"::text AS "privilege",
         "is_grantable"::text   AS "transmissible"
    FROM "information_schema"."role_table_grants"
   WHERE "grantee" = $1
     AND "table_schema" = 'public'
     AND "table_name" = $2
   ORDER BY "privilege_type"
`;

/** Ligne brute telle que la requête la rend. */
export type LignePrivilegeJournal = {
  privilege: string;
  /** Domaine `yes_or_no` de la norme SQL : « YES » ou « NO ». */
  transmissible: string;
};

/** Un privilège détenu sur le journal, réduit à l'utile. */
export type PrivilegeJournal = {
  privilege: string;
  /** Le bénéficiaire peut-il transmettre ce droit à un tiers ? */
  transmissible: boolean;
};

/** Convertit les lignes brutes en privilèges exploitables. */
export function versPrivilegesJournal(
  lignes: readonly LignePrivilegeJournal[],
): PrivilegeJournal[] {
  return lignes.map((ligne) => ({
    privilege: ligne.privilege,
    transmissible: ligne.transmissible === "YES",
  }));
}

/**
 * Écarts entre les privilèges observés et l'ajout seul.
 *
 * Quatre motifs d'échec, dans cet ordre :
 *   1. **aucun privilège observé** — soit la table n'existe pas, soit la vue
 *      est aveugle sous le rôle connecté. Dans les deux cas le contrôle n'a
 *      rien établi, et il doit le dire plutôt que passer au vert ;
 *   2. **un privilège d'écriture** — `UPDATE`, `DELETE`, `TRUNCATE` : c'est
 *      l'objet même du contrôle, et le jour où l'un d'eux réapparaît, l'étape
 *      échoue ;
 *   3. **un privilège attendu manquant** — sans `INSERT`, le déclencheur
 *      d'audit ne peut plus écrire, et c'est toute écriture métier qui tombe ;
 *   4. **un privilège transmissible** (`WITH GRANT OPTION`) — un droit que le
 *      bénéficiaire peut redistribuer n'est plus une limite.
 */
export function ecartsPrivilegesJournal(
  observes: readonly PrivilegeJournal[],
): string[] {
  if (observes.length === 0) {
    return [
      `aucun privilège observé pour « ${ROLE_APPLICATIF} » sur ` +
        `« ${TABLE_JOURNAL_AUDIT} » : soit la table est absente, soit ` +
        "information_schema.role_table_grants est aveugle sous le rôle " +
        "connecté. Le contrôle n'a donc rien établi — l'exécuter avec le rôle " +
        "qui a posé les GRANT (MIGRATION_DATABASE_URL).",
    ];
  }

  const ecarts: string[] = [];
  const attendus: readonly string[] = PRIVILEGES_ATTENDUS;

  for (const accorde of observes) {
    if (!attendus.includes(accorde.privilege)) {
      ecarts.push(
        `« ${ROLE_APPLICATIF} » détient ${accorde.privilege} sur ` +
          `« ${TABLE_JOURNAL_AUDIT} ». Le journal d'audit est en AJOUT SEUL ` +
          `(I8, D32) : ${attendus.join(" et ")}, et rien d'autre. Un droit de ` +
          "réécriture sur le journal rend le mot « inaltérable » faux.",
      );
      continue;
    }
    if (accorde.transmissible) {
      ecarts.push(
        `« ${ROLE_APPLICATIF} » détient ${accorde.privilege} WITH GRANT ` +
          `OPTION sur « ${TABLE_JOURNAL_AUDIT} » : il peut redistribuer ce ` +
          "droit à un tiers, ce qui n'est plus une limite.",
      );
    }
  }

  const detenus = observes.map((accorde) => accorde.privilege);
  for (const attendu of attendus) {
    if (!detenus.includes(attendu)) {
      ecarts.push(
        `« ${ROLE_APPLICATIF} » ne détient PAS ${attendu} sur ` +
          `« ${TABLE_JOURNAL_AUDIT} ». Le déclencheur d'audit s'exécute en ` +
          "SECURITY INVOKER, donc avec les droits de ce rôle : sans INSERT, " +
          "ce n'est pas le journal qui se dégrade, c'est toute écriture " +
          "métier qui échoue.",
      );
    }
  }

  return ecarts;
}

/** Rapport de journal — ce que le rôle applicatif détient sur le journal. */
export function rapportPrivilegesJournal(
  observes: readonly PrivilegeJournal[],
): string {
  return [
    `Privilèges de « ${ROLE_APPLICATIF} » sur « ${TABLE_JOURNAL_AUDIT} » ` +
      "(observés, non déclarés)",
    ...observes.map(
      (accorde) =>
        `  ${accorde.privilege}` +
        (accorde.transmissible ? " WITH GRANT OPTION" : ""),
    ),
    "",
  ].join("\n");
}

/* ────────────────────────────────────────────────────────────────────────────
 * LE DURCISSEMENT DES PARTITIONS — et pourquoi le contrôle ci-dessus ne
 * suffisait pas (ticket L0-10, correction de revue).
 *
 * **Le défaut, mesuré sur le contrôle lui-même.** `SQL_PRIVILEGES_JOURNAL`
 * interroge `table_name = 'journal_audit'` : LE PARENT, et lui seul. Or une
 * partition est une TABLE — elle hérite d'`ALTER DEFAULT PRIVILEGES` et
 * n'hérite pas des politiques du parent. Une partition créée par un autre
 * chemin que `journal_audit_partition_creer` — une migration future, une main
 * humaine un soir de production — porte donc `SELECT, INSERT, UPDATE, DELETE`
 * pour le rôle applicatif et aucune RLS, et **le contrôle passait au vert**.
 * Mesuré : partition créée nue, privilèges `DELETE,INSERT,SELECT,UPDATE`,
 * `relforcerowsecurity = false`, verdict du contrôle : VERT.
 *
 * C'est exactement la leçon que ce ticket vient d'inscrire au §9, retournée
 * contre son propre gardien : **une garantie posée sur une table ne suit pas
 * ses partitions.** Le contrôle prouvait quelque chose du parent, qui ne dit
 * rien de ses partitions.
 *
 * **LES DEUX DRAPEAUX, et c'est le second piège.** `FORCE ROW LEVEL SECURITY`
 * seul ne suffit PAS : PostgreSQL n'applique les politiques que si RLS est
 * aussi ACTIVÉE. Mesuré : `relrowsecurity = false`, `relforcerowsecurity =
 * true`, et la ligne reste lisible en nommant la partition. Le contrôle exige
 * donc les deux.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Partitions du journal, avec ce qu'il faut pour juger de leur durcissement.
 *
 * Le `LEFT JOIN` est délibéré : une partition SANS aucun privilège doit
 * apparaître dans le résultat — c'est l'état sain, et une jointure interne le
 * ferait disparaître, transformant « aucune partition n'est privilégiée » en
 * « aucune partition n'existe ». Le contrôle ne saurait plus distinguer les
 * deux.
 */
export const SQL_PARTITIONS_JOURNAL = `
  SELECT "c"."relname"::text            AS "partition",
         "c"."relrowsecurity"           AS "rls_activee",
         "c"."relforcerowsecurity"      AS "rls_forcee",
         coalesce(
           string_agg("g"."privilege_type"::text, ',' ORDER BY "g"."privilege_type"),
           ''
         )                              AS "privileges"
    FROM "pg_catalog"."pg_class" "c"
    JOIN "pg_catalog"."pg_inherits" "i" ON "i"."inhrelid" = "c"."oid"
    LEFT JOIN "information_schema"."role_table_grants" "g"
      ON "g"."table_schema" = 'public'
     AND "g"."table_name" = "c"."relname"
     AND "g"."grantee" = $1
   WHERE "i"."inhparent" = 'public.journal_audit'::regclass
   GROUP BY "c"."relname", "c"."relrowsecurity", "c"."relforcerowsecurity"
   ORDER BY "c"."relname"
`;

/** Ligne brute telle que la requête la rend. */
export type LignePartitionJournal = {
  partition: string;
  rls_activee: boolean;
  rls_forcee: boolean;
  /** Privilèges joints par des virgules, chaîne vide s'il n'y en a aucun. */
  privileges: string;
};

/** Une partition, réduite à ce dont le durcissement a besoin. */
export type PartitionJournal = {
  partition: string;
  rlsActivee: boolean;
  rlsForcee: boolean;
  privileges: readonly string[];
};

/** Convertit les lignes brutes en partitions exploitables. */
export function versPartitionsJournal(
  lignes: readonly LignePartitionJournal[],
): PartitionJournal[] {
  return lignes.map((ligne) => ({
    partition: ligne.partition,
    rlsActivee: ligne.rls_activee,
    rlsForcee: ligne.rls_forcee,
    privileges:
      ligne.privileges.length === 0 ? [] : ligne.privileges.split(","),
  }));
}

/**
 * Écarts de durcissement — une liste vide est le seul état acceptable.
 *
 * Trois motifs, et le premier est celui qu'on oublie :
 *   1. **aucune partition observée** — le journal est partitionné depuis sa
 *      création, il en a forcément. Zéro signifie que la vue est aveugle, que
 *      la table n'existe pas, ou qu'on interroge la mauvaise base. Un contrôle
 *      qui n'a rien vu n'a rien prouvé, et il doit le dire (leçon du témoin :
 *      une énumération vide ressemble beaucoup trop à un sans-faute) ;
 *   2. **un privilège accordé au rôle applicatif** — il n'adresse que le
 *      parent ; tout privilège sur une partition ne pourrait servir qu'à le
 *      contourner, donc à contourner les politiques ;
 *   3. **RLS inactive** — et il faut les DEUX drapeaux. `FORCE` seul laisse les
 *      politiques inappliquées, mesuré.
 */
export function ecartsDurcissementPartitions(
  observees: readonly PartitionJournal[],
): string[] {
  if (observees.length === 0) {
    return [
      `aucune partition observée pour « ${TABLE_JOURNAL_AUDIT} » : la table ` +
        "est partitionnée depuis sa création, elle en a forcément. Soit la " +
        "table est absente, soit la base interrogée n'est pas la bonne, soit " +
        "information_schema est aveugle sous le rôle connecté. Le contrôle " +
        "n'a donc rien établi — l'exécuter avec le rôle qui a posé les GRANT " +
        "(MIGRATION_DATABASE_URL).",
    ];
  }

  const ecarts: string[] = [];

  for (const partition of observees) {
    if (partition.privileges.length > 0) {
      ecarts.push(
        `la partition « ${partition.partition} » accorde ` +
          `${partition.privileges.join(", ")} à « ${ROLE_APPLICATIF} ». Une ` +
          "partition est une TABLE : elle hérite d'ALTER DEFAULT PRIVILEGES " +
          "et n'hérite pas des politiques du parent. Le rôle applicatif " +
          "n'adresse que le parent ; tout privilège ici ne peut servir qu'à " +
          "le contourner — mesuré, il suffit à lire, réécrire et effacer les " +
          "lignes d'audit d'une AUTRE société. Créer une partition et la " +
          "durcir ne se séparent pas : passer par " +
          "journal_audit_partition_creer, ou pnpm partitions:etendre.",
      );
    }

    if (!partition.rlsActivee || !partition.rlsForcee) {
      const etat = [
        partition.rlsActivee ? "activée" : "NON activée",
        partition.rlsForcee ? "forcée" : "NON forcée",
      ].join(", ");
      ecarts.push(
        `la partition « ${partition.partition} » n'est pas protégée par la ` +
          `sécurité au niveau des lignes (${etat}). Les DEUX drapeaux sont ` +
          "exigés : FORCE seul laisse les politiques inappliquées — mesuré, " +
          "la ligne reste lisible en nommant la partition. Durcir par " +
          "journal_audit_partition_durcir.",
      );
    }
  }

  return ecarts;
}

/** Rapport de journal — l'état de durcissement, partition par partition. */
export function rapportPartitionsJournal(
  observees: readonly PartitionJournal[],
): string {
  const durcies = observees.filter(
    (partition) =>
      partition.privileges.length === 0 &&
      partition.rlsActivee &&
      partition.rlsForcee,
  ).length;

  return [
    `Durcissement des partitions de « ${TABLE_JOURNAL_AUDIT} » ` +
      "(observé, non déclaré)",
    `  ${durcies} / ${observees.length} partition(s) sans privilège et sous RLS forcée`,
    ...observees
      .filter(
        (partition) =>
          partition.privileges.length > 0 ||
          !partition.rlsActivee ||
          !partition.rlsForcee,
      )
      .map(
        (partition) =>
          `  ${partition.partition.padEnd(24)} : ` +
          `privilèges [${partition.privileges.join(",") || "aucun"}], ` +
          `rls ${partition.rlsActivee ? "activée" : "INACTIVE"}/` +
          `${partition.rlsForcee ? "forcée" : "NON FORCÉE"}`,
      ),
    "",
  ].join("\n");
}

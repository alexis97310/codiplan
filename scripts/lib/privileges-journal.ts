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

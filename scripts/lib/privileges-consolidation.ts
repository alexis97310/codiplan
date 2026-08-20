/**
 * Privilèges du rôle de consolidation — logique pure (arbitrage D38).
 *
 * **Pourquoi un contrôle permanent.** `codiplan_reporting` porte `BYPASSRLS` :
 * il voit toutes les sociétés, et il peut se connecter. C'est une clé
 * passe-partout, et ce qui l'empêche d'en être une dangereuse tient à une seule
 * chose — il ne détient que `SELECT`. Cette limite est posée par une migration,
 * c'est-à-dire une fois ; rien ne garantit qu'une migration future, un correctif
 * appliqué à la main sur la base hébergée ou un `GRANT ALL` distrait ne la
 * défasse. D38 exige donc qu'elle soit **contrôlée à chaque migration, par
 * observation et non par déclaration**.
 *
 * **Pourquoi `information_schema.role_table_grants`.** C'est la vue qui dit ce
 * que la base a réellement accordé. Elle n'est lisible que pour les droits dont
 * le rôle connecté est bénéficiaire ou concédant : le contrôle s'exécute donc
 * sous le rôle de MIGRATION, qui a posé les `GRANT` et en est le concédant. Un
 * contrôle joué sous le rôle applicatif ne verrait rien du tout — et le vide
 * ressemble beaucoup trop à la conformité pour qu'on l'accepte. D'où la seconde
 * règle ci-dessous : zéro ligne est un échec, pas un succès.
 */

/** Le seul privilège que le rôle de consolidation ait le droit de détenir. */
export const PRIVILEGE_AUTORISE = "SELECT";

/** Nom du rôle contrôlé (D21). */
export const ROLE_CONSOLIDATION = "codiplan_reporting";

/**
 * La requête, écrite une seule fois.
 *
 * Elle est partagée par `scripts/controle-cloisonnement.mts`, qui l'exécute
 * contre la base hébergée, et par le scénario `tests/isolation/reporting`, qui
 * l'exécute contre la base jetable : les deux éprouvent ainsi la MÊME
 * observation, pas deux formulations voisines. Le nom du rôle est passé en
 * paramètre (`$1`), jamais interpolé.
 */
export const SQL_PRIVILEGES_CONSOLIDATION = `
  SELECT "table_name"::text     AS "table",
         "privilege_type"::text AS "privilege",
         "is_grantable"::text   AS "transmissible"
    FROM "information_schema"."role_table_grants"
   WHERE "grantee" = $1
     AND "table_schema" = 'public'
   ORDER BY "table_name", "privilege_type"
`;

/** Ligne brute telle que la requête la rend. */
export type LignePrivilege = {
  table: string;
  privilege: string;
  /** Domaine `yes_or_no` de la norme SQL : « YES » ou « NO ». */
  transmissible: string;
};

/** Une ligne de `information_schema.role_table_grants`, réduite à l'utile. */
export type PrivilegeAccorde = {
  table: string;
  privilege: string;
  /** Le bénéficiaire peut-il transmettre ce droit à un tiers ? */
  transmissible: boolean;
};

/** Convertit les lignes brutes en privilèges exploitables. */
export function versPrivileges(
  lignes: readonly LignePrivilege[],
): PrivilegeAccorde[] {
  return lignes.map((ligne) => ({
    table: ligne.table,
    privilege: ligne.privilege,
    transmissible: ligne.transmissible === "YES",
  }));
}

/**
 * Écarts entre les privilèges observés et ce que D21 autorise.
 *
 * Trois motifs d'échec, dans cet ordre :
 *   1. **aucun privilège observé** — soit le rôle n'existe pas, soit la vue est
 *      aveugle sous le rôle connecté. Dans les deux cas le contrôle n'a rien
 *      prouvé, et il doit le dire plutôt que passer au vert ;
 *   2. **un privilège autre que `SELECT`** — c'est l'objet même du contrôle : le
 *      jour où une écriture apparaît, l'étape échoue ;
 *   3. **un `SELECT` transmissible** (`WITH GRANT OPTION`) — un droit que le
 *      bénéficiaire peut redistribuer n'est plus une limite.
 */
export function ecartsPrivilegesConsolidation(
  observes: readonly PrivilegeAccorde[],
): string[] {
  if (observes.length === 0) {
    return [
      `aucun privilège observé pour « ${ROLE_CONSOLIDATION} » : soit le rôle ` +
        "est absent, soit information_schema.role_table_grants est aveugle " +
        "sous le rôle connecté. Le contrôle n'a donc rien établi — exécuter " +
        "cette étape avec le rôle qui a posé les GRANT (MIGRATION_DATABASE_URL).",
    ];
  }

  const ecarts: string[] = [];

  for (const accorde of observes) {
    if (accorde.privilege !== PRIVILEGE_AUTORISE) {
      ecarts.push(
        `« ${ROLE_CONSOLIDATION} » détient ${accorde.privilege} sur ` +
          `« ${accorde.table} ». D21 ne lui accorde que ${PRIVILEGE_AUTORISE} : ` +
          "un droit d'écriture sur une connexion qui contourne le " +
          "cloisonnement est une porte dérobée.",
      );
      continue;
    }
    if (accorde.transmissible) {
      ecarts.push(
        `« ${ROLE_CONSOLIDATION} » détient ${PRIVILEGE_AUTORISE} WITH GRANT ` +
          `OPTION sur « ${accorde.table} » : il peut redistribuer sa lecture ` +
          "à un tiers, ce qui n'est plus une limite.",
      );
    }
  }

  return ecarts;
}

/** Rapport de journal — ce que le rôle détient, table par table. */
export function rapportPrivileges(
  observes: readonly PrivilegeAccorde[],
): string {
  return [
    `Privilèges de « ${ROLE_CONSOLIDATION} » (observés, non déclarés)`,
    ...observes.map(
      (accorde) =>
        `  ${accorde.table.padEnd(20)} : ${accorde.privilege}` +
        (accorde.transmissible ? " WITH GRANT OPTION" : ""),
    ),
    "",
  ].join("\n");
}

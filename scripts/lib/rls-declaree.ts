import { TABLES_CLOISONNEES } from "./inventaire";

/**
 * L'état DÉCLARÉ de la sécurité au niveau des lignes, table par table — logique
 * pure (I1 ; correction de revue du ticket L0-10).
 *
 * **Pourquoi ce contrôle existe, alors que le cloisonnement est déjà prouvé par
 * la LECTURE.** Les scénarios d'isolation et le contrôle de cloisonnement lisent
 * de vraies lignes sous de vrais rôles : c'est la preuve la plus forte qu'on
 * puisse produire, et elle ne peut pas rester verte sur une RLS éteinte.
 * Mesuré : `DISABLE ROW LEVEL SECURITY` sur `societe`, et le rôle applicatif
 * voit aussitôt les deux sociétés sans contexte.
 *
 * **Mais elle est structurellement AVEUGLE à `FORCE`.** `FORCE ROW LEVEL
 * SECURITY` ne change rien pour un rôle NON propriétaire — il ne concerne que
 * le propriétaire des tables. Une lecture faite sous `codiplan_app` ne peut donc
 * pas le voir. Mesuré, sur un propriétaire non superutilisateur :
 *
 * | État de `societe` | rôle applicatif | PROPRIÉTAIRE |
 * |---|---|---|
 * | `ENABLE` + `FORCE` | 0 ligne | 0 ligne |
 * | `ENABLE`, **`FORCE` retiré** | 0 ligne — *rien ne se voit* | **2 lignes** |
 * | **`ENABLE` retiré** | 2 lignes | 2 lignes |
 *
 * La ligne du milieu est tout l'objet de ce module : le cloisonnement paraît
 * intact, et le propriétaire — donc les migrations, le seed, toute connexion de
 * maintenance — lit les deux sociétés. **Ce qui ne se prouve pas par la lecture
 * doit se prouver par l'attribut**, et c'est le seul cas du dépôt où l'attribut
 * est la seule preuve possible.
 *
 * **Et l'attribut se lit en DEUX drapeaux, jamais un.** `FORCE` sans `ENABLE`
 * laisse la sécurité inerte — mesuré au même ticket sur les partitions du
 * journal. Une assertion sur un seul drapeau est creuse.
 *
 * **Les trois listes sont CLOSES et l'appartenance est exclusive**, sur le
 * modèle du gardien d'exhaustivité de D41 : toute table de `public` doit
 * relever d'exactement l'une d'elles. Une table cloisonnée qui perdrait
 * entièrement sa RLS ne « disparaîtrait » pas du contrôle — elle basculerait
 * dans la troisième liste, où elle n'a rien à faire, et le contrôle le dirait.
 */

/**
 * Tables dont la RLS doit être ACTIVÉE **et** FORCÉE — les tables cloisonnées.
 *
 * `journal_audit` s'ajoute à `TABLES_CLOISONNEES`, et l'écart entre les deux
 * listes est délibéré : celle de l'inventaire sert un DÉCOMPTE comparé, auquel
 * le journal ne se prête pas (il grossit à chaque écriture, et sa lecture n'est
 * ouverte qu'à deux rôles). Ici il s'agit d'un ATTRIBUT, et le journal est
 * cloisonné comme les autres — il doit donc y figurer.
 *
 * Ses PARTITIONS sont exclues du périmètre de ce contrôle : elles ont le leur,
 * plus exigeant, dans `scripts/lib/privileges-journal.ts` — aucun privilège du
 * tout, et les deux drapeaux.
 */
export const TABLES_RLS_FORCEE = [
  ...TABLES_CLOISONNEES,
  "journal_audit",
] as const;

/**
 * Référentiels de plateforme : RLS activée, **jamais forcée** (D4). Le
 * propriétaire doit pouvoir les amorcer sans contexte — c'est ce que `FORCE`
 * lui interdirait.
 */
export const TABLES_RLS_SIMPLE = ["devise", "parite", "jour_ferie"] as const;

/**
 * Tables SANS aucune RLS : les tables techniques d'authentification (troisième
 * catégorie de I1, D34) et l'identité de plateforme (quatrième, D39). Elles ne
 * portent pas de `societe_id` et l'authentification doit pouvoir chercher un
 * compte avant qu'aucune société ne soit active.
 *
 * Les énumérer plutôt que les ignorer est ce qui rend le contrôle TOTAL : une
 * table cloisonnée qui perdrait sa RLS atterrirait ici, et serait nommée.
 */
export const TABLES_SANS_RLS = [
  "session",
  "compte",
  "verification",
  "second_facteur",
  "journal_acces",
  "utilisateur",
] as const;

/**
 * La requête, écrite une seule fois et partagée par
 * `scripts/controle-cloisonnement.mts` (base hébergée) et par
 * `tests/isolation/force-rls.test.ts` (base jetable).
 *
 * `relkind IN ('r','p')` retient les tables ordinaires ET partitionnées ;
 * `NOT relispartition` écarte les partitions, qui relèvent du contrôle dédié.
 * `_prisma_migrations` est la table de Prisma, hors périmètre de I1 : elle ne
 * porte aucune donnée métier et n'est jamais lue par l'application.
 */
export const SQL_ETAT_RLS = `
  SELECT "c"."relname"::text       AS "table",
         "c"."relrowsecurity"      AS "activee",
         "c"."relforcerowsecurity" AS "forcee"
    FROM "pg_catalog"."pg_class" "c"
    JOIN "pg_catalog"."pg_namespace" "n" ON "n"."oid" = "c"."relnamespace"
   WHERE "n"."nspname" = 'public'
     AND "c"."relkind" IN ('r', 'p')
     AND NOT "c"."relispartition"
     AND "c"."relname" <> '_prisma_migrations'
   ORDER BY "c"."relname"
`;

/** L'état déclaré d'une table. */
export type EtatRlsTable = {
  table: string;
  activee: boolean;
  forcee: boolean;
};

/**
 * Écarts entre l'état déclaré et ce que I1 exige — une liste vide est le seul
 * état acceptable.
 *
 * Quatre motifs, et le premier est le témoin :
 *   1. **aucune table observée** — la base est vide, ou `pg_class` a été lue
 *      ailleurs qu'on ne croit. Un contrôle qui n'a rien vu n'a rien prouvé ;
 *   2. une table cloisonnée dont un des DEUX drapeaux manque ;
 *   3. un référentiel de plateforme qui aurait gagné `FORCE` — le propriétaire
 *      ne pourrait plus l'amorcer — ou perdu `ENABLE` ;
 *   4. une table qui ne figure dans AUCUNE des trois listes, ou dont l'état
 *      contredit la liste où elle figure.
 */
export function ecartsRlsDeclaree(
  observees: readonly EtatRlsTable[],
  listes: {
    forcee?: readonly string[];
    simple?: readonly string[];
    sansRls?: readonly string[];
  } = {},
): string[] {
  if (observees.length === 0) {
    return [
      "aucune table observée dans le schéma « public » : le contrôle de l'état " +
        "déclaré de RLS n'a rien établi. Base vide, mauvaise base, ou requête " +
        "jouée hors du schéma attendu — un décompte nul ressemble beaucoup " +
        "trop à un sans-faute.",
    ];
  }

  const ecarts: string[] = [];
  // Les listes sont paramétrables pour un seul appelant : le harnais
  // d'isolation, qui crée en plus des tables FIXTURES « contrat »
  // (`client`, `site`, `machine`, `modele_materiel`) modelant les vraies tables
  // des lots 1 et 2. Elles portent délibérément les mêmes politiques que les
  // tables réelles — c'est tout leur objet —, mais elles n'existent pas au
  // schéma et n'ont donc rien à faire dans les listes de production. Aucun
  // autre appelant ne surcharge : le contrôle de la base hébergée juge sur les
  // listes de I1, et rien d'autre.
  const forcee: readonly string[] = listes.forcee ?? TABLES_RLS_FORCEE;
  const simple: readonly string[] = listes.simple ?? TABLES_RLS_SIMPLE;
  const sansRls: readonly string[] = listes.sansRls ?? TABLES_SANS_RLS;

  for (const etat of observees) {
    if (forcee.includes(etat.table)) {
      if (!etat.activee || !etat.forcee) {
        ecarts.push(
          `« ${etat.table} » est cloisonnée : sa RLS doit être ACTIVÉE et ` +
            `FORCÉE, elle est ${etat.activee ? "activée" : "NON activée"} et ` +
            `${etat.forcee ? "forcée" : "NON forcée"}. Les DEUX drapeaux ` +
            "comptent, et pour des raisons différentes : sans ENABLE, aucune " +
            "politique ne s'applique à personne ; sans FORCE, le PROPRIÉTAIRE " +
            "y échappe — donc les migrations, le seed et toute connexion de " +
            "maintenance, qui lisent alors toutes les sociétés. Mesuré : " +
            "FORCE retiré, le rôle applicatif ne voit toujours rien et le " +
            "propriétaire voit tout.",
        );
      }
      continue;
    }

    if (simple.includes(etat.table)) {
      if (!etat.activee) {
        ecarts.push(
          `le référentiel de plateforme « ${etat.table} » n'a plus de RLS ` +
            "activée : son écriture n'est plus réservée aux rôles éditeur (I1).",
        );
      }
      if (etat.forcee) {
        ecarts.push(
          `le référentiel de plateforme « ${etat.table} » a gagné FORCE ROW ` +
            "LEVEL SECURITY. Il ne doit PAS l'avoir (D4) : le propriétaire " +
            "doit pouvoir l'amorcer sans contexte société, et le seed échouerait.",
        );
      }
      continue;
    }

    if (sansRls.includes(etat.table)) {
      if (etat.activee || etat.forcee) {
        ecarts.push(
          `« ${etat.table} » relève des tables sans RLS (I1, catégories 3 et ` +
            "4) et en a pourtant gagné une. Si c'est délibéré, c'est un " +
            "arbitrage : la table change de catégorie, et les listes closes de " +
            "I1 avec elle.",
        );
      }
      continue;
    }

    ecarts.push(
      `« ${etat.table} » ne figure dans AUCUNE des trois listes d'état RLS ` +
        `(état observé : ${etat.activee ? "activée" : "non activée"}, ` +
        `${etat.forcee ? "forcée" : "non forcée"}). Une table nouvelle se ` +
        "range dans l'une des trois — cloisonnée, référentiel de plateforme, " +
        "ou technique sans RLS — et ce classement est celui de I1, pas une " +
        "décision de ticket.",
    );
  }

  return ecarts;
}

/** Rapport de journal — l'état déclaré, et ce qui s'en écarte. */
export function rapportRlsDeclaree(observees: readonly EtatRlsTable[]): string {
  const forcees = observees.filter(
    (etat) => etat.activee && etat.forcee,
  ).length;
  const simples = observees.filter(
    (etat) => etat.activee && !etat.forcee,
  ).length;

  return [
    "État déclaré de la sécurité au niveau des lignes (observé, non déclaré)",
    `  ${forcees} table(s) ENABLE+FORCE, ${simples} ENABLE seul, ` +
      `${observees.length - forcees - simples} sans RLS`,
    "",
  ].join("\n");
}

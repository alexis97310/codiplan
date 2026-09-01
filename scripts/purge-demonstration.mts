import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

/**
 * Purge des données de démonstration (workflow « DB migrate & seed »,
 * entrée `reinitialiser_demo`).
 *
 * RÉSERVÉ AUX DONNÉES DE DÉMONSTRATION. Ce script vide sans condition les
 * tables métier de la base : il n'a de sens que tant qu'elle ne contient que le
 * jeu de `prisma/seed.ts` (I9 — aucune donnée de production dans le dépôt, et à
 * ce stade aucune en base). Voir
 * docs/decisions/2026-08-20-purge-des-donnees-de-demonstration.md, qui fixe la
 * condition de retrait de cette option dès qu'une donnée réelle existera.
 *
 * Pourquoi il existe : le premier seed a écrit des sociétés dont l'identifiant
 * était tiré à l'écriture. Depuis `FORCE ROW LEVEL SECURITY`, la politique de
 * `societe` est `id = app.societe_id` : le seed doit connaître l'identifiant
 * AVANT d'écrire et porte donc des identifiants fixes (voir l'entête de
 * `prisma/seed-data.ts`). L'`upsert` par `id` ne retrouve plus les lignes
 * existantes et bute sur l'unicité de `code`. Aucun rapprochement automatique
 * n'est possible : une recherche par `code` serait elle-même filtrée par la
 * politique. Reprendre les données à zéro est la seule sortie — acceptable
 * pour un jeu de démonstration, jamais pour des données réelles.
 *
 * Pourquoi `TRUNCATE` et non des `delete` Prisma : sous `FORCE ROW LEVEL
 * SECURITY`, un `DELETE` du propriétaire est lui aussi filtré et ne toucherait
 * que les lignes de la société dont le contexte est posé — précisément les
 * identifiants que l'on ne connaît pas. `TRUNCATE` n'est pas soumis aux
 * politiques de ligne : il relève de la propriété de la table. Corollaire utile,
 * le rôle applicatif `codiplan_app` n'a pas ce droit et ne peut donc pas
 * exécuter ce script.
 *
 * ── CE QUI A CHANGÉ, ET POURQUOI CE N'ÉTAIT PAS UNE LIGNE À AJOUTER ─────────
 *
 * **Le script était cassé, et depuis L0-08.** Sa liste de tables était fermée à
 * la main et n'avait pas suivi les trois tables du calendrier. Mesuré :
 *
 *     ERROR:  cannot truncate a table referenced in a foreign key constraint
 *     DETAIL:  Table "calendrier_ferie" references "agence".
 *
 * L'échec était bruyant — le `TRUNCATE` est délibérément écrit sans `CASCADE`,
 * précisément pour cela —, donc l'option `reinitialiser_demo` était inopérante
 * plutôt que dangereuse. Mais c'est **la même maladie que I1, que le périmètre
 * d'audit et que les citations du backlog** : une liste d'admis tenue à la main
 * qu'une décision ultérieure laisse en arrière. La corriger d'une ligne l'aurait
 * recassée au module suivant, et cette fois peut-être sans bruit.
 *
 * **La liste est donc fermée par le SCHÉMA.** Le script énumère les tables de
 * `public` en base — pas une liste écrite ici — et purge tout, moins une liste
 * d'EXCEPTIONS. Un gardien statique échoue s'il existe une table du schéma que
 * le script ne purge ni n'exempte : le renversement de D41, appliqué à la purge.
 *
 * Sortie via `process.stdout.write` : `console.log` est banni (CLAUDE.md §5),
 * et ces lignes sont une sortie de journal délibérée.
 */

/** Motif pour lequel une table échappe à la purge. Liste close de deux. */
export type MotifException = "referentiel" | "survit";

/** Une table que la purge ne vide pas, et pourquoi. */
export type ExceptionPurge = {
  readonly table: string;
  readonly motif: MotifException;
  readonly justification: string;
};

/**
 * Les tables que la purge ÉPARGNE. C'est la seule chose encore tenue à la main,
 * donc la seule qui puisse dériver — et le gardien la confronte au schéma.
 *
 * Deux motifs, et ils ne disent pas la même chose :
 *   — `referentiel` : ce ne sont pas des données de démonstration. Les
 *     référentiels de plateforme relèvent de la liste close de I1, et le seed
 *     les réécrit de façon idempotente par leur clé naturelle. Les vider
 *     n'apporterait rien et casserait les clés étrangères qui les visent ;
 *   — `survit` : la table SURVIT délibérément à ce qu'elle décrit. C'est la
 *     propriété du journal d'audit, et c'est pourquoi aucune clé étrangère ne
 *     le retient aux tables métier. Le seed réécrit les mêmes identifiants
 *     fixes : les lignes d'audit se rattachent aux sociétés recréées, et le
 *     journal raconte la purge en creux — une création après une création, sans
 *     suppression entre les deux. C'est exact et lisible.
 */
export const EXCEPTIONS_PURGE: readonly ExceptionPurge[] = [
  {
    table: "devise",
    motif: "referentiel",
    justification:
      "Référentiel de plateforme (I1, liste close, D4). Le franc Pacifique " +
      "est le même partout : ce n'est pas une donnée de démonstration, et le " +
      "seed le réécrit par sa clé naturelle.",
  },
  {
    table: "parite",
    motif: "referentiel",
    justification:
      "Référentiel de plateforme (I1, D20, D41). La parité légale du franc " +
      "Pacifique n'appartient à aucune société de démonstration.",
  },
  {
    table: "jour_ferie",
    motif: "referentiel",
    justification:
      "Référentiel de plateforme (I1, D46). Le 14 juillet est un fait du " +
      "territoire, pas une donnée du jeu de démonstration. Son horizon " +
      "glissant est réécrit par le seed.",
  },
  {
    table: "journal_audit",
    motif: "survit",
    justification:
      "Le journal SURVIT à ce qu'il décrit — c'est sa propriété, et c'est " +
      "pourquoi aucune clé étrangère ne le retient aux tables métier. Le " +
      "vider effacerait l'histoire des purges précédentes, c'est-à-dire " +
      "exactement ce qu'on lui demande de garder.",
  },
  {
    table: "_prisma_migrations",
    motif: "survit",
    justification:
      "Table de Prisma, hors périmètre de I1. La vider ferait rejouer toutes " +
      "les migrations sur une base qui les porte déjà.",
  },
] as const;

/** Les noms des tables épargnées. */
export function tablesEpargnees(
  exceptions: readonly ExceptionPurge[] = EXCEPTIONS_PURGE,
): string[] {
  return exceptions.map((exception) => exception.table);
}

/**
 * Les tables à purger : celles du schéma, moins les exceptions.
 *
 * L'ORDRE N'IMPORTE PLUS, et c'est un effet du renversement : un `TRUNCATE` qui
 * nomme toutes les tables référençantes les vide en une seule instruction, quel
 * que soit l'ordre. L'ancienne liste devait être ordonnée « les référençantes
 * d'abord » ; c'était une contrainte de plus à tenir à la main, et elle disparaît.
 */
export function tablesAPurger(
  duSchema: readonly string[],
  exceptions: readonly ExceptionPurge[] = EXCEPTIONS_PURGE,
): string[] {
  const epargnees = tablesEpargnees(exceptions);
  return [...duSchema].filter((table) => !epargnees.includes(table)).sort();
}

/**
 * Écarts de la liste d'exceptions elle-même.
 *
 * Corollaire du 31/08 sur les sélections négatives : **une exception qui ne
 * s'applique à personne ne fait échouer personne.** Elle survit à la
 * disparition de sa table, ne protège plus rien, et la prochaine table qui
 * reprendra ce nom en héritera sans que personne ne le lui ait accordé.
 */
export function ecartsExceptions(
  duSchema: readonly string[],
  exceptions: readonly ExceptionPurge[] = EXCEPTIONS_PURGE,
): string[] {
  const ecarts: string[] = [];

  for (const exception of exceptions) {
    if (!duSchema.includes(exception.table)) {
      ecarts.push(
        `« ${exception.table} » est épargnée par la purge alors qu'elle ` +
          "n'existe pas au schéma. Une exception qui ne s'applique à personne " +
          "ne fait échouer personne : elle ne protège plus rien, et la " +
          "prochaine table qui reprendra ce nom en héritera sans que personne " +
          "ne le lui ait accordé.",
      );
    }
    if (exception.justification.trim().length === 0) {
      ecarts.push(
        `« ${exception.table} » est épargnée sans justification écrite. La ` +
          "purge est fermée par le schéma : une table est vidée SAUF si " +
          "quelqu'un écrit pourquoi non.",
      );
    }
  }

  const noms = tablesEpargnees(exceptions);
  if (new Set(noms).size !== noms.length) {
    ecarts.push(
      "une table est épargnée deux fois : deux justifications pour une même " +
        "table, et rien ne dit laquelle fait autorité.",
    );
  }

  return ecarts;
}

/**
 * La requête qui énumère les tables de `public`.
 *
 * Mêmes exclusions que `SQL_ETAT_RLS` : `relkind IN ('r','p')` retient les
 * tables ordinaires et partitionnées, `NOT relispartition` écarte les
 * partitions — `TRUNCATE` sur la table partitionnée les vide toutes, et les
 * nommer une à une échouerait sur celle qu'un script créera dans dix-huit mois.
 */
export const SQL_TABLES_PUBLIC = `
  SELECT "c"."relname"::text AS "table"
    FROM "pg_catalog"."pg_class" "c"
    JOIN "pg_catalog"."pg_namespace" "n" ON "n"."oid" = "c"."relnamespace"
   WHERE "n"."nspname" = 'public'
     AND "c"."relkind" IN ('r', 'p')
     AND NOT "c"."relispartition"
   ORDER BY "c"."relname"
`;

/** Confirmation explicite exigée du script lui-même : jamais d'exécution par défaut. */
export const VARIABLE_CONFIRMATION = "PURGE_DEMONSTRATION_CONFIRMEE";
export const VALEUR_CONFIRMATION = "oui";

/**
 * Construit la commande de purge à partir des tables OBSERVÉES en base.
 *
 * Toujours sans `CASCADE` : si une table venait à manquer à l'énumération, la
 * commande échoue bruyamment au lieu de vider en silence plus que prévu. La
 * différence avec l'ancienne version est qu'aucune table ne peut plus manquer
 * par oubli — seulement par exception écrite.
 */
export function instructionPurge(tables: readonly string[]): string {
  if (tables.length === 0) {
    throw new Error(
      "Aucune table à purger : la base est vide, ou l'énumération de `public` " +
        "n'a rien rendu. Un TRUNCATE sans cible ne prouverait rien.",
    );
  }
  return `TRUNCATE TABLE ${tables.map((table) => `"${table}"`).join(", ")}`;
}

/**
 * Seconde barrière, derrière le `if` du workflow : sans confirmation explicite,
 * le script s'arrête. Une exécution à la main, un copier-coller de commande ou
 * un futur appel malencontreux ne purgent rien.
 */
export function confirmationDonnee(
  environnement: Record<string, string | undefined>,
): boolean {
  return environnement[VARIABLE_CONFIRMATION] === VALEUR_CONFIRMATION;
}

/** Message de journal — la purge ne doit jamais passer inaperçue dans le journal. */
export function messagePurge(tables: readonly string[]): string {
  return [
    "── PURGE DES DONNÉES DE DÉMONSTRATION ────",
    "L'entrée `reinitialiser_demo` est activée : les données existantes sont",
    "effacées AVANT le seed. Cette option est réservée à une base ne contenant",
    "que des données de démonstration.",
    `Tables vidées (${tables.length}, énumérées EN BASE) : ${tables.join(", ")}.`,
    `Épargnées : ${tablesEpargnees().join(", ")}.`,
    "",
  ].join("\n");
}

async function purger(): Promise<void> {
  if (!confirmationDonnee(process.env)) {
    throw new Error(
      `Purge refusée : ${VARIABLE_CONFIRMATION} doit valoir « ${VALEUR_CONFIRMATION} ». ` +
        "Cette purge ne s'exécute jamais par défaut.",
    );
  }

  const prisma = new PrismaClient();
  try {
    const lignes =
      await prisma.$queryRawUnsafe<Array<{ table: string }>>(SQL_TABLES_PUBLIC);
    const duSchema = lignes.map((ligne) => ligne.table);

    // Les exceptions sont confrontées à la base AVANT de vider quoi que ce
    // soit : une exception qui ne s'adosse à rien épargnerait un fantôme.
    const ecarts = ecartsExceptions(duSchema);
    if (ecarts.length > 0) {
      throw new Error(
        "La liste d'exceptions de la purge ne s'accorde pas avec la base :\n" +
          ecarts.map((ecart) => `  — ${ecart}`).join("\n"),
      );
    }

    const tables = tablesAPurger(duSchema);
    process.stdout.write(messagePurge(tables));
    await prisma.$executeRawUnsafe(instructionPurge(tables));
    process.stdout.write("Purge effectuée.\n");
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Exécuté seulement en invocation directe (`tsx scripts/purge-demonstration.mts`) :
 * l'import du module par un test ne purge rien.
 */
const invoqueDirectement =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invoqueDirectement) {
  await purger();
}

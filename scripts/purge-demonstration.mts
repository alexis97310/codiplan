import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

/**
 * Purge des données de démonstration (workflow « DB migrate & seed »,
 * entrée `reinitialiser_demo`).
 *
 * RÉSERVÉ AUX DONNÉES DE DÉMONSTRATION. Ce script vide sans condition les
 * tables du socle multi-société : il n'a de sens que tant que la base ne
 * contient que le jeu de `prisma/seed.ts` (I9 — aucune donnée de production
 * dans le dépôt, et à ce stade aucune en base). Voir
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
 * Sortie via `process.stdout.write` : `console.log` est banni (CLAUDE.md §5),
 * et ces lignes sont une sortie de journal délibérée.
 */

/**
 * Tables vidées, **dans l'ordre des dépendances** : les tables référençantes
 * d'abord. `TRUNCATE` est volontairement écrit SANS `CASCADE` — si une table
 * future référence l'une de celles-ci sans figurer dans cette liste, la commande
 * échoue bruyamment au lieu de vider en silence plus que prévu.
 *
 * Les référentiels de plateforme `devise` et `parite` ne sont PAS purgés : ils
 * relèvent de la liste close de I1, ne sont pas des données de démonstration, et
 * le seed les réécrit de façon idempotente par leur clé naturelle.
 *
 * **`journal_audit` n'est pas purgé non plus** (L0-10), et pour une raison qui
 * n'est pas la même : le journal SURVIT à ce qu'il décrit — c'est sa propriété,
 * et c'est pourquoi aucune clé étrangère ne le retient à ces tables. Le
 * `TRUNCATE` ci-dessous n'échoue donc pas à cause de lui, et laisse derrière lui
 * l'historique des sociétés de démonstration. Le seed réécrit les mêmes
 * identifiants fixes : les lignes d'audit se rattachent aux sociétés recréées,
 * et le journal raconte alors la purge en creux — une création après une
 * création, sans suppression entre les deux. C'est exact et lisible.
 *
 * À noter, et c'est une limite connue plutôt qu'un défaut : un `TRUNCATE` ne
 * déclenche pas le journal, qui est `FOR EACH ROW`. La purge elle-même n'est
 * donc pas tracée. Elle est réservée au rôle propriétaire — `codiplan_app` n'a
 * pas ce droit — et à un jeu de démonstration ; voir l'en-tête de la migration
 * `20260829120000_journal_audit`.
 */
export const TABLES_DEMONSTRATION = [
  "utilisateur_client",
  "client",
  "utilisateur_societe",
  "agence",
  "societe",
  "utilisateur",
] as const;

/** Confirmation explicite exigée du script lui-même : jamais d'exécution par défaut. */
export const VARIABLE_CONFIRMATION = "PURGE_DEMONSTRATION_CONFIRMEE";
export const VALEUR_CONFIRMATION = "oui";

/** Construit la commande de purge. Aucune donnée extérieure n'y entre. */
export function instructionPurge(): string {
  const tables = TABLES_DEMONSTRATION.map((table) => `"${table}"`).join(", ");
  return `TRUNCATE TABLE ${tables}`;
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
export function messagePurge(): string {
  return [
    "── PURGE DES DONNÉES DE DÉMONSTRATION ────",
    "L'entrée `reinitialiser_demo` est activée : les données existantes sont",
    "effacées AVANT le seed. Cette option est réservée à une base ne contenant",
    "que des données de démonstration.",
    `Tables vidées : ${TABLES_DEMONSTRATION.join(", ")}.`,
    "Référentiels de plateforme conservés : devise, parite.",
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

  process.stdout.write(messagePurge());

  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(instructionPurge());
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

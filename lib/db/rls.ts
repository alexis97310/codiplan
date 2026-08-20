import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Contexte société pour la sécurité au niveau des lignes (I1, ticket L0-04).
 *
 * Les politiques RLS lisent la variable de session PostgreSQL `app.societe_id`
 * (voir `prisma/migrations/.../rls_policies`). Ce module est le point de passage
 * unique qui la positionne, pour que le filtre base de données morde sur les
 * requêtes applicatives passant par un rôle restreint.
 *
 * La variable est posée en `set_config(..., is_local => true)`, c'est-à-dire
 * portée à la transaction : elle est automatiquement remise à zéro au `COMMIT`
 * ou au `ROLLBACK`. Aucune fuite de contexte d'une requête à l'autre n'est donc
 * possible sur une connexion mutualisée — condition indispensable derrière un
 * pool.
 */

/** Nom de la variable de session lue par les politiques RLS. */
export const VARIABLE_SESSION_SOCIETE = "app.societe_id";

/** Client Prisma ou client de transaction — les deux exposent `$executeRawUnsafe`. */
type ClientPrisma = PrismaClient | Prisma.TransactionClient;

/**
 * Positionne `app.societe_id` sur la transaction courante.
 *
 * `set_config` est utilisé plutôt que `SET LOCAL` parce qu'il accepte un
 * paramètre lié ($1) : la valeur ne transite jamais par de la concaténation de
 * chaîne, ce qui ferme la porte à toute injection dans la variable de session.
 *
 * La variable de session reste du texte — c'est le type de `current_setting` —
 * et ce sont les politiques qui la convertissent en `uuid` (forme D4). Corollaire
 * pour toute requête brute écrite ailleurs : un identifiant passé en paramètre
 * lié part en `text` et doit être casté sur place (`$1::uuid`), les colonnes
 * d'identifiants étant typées `uuid` depuis la migration
 * `20260820140000_identifiants_uuid`.
 */
async function poserContexteSociete(
  tx: ClientPrisma,
  societeId: string,
): Promise<void> {
  await tx.$executeRawUnsafe(
    "SELECT set_config($1, $2, true)",
    VARIABLE_SESSION_SOCIETE,
    societeId,
  );
}

/**
 * Exécute `travail` dans une transaction dont le contexte société est positionné.
 *
 * Toute requête émise sur le client de transaction fourni est alors soumise aux
 * politiques RLS avec `app.societe_id = societeId`. La transaction interactive
 * garantit qu'un seul et même connexion porte le contexte et les requêtes.
 */
export function avecSociete<T>(
  prisma: PrismaClient,
  societeId: string,
  travail: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await poserContexteSociete(tx, societeId);
    return travail(tx);
  });
}

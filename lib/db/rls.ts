import type { Prisma, PrismaClient } from "@prisma/client";

import type { Role } from "@/lib/auth/roles";

/**
 * Contexte de session pour la sécurité au niveau des lignes (I1, tickets L0-04
 * et L0-06).
 *
 * Les politiques RLS lisent deux variables de session PostgreSQL :
 *   - `app.societe_id` — le cloisonnement société (L0-04, forme imposée D4) ;
 *   - `app.role` — le rôle tenu sur cette société, sans lequel l'écriture des
 *     référentiels de plateforme ne saurait être réservée aux rôles éditeur
 *     comme I1 l'exige (L0-06, fonction `app_est_role_editeur`).
 *
 * Ce module est le point de passage unique qui les positionne, pour que le
 * filtre base de données morde sur les requêtes applicatives passant par un
 * rôle restreint.
 *
 * Les variables sont posées en `set_config(..., is_local => true)`, c'est-à-dire
 * portées à la transaction : elles sont automatiquement remises à zéro au
 * `COMMIT` ou au `ROLLBACK`. Aucune fuite de contexte d'une requête à l'autre
 * n'est donc possible sur une connexion mutualisée — condition indispensable
 * derrière un pool.
 */

/** Nom de la variable de session portant la société active. */
export const VARIABLE_SESSION_SOCIETE = "app.societe_id";

/** Nom de la variable de session portant le rôle tenu sur cette société. */
export const VARIABLE_SESSION_ROLE = "app.role";

/** Client Prisma ou client de transaction — les deux exposent `$executeRawUnsafe`. */
type ClientPrisma = PrismaClient | Prisma.TransactionClient;

/**
 * Positionne `app.societe_id` et `app.role` sur la transaction courante.
 *
 * `set_config` est utilisé plutôt que `SET LOCAL` parce qu'il accepte un
 * paramètre lié ($1) : la valeur ne transite jamais par de la concaténation de
 * chaîne, ce qui ferme la porte à toute injection dans la variable de session.
 *
 * Les variables de session restent du texte — c'est le type de
 * `current_setting` — et ce sont les politiques et la fonction `app_role()` qui
 * les convertissent en `uuid` et en `"Role"` (forme D4). Corollaire pour toute
 * requête brute écrite ailleurs : un identifiant passé en paramètre lié part en
 * `text` et doit être casté sur place (`$1::uuid`), les colonnes d'identifiants
 * étant typées `uuid` depuis la migration `20260820140000_identifiants_uuid`.
 *
 * Un rôle absent est posé à la chaîne vide, que `NULLIF` ramène à `NULL` : le
 * contexte est alors « société sans rôle », qui lit mais n'écrit aucun
 * référentiel de plateforme.
 */
async function poserContexte(
  tx: ClientPrisma,
  societeId: string,
  role: Role | null,
): Promise<void> {
  await tx.$executeRawUnsafe(
    "SELECT set_config($1, $2, true)",
    VARIABLE_SESSION_SOCIETE,
    societeId,
  );
  await tx.$executeRawUnsafe(
    "SELECT set_config($1, $2, true)",
    VARIABLE_SESSION_ROLE,
    role ?? "",
  );
}

/**
 * Les délais d'une transaction interactive, en millisecondes.
 *
 * Les noms sont ceux de Prisma, délibérément : ce type ne traduit rien, il
 * rend seulement EXPLICITE ce que `$transaction` accepte déjà. Une traduction
 * française aurait ajouté une couche à relire pour retrouver, en dessous, la
 * documentation de Prisma.
 *
 *   - `maxWait` — attente maximale pour obtenir une connexion avant que la
 *     transaction ne commence. Défaut Prisma : 2 000 ms.
 *   - `timeout` — durée maximale de la transaction elle-même, du `BEGIN` au
 *     `COMMIT`. Défaut Prisma : 5 000 ms.
 *
 * **Ces deux défauts sont des valeurs de RÉSEAU LOCAL.** Ils tiennent tant
 * qu'un aller-retour coûte une milliseconde ; ils ne tiennent plus dès que la
 * base est à Sydney et l'appelant ailleurs. Un chemin qui enchaîne beaucoup
 * d'écritures dans une seule transaction doit donc les fixer lui-même — c'est
 * le cas du seed, voir `prisma/seed-delais.ts`.
 */
export type DelaisTransaction = {
  maxWait: number;
  timeout: number;
};

/**
 * Exécute `travail` dans une transaction portant société ET rôle.
 *
 * Toute requête émise sur le client de transaction fourni est alors soumise aux
 * politiques RLS avec `app.societe_id = societeId` et `app.role = role`. La
 * transaction interactive garantit qu'une seule et même connexion porte le
 * contexte et les requêtes.
 *
 * `delais` est facultatif : omis, les défauts de Prisma s'appliquent, ce qui
 * convient aux chemins de session — une requête applicative, servie depuis le
 * même continent que la base, fait deux ou trois allers-retours. Le préciser
 * est réservé aux chemins d'amorçage, longs et distants.
 */
export function avecSocieteEtRole<T>(
  prisma: PrismaClient,
  societeId: string,
  role: Role | null,
  travail: (tx: Prisma.TransactionClient) => Promise<T>,
  delais?: DelaisTransaction,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await poserContexte(tx, societeId, role);
    return travail(tx);
  }, delais);
}

/**
 * Variante sans rôle, pour les chemins qui n'en ont pas : le seed et le
 * contrôle de cloisonnement, qui écrivent le socle sous le rôle propriétaire.
 * Un chemin de session passe toujours par `avecSocieteEtRole`.
 */
export function avecSociete<T>(
  prisma: PrismaClient,
  societeId: string,
  travail: (tx: Prisma.TransactionClient) => Promise<T>,
  delais?: DelaisTransaction,
): Promise<T> {
  return avecSocieteEtRole(prisma, societeId, null, travail, delais);
}

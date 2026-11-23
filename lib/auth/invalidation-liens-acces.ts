import type { PrismaClient } from "@prisma/client";

/**
 * INVALIDER LES LIENS D'ACCÈS ANTÉRIEURS (D281, 24/11/2026,
 * 9L35-LIENS-ACCES-ANCIENS-ANNULES) — ferme le point 3 laissé ouvert par
 * D266 (9L09-SESSIONS-FERMEES-REINITIALISATION, 10/11/2026) : décision
 * d'Alexis du 23/11/2026 (séance de décisions, point 5), « anciens liens
 * d'accès : annulés à l'envoi d'un nouveau ».
 *
 * **Le préfixe, c'est le périmètre.** `reset-password:` est celui que Better
 * Auth pose pour tout jeton de premier accès / mot de passe oublié (mesuré,
 * `node_modules/better-auth/dist/api/routes/password.mjs`,
 * `identifier: \`reset-password:${token}\``, `value: user.id`) — jamais pour
 * un défi de second facteur ni une confiance d'appareil, qui portent d'autres
 * préfixes. `identifiantLienAcces` ci-dessous construit la MÊME chaîne, à
 * partir du jeton que `sendResetPassword` (`lib/auth/config.ts`) vient de
 * rendre : c'est ELLE qui désigne, à l'appelant, le lien qu'il vient d'émettre
 * et qu'il faut conserver.
 *
 * **Pourquoi une fonction SECURITY DEFINER** (migration
 * `20261124080000_invalider_liens_anterieurs_9l35`) : la table `verification`
 * n'est cloisonnée QUE par désignation sur `identifiant` (L1-02d) — une chaîne
 * aléatoire que l'émetteur d'un nouveau lien ne connaît jamais pour les liens
 * ANTÉRIEURS. Il n'existe donc aucun moyen, sous les politiques existantes, de
 * retrouver « les jetons antérieurs de CE compte » : la fonction lit par
 * `valeur` (`utilisateur.id`, posé par Better Auth), colonne qu'aucune
 * politique n'admet.
 *
 * **Ce que cette fonction NE revérifie PAS** : l'habilitation à agir sur ce
 * compte. Les quatre chemins qui appellent `invaliderLiensAnterieurs`
 * ci-dessous (`preparerLienDAcces`, `inviterClientAuPortail`, et les deux
 * gestes d'amorçage) ont chacun déjà tranché CETTE question avant d'émettre
 * le jeton — D226/D247 inchangés. La fonction ne reçoit qu'un identifiant de
 * compte et ne peut agir que sur les lignes de CE compte : la portée d'un
 * appel mal autorisé reste bornée à l'identité déjà visée par le geste qui
 * l'a précédé, jamais élargie par cette fonction elle-même.
 */

/** Le préfixe que Better Auth pose pour tout jeton de premier accès. */
export const PREFIXE_LIEN_ACCES = "reset-password:";

/** Le même identifiant que celui que `verification.identifiant` porte. */
export function identifiantLienAcces(jeton: string): string {
  return `${PREFIXE_LIEN_ACCES}${jeton}`;
}

/**
 * Supprime les liens de premier accès antérieurs, non consommés, du MÊME
 * compte — appelée une fois un nouveau jeton émis, `identifiantAConserver`
 * désignant CE nouveau jeton (voir `identifiantLienAcces`), jamais touché.
 *
 * Un seul appel SQL, atomique par construction (une instruction). Aucune
 * lecture préalable n'est nécessaire : un compte qui n'a aucun lien antérieur
 * laisse la suppression sans effet.
 */
export async function invaliderLiensAnterieurs(
  client: PrismaClient,
  utilisateurId: string,
  identifiantAConserver: string,
): Promise<void> {
  await client.$executeRaw`SELECT "app_invalider_liens_anterieurs"(${utilisateurId}::uuid, ${identifiantAConserver})`;
}

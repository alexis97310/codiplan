import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Contrôle au démarrage du rôle de connexion applicatif (I1, correction de
 * revue L0-04).
 *
 * `FORCE ROW LEVEL SECURITY` soumet le propriétaire des tables aux politiques,
 * mais trois attributs de rôle continuent de les contourner sans appel :
 * `SUPERUSER`, `BYPASSRLS`, et — via la propriété des objets — l'appartenance
 * au rôle propriétaire de la base. Un service qui se connecterait ainsi
 * n'aurait aucun filet base de données, quand bien même les politiques seraient
 * parfaitement écrites.
 *
 * Ce module refuse donc la connexion applicative dans ces trois cas. Il est
 * délibérément placé hors du chemin des migrations et du seed : ceux-là
 * CONSERVENT le rôle propriétaire (voir `prisma/seed.ts`, qui instancie son
 * propre client), c'est leur travail.
 */

/** Client Prisma ou client de transaction — les deux exposent `$queryRawUnsafe`. */
type ClientPrisma = PrismaClient | Prisma.TransactionClient;

/** État du rôle de connexion, tel que la base le rapporte. */
export type DiagnosticRole = {
  /** Rôle effectivement connecté (`current_user`). */
  role: string;
  /** Base courante, pour que le message d'erreur soit exploitable. */
  base: string;
  /** Le rôle est superutilisateur : il ignore toute politique. */
  superutilisateur: boolean;
  /** Le rôle porte l'attribut `BYPASSRLS`. */
  contourne_rls: boolean;
  /** Le rôle est propriétaire de la base, ou membre du rôle propriétaire. */
  proprietaire_base: boolean;
};

/**
 * Motif de refus, ou `null` si le rôle est acceptable.
 *
 * Fonction pure, sans base : c'est elle que teste `tests/unit/db/garde-role`.
 */
export function motifRefus(diagnostic: DiagnosticRole): string | null {
  const entete =
    `Le rôle « ${diagnostic.role} » ne peut pas servir de rôle applicatif ` +
    `sur la base « ${diagnostic.base} » : `;
  const remede =
    " Se connecter avec le rôle applicatif non propriétaire (codiplan_app) ; " +
    "le rôle propriétaire reste réservé aux migrations et au seed. " +
    "Voir docs/decisions/2026-08-20-role-applicatif-et-force-rls.md.";

  if (diagnostic.proprietaire_base) {
    return `${entete}il est propriétaire de la base, il possède donc les tables et les politiques de cloisonnement ne mordent pas sur lui.${remede}`;
  }
  if (diagnostic.superutilisateur) {
    return `${entete}il est superutilisateur, et un superutilisateur ignore toute politique de sécurité au niveau des lignes.${remede}`;
  }
  if (diagnostic.contourne_rls) {
    return `${entete}il porte l'attribut BYPASSRLS, qui contourne toute politique de sécurité au niveau des lignes.${remede}`;
  }
  return null;
}

/** Interroge la base sur le rôle courant et sa capacité à contourner RLS. */
export async function diagnostiquerRole(
  client: ClientPrisma,
): Promise<DiagnosticRole> {
  // `pg_has_role(..., 'MEMBER')` est plus strict que 'USAGE' : il répond vrai
  // même pour une appartenance NOINHERIT, laquelle suffit à reprendre les
  // droits du propriétaire par un simple `SET ROLE`.
  const lignes = await client.$queryRawUnsafe<DiagnosticRole[]>(`
    SELECT
      current_user::text AS "role",
      current_database()::text AS "base",
      r."rolsuper" AS "superutilisateur",
      r."rolbypassrls" AS "contourne_rls",
      pg_catalog.pg_has_role(current_user, d."datdba", 'MEMBER') AS "proprietaire_base"
    FROM pg_catalog.pg_database d
    JOIN pg_catalog.pg_roles r ON r."rolname" = current_user
    WHERE d."datname" = current_database()
  `);

  const diagnostic = lignes[0];
  if (diagnostic === undefined) {
    throw new Error(
      "Impossible de déterminer le rôle de connexion : la base n'a renvoyé " +
        "aucune ligne pour `current_user`. Connexion applicative refusée.",
    );
  }
  return diagnostic;
}

/**
 * Vérifie le rôle courant et lève si la connexion ne doit pas être utilisée.
 * Renvoie le diagnostic quand tout va bien, pour que l'appelant puisse le tracer.
 */
export async function verifierRoleApplicatif(
  client: ClientPrisma,
): Promise<DiagnosticRole> {
  const diagnostic = await diagnostiquerRole(client);
  const motif = motifRefus(diagnostic);
  if (motif !== null) {
    throw new Error(motif);
  }
  return diagnostic;
}

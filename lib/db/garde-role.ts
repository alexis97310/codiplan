import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Contrôle du rôle de connexion — DEUX usages, DEUX gardes (I1 ; D21 ; ticket
 * L0-06).
 *
 * `FORCE ROW LEVEL SECURITY` soumet le propriétaire des tables aux politiques,
 * mais trois attributs de rôle continuent de les contourner sans appel :
 * `SUPERUSER`, `BYPASSRLS`, et — via la propriété des objets — l'appartenance
 * au rôle propriétaire de la base.
 *
 * Ce module refusait jusqu'ici toute connexion portant l'un des trois. C'était
 * juste tant qu'il n'existait qu'une connexion. D21 en introduit une seconde :
 * `codiplan_reporting`, qui doit **précisément** contourner les politiques pour
 * consolider plusieurs sociétés. Un garde qui jugerait sur le seul attribut
 * `BYPASSRLS` aurait alors deux issues, toutes deux mauvaises : refuser la
 * consolidation, ou l'autoriser en ouvrant la même porte à l'application.
 *
 * **Le garde ne juge donc pas l'attribut, il juge l'usage.** Deux fonctions,
 * deux jeux d'exigences, sur deux connexions distinctes :
 *
 * | Usage | `BYPASSRLS` | Superutilisateur | Propriétaire | Écriture |
 * |---|---|---|---|---|
 * | applicatif (`codiplan_app`) | **interdit** | interdit | interdit | permise |
 * | consolidation (`codiplan_reporting`) | **exigé** | interdit | interdit | **interdite** |
 *
 * L'usage applicatif est celui de toute l'application ; l'usage consolidation
 * n'est ouvert que par `lib/reporting`, et un test le vérifie. Les migrations et
 * le seed, eux, restent hors du chemin des deux gardes : ils CONSERVENT le rôle
 * propriétaire, c'est leur travail.
 *
 * Voir docs/decisions/2026-08-20-authentification-et-deux-connexions.md.
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
 * Diagnostic enrichi de l'usage consolidation. La capacité d'écriture n'a pas
 * de sens pour l'usage applicatif — qui écrit, évidemment — mais elle est
 * disqualifiante pour la consolidation, à laquelle D21 n'accorde que `SELECT`.
 */
export type DiagnosticRoleReporting = DiagnosticRole & {
  /** Le rôle détient INSERT, UPDATE, DELETE ou TRUNCATE sur au moins une table. */
  ecriture_possible: boolean;
};

const REMEDE_APPLICATIF =
  " Se connecter avec le rôle applicatif non propriétaire (codiplan_app) ; " +
  "le rôle propriétaire reste réservé aux migrations et au seed. " +
  "Voir docs/decisions/2026-08-20-role-applicatif-et-force-rls.md.";

const REMEDE_REPORTING =
  " Se connecter avec le rôle de consolidation (codiplan_reporting), créé par " +
  "la migration 20260820150000_authentification_et_roles : BYPASSRLS, SELECT " +
  "seul, aucune table de données personnelles. " +
  "Voir docs/decisions/2026-08-20-authentification-et-deux-connexions.md.";

function entete(diagnostic: DiagnosticRole, usage: string): string {
  return (
    `Le rôle « ${diagnostic.role} » ne peut pas servir de rôle ${usage} ` +
    `sur la base « ${diagnostic.base} » : `
  );
}

/**
 * Motif de refus de la connexion APPLICATIVE, ou `null` si le rôle convient.
 *
 * Fonction pure, sans base : c'est elle que teste `tests/unit/db/garde-role`.
 */
export function motifRefusApplicatif(
  diagnostic: DiagnosticRole,
): string | null {
  const debut = entete(diagnostic, "applicatif");

  if (diagnostic.proprietaire_base) {
    return `${debut}il est propriétaire de la base, il possède donc les tables et les politiques de cloisonnement ne mordent pas sur lui.${REMEDE_APPLICATIF}`;
  }
  if (diagnostic.superutilisateur) {
    return `${debut}il est superutilisateur, et un superutilisateur ignore toute politique de sécurité au niveau des lignes.${REMEDE_APPLICATIF}`;
  }
  if (diagnostic.contourne_rls) {
    return `${debut}il porte l'attribut BYPASSRLS, qui contourne toute politique de sécurité au niveau des lignes.${REMEDE_APPLICATIF}`;
  }
  return null;
}

/**
 * Motif de refus de la connexion de CONSOLIDATION, ou `null` si le rôle convient.
 *
 * Symétrique du précédent, et non son contraire : `BYPASSRLS` y est exigé
 * plutôt qu'interdit, mais le reste se durcit. Un rôle propriétaire ou
 * superutilisateur reste refusé — ils apporteraient bien plus que la lecture
 * transversale voulue —, et tout droit d'écriture disqualifie, D21 n'accordant
 * que `SELECT`.
 */
export function motifRefusReporting(
  diagnostic: DiagnosticRoleReporting,
): string | null {
  const debut = entete(diagnostic, "de consolidation");

  if (diagnostic.proprietaire_base) {
    return `${debut}il est propriétaire de la base, il pourrait donc écrire et modifier le schéma, quand la consolidation ne demande que la lecture.${REMEDE_REPORTING}`;
  }
  if (diagnostic.superutilisateur) {
    return `${debut}il est superutilisateur, ce qui excède de très loin la lecture transversale attendue.${REMEDE_REPORTING}`;
  }
  if (!diagnostic.contourne_rls) {
    return `${debut}il ne porte pas l'attribut BYPASSRLS, sans lequel la consolidation multi-sociétés ne lirait que la société active — un agrégat silencieusement tronqué. Poser « ALTER ROLE ${diagnostic.role} BYPASSRLS » avec un rôle qui le peut.${REMEDE_REPORTING}`;
  }
  if (diagnostic.ecriture_possible) {
    return `${debut}il détient un droit d'écriture sur au moins une table, alors que D21 ne lui accorde que SELECT. Un rôle capable d'écrire ET de contourner les politiques serait une porte dérobée.${REMEDE_REPORTING}`;
  }
  return null;
}

/** Fragment commun aux deux diagnostics — attributs du rôle connecté. */
const SELECTION_ATTRIBUTS = `
  current_user::text AS "role",
  current_database()::text AS "base",
  r."rolsuper" AS "superutilisateur",
  r."rolbypassrls" AS "contourne_rls",
  pg_catalog.pg_has_role(current_user, d."datdba", 'MEMBER') AS "proprietaire_base"
`;

const DEPUIS_CATALOGUE = `
  FROM pg_catalog.pg_database d
  JOIN pg_catalog.pg_roles r ON r."rolname" = current_user
  WHERE d."datname" = current_database()
`;

/**
 * Vrai dès qu'un droit d'écriture existe sur une table utilisateur, quelle que
 * soit la façon dont il a été accordé — nommément, via `PUBLIC`, ou par
 * appartenance à un autre rôle. `has_table_privilege` répond sur les droits
 * EFFECTIFS, là où `information_schema` ne montre que les octrois visibles.
 */
const ECRITURE_POSSIBLE = `
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n."oid" = c."relnamespace"
    WHERE c."relkind" IN ('r', 'p', 'v', 'm', 'f')
      AND n."nspname" NOT IN ('pg_catalog', 'information_schema')
      AND (
        pg_catalog.has_table_privilege(current_user, c."oid", 'INSERT')
        OR pg_catalog.has_table_privilege(current_user, c."oid", 'UPDATE')
        OR pg_catalog.has_table_privilege(current_user, c."oid", 'DELETE')
        OR pg_catalog.has_table_privilege(current_user, c."oid", 'TRUNCATE')
      )
  ) AS "ecriture_possible"
`;

function premiereLigne<T>(lignes: T[]): T {
  const ligne = lignes[0];
  if (ligne === undefined) {
    throw new Error(
      "Impossible de déterminer le rôle de connexion : la base n'a renvoyé " +
        "aucune ligne pour `current_user`. Connexion refusée.",
    );
  }
  return ligne;
}

/** Interroge la base sur le rôle courant et sa capacité à contourner RLS. */
export async function diagnostiquerRole(
  client: ClientPrisma,
): Promise<DiagnosticRole> {
  // `pg_has_role(..., 'MEMBER')` est plus strict que 'USAGE' : il répond vrai
  // même pour une appartenance NOINHERIT, laquelle suffit à reprendre les
  // droits du propriétaire par un simple `SET ROLE`.
  const lignes = await client.$queryRawUnsafe<DiagnosticRole[]>(
    `SELECT ${SELECTION_ATTRIBUTS} ${DEPUIS_CATALOGUE}`,
  );
  return premiereLigne(lignes);
}

/** Même diagnostic, augmenté de la capacité d'écriture (usage consolidation). */
export async function diagnostiquerRoleReporting(
  client: ClientPrisma,
): Promise<DiagnosticRoleReporting> {
  const lignes = await client.$queryRawUnsafe<DiagnosticRoleReporting[]>(
    `SELECT ${SELECTION_ATTRIBUTS}, ${ECRITURE_POSSIBLE} ${DEPUIS_CATALOGUE}`,
  );
  return premiereLigne(lignes);
}

/**
 * Vérifie le rôle courant pour l'usage APPLICATIF et lève si la connexion ne
 * doit pas être utilisée. Renvoie le diagnostic quand tout va bien, pour que
 * l'appelant puisse le tracer.
 */
export async function verifierRoleApplicatif(
  client: ClientPrisma,
): Promise<DiagnosticRole> {
  const diagnostic = await diagnostiquerRole(client);
  const motif = motifRefusApplicatif(diagnostic);
  if (motif !== null) {
    throw new Error(motif);
  }
  return diagnostic;
}

/** Idem pour l'usage CONSOLIDATION — exigences inverses sur `BYPASSRLS`. */
export async function verifierRoleReporting(
  client: ClientPrisma,
): Promise<DiagnosticRoleReporting> {
  const diagnostic = await diagnostiquerRoleReporting(client);
  const motif = motifRefusReporting(diagnostic);
  if (motif !== null) {
    throw new Error(motif);
  }
  return diagnostic;
}

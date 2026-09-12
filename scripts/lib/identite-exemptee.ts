import type { Prisma } from "@prisma/client";

import {
  TABLES_CLOISONNEES,
  TABLES_HORS_CLOISONNEMENT,
  type IdentiteInventaire,
} from "./inventaire";

/**
 * PRENDRE UNE IDENTITÉ EXEMPTÉE DES POLITIQUES — une seule lecture (N1).
 *
 * ## POURQUOI CE MODULE EXISTE, ET POURQUOI IL N'A PAS ÉTÉ RECOPIÉ
 *
 * `FORCE ROW LEVEL SECURITY` s'applique au PROPRIÉTAIRE des tables : une
 * migration qui lit une table cloisonnée sans contexte voit **zéro ligne**, et
 * *ne se trompe pas — elle ne regarde rien* (§9, 07/09). Tout contrôle qui
 * compte des lignes sur la base hébergée doit donc prendre une identité
 * exemptée, et **refuser de conclure** s'il n'y parvient pas.
 *
 * Ce raisonnement était écrit une fois, dans `scripts/inventaire.mts`. Le
 * refus automatique de N1 en a besoin **exactement de la même manière** — il
 * compte les sociétés —, et l'écrire une seconde fois aurait posé deux lectures
 * d'un même critère, *chacune juste sur sa propre lecture, le trou vivant dans
 * l'espace entre les deux, que personne n'habite* (§9, 01/09). Le code est
 * **déplacé, jamais dupliqué** : l'inventaire l'importe désormais d'ici.
 *
 * Purement lecture. Aucun `ALTER TABLE`, aucune levée de `FORCE`, aucune
 * écriture : les invariants ne sont assouplis à aucun moment, pas même le temps
 * d'une transaction. Le `SET LOCAL ROLE` ne modifie rien en base et meurt avec
 * elle.
 */

type ContexteRole = { role: string; base: string; exempte: boolean };

export function messageAucuneIdentiteExemptee(
  contexte: ContexteRole,
  exemptesSansLecture: readonly string[],
): string {
  const cause =
    exemptesSansLecture.length > 0
      ? "Des rôles exemptés lui sont bien accessibles — " +
        `${exemptesSansLecture.join(", ")} — mais aucun n'a le droit de LIRE ` +
        "les tables : l'exemption de politique ne remplace pas un GRANT SELECT."
      : "Aucun rôle exempté (SUPERUSER ou BYPASSRLS) ne lui est accessible.";

  return (
    `Inventaire impossible : le rôle « ${contexte.role} » sur la base ` +
    `« ${contexte.base} » est soumis aux politiques de cloisonnement.\n` +
    `${cause}\n` +
    "Les quatre tables cloisonnées portent FORCE ROW LEVEL SECURITY : leur " +
    "propriétaire y est soumis comme les autres. Un décompte pris malgré tout " +
    "serait filtré, donc faux — cette étape refuse de le publier.\n" +
    "Remède : alimenter MIGRATION_DATABASE_URL avec un rôle exempté des " +
    "politiques ET habilité à lire les tables, ou membre d'un tel rôle. Voir " +
    "docs/decisions/2026-08-20-inventaire-et-controle-de-cloisonnement.md."
  );
}

export function messageDecompteFiltre(identite: IdentiteInventaire): string {
  return (
    `Inventaire impossible : PostgreSQL a refusé une lecture non filtrée sous ` +
    `l'identité « ${identite.identite_exemptee} » (rôle connecté ` +
    `« ${identite.role_connecte} », base « ${identite.base} »).\n` +
    "C'est le filet `row_security = off` qui a joué : cette identité est " +
    "finalement soumise à au moins une politique, le décompte aurait donc été " +
    "filtré. Aucun inventaire n'est publié."
  );
}

/**
 * Prend, pour la durée de la transaction, une identité exemptée des politiques.
 * Lève si aucune n'est accessible.
 */
export async function prendreIdentiteExemptee(
  tx: Prisma.TransactionClient,
): Promise<IdentiteInventaire> {
  const contextes = await tx.$queryRawUnsafe<ContexteRole[]>(`
    SELECT
      current_user::text AS "role",
      current_database()::text AS "base",
      (r."rolsuper" OR r."rolbypassrls") AS "exempte"
    FROM pg_catalog.pg_roles r
    WHERE r."rolname" = current_user
  `);

  const contexte = contextes[0];
  if (contexte === undefined) {
    throw new Error(
      "Impossible de déterminer le rôle de connexion : la base n'a renvoyé " +
        "aucune ligne pour `current_user`.",
    );
  }

  if (contexte.exempte) {
    return {
      role_connecte: contexte.role,
      identite_exemptee: contexte.role,
      base: contexte.base,
    };
  }

  // `pg_has_role(..., 'MEMBER')` retient aussi les appartenances NOINHERIT :
  // un `SET ROLE` suffit à les prendre, l'héritage n'est pas requis. Les
  // attributs de rôle (SUPERUSER, BYPASSRLS) ne s'héritent PAS par
  // appartenance — seul `SET ROLE` les met en jeu, d'où cette bascule.
  //
  // Un candidat doit AUSSI pouvoir lire : l'exemption de politique et le droit
  // SELECT sont deux choses distinctes, et un rôle BYPASSRLS qui ne possède pas
  // les tables n'a aucun droit dessus par défaut. Retenir un tel rôle
  // échangerait un décompte filtré contre un « permission denied » — un progrès
  // nul. Les noms de tables viennent des listes littérales du module partagé.
  const tables = [...TABLES_CLOISONNEES, ...TABLES_HORS_CLOISONNEMENT]
    .map((table) => `('${table}')`)
    .join(", ");

  const candidats = await tx.$queryRawUnsafe<
    Array<{ role: string; lit_tout: boolean }>
  >(`
    SELECT
      r."rolname"::text AS "role",
      NOT EXISTS (
        SELECT 1
        FROM (VALUES ${tables}) AS t("nom")
        WHERE NOT pg_catalog.has_table_privilege(
          r."oid", format('public.%I', t."nom"), 'SELECT'
        )
      ) AS "lit_tout"
    FROM pg_catalog.pg_roles r
    WHERE (r."rolsuper" OR r."rolbypassrls")
      AND r."rolname" <> current_user
      AND pg_catalog.pg_has_role(current_user, r."oid", 'MEMBER')
    ORDER BY r."rolsuper" DESC, r."rolname"
  `);

  const candidat = candidats.find((role) => role.lit_tout);
  if (candidat === undefined) {
    throw new Error(
      messageAucuneIdentiteExemptee(
        contexte,
        candidats.map((role) => role.role),
      ),
    );
  }

  // Nom issu du catalogue système, jamais d'une entrée extérieure ; échappé
  // malgré tout, `SET ROLE` n'acceptant pas de paramètre lié.
  const nom = candidat.role.replace(/"/g, '""');
  await tx.$executeRawUnsafe(`SET LOCAL ROLE "${nom}"`);

  return {
    role_connecte: contexte.role,
    identite_exemptee: candidat.role,
    base: contexte.base,
  };
}

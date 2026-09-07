import { EvenementAcces, PrismaClient } from "@prisma/client";

import { avecDesignationAuth } from "@/lib/auth/lecture-identite";
import type { Role } from "@/lib/auth/roles";
import { prisma as clientApplicatif } from "@/lib/db/client";
import { verifierRoleReporting } from "@/lib/db/garde-role";
import { uuidv7 } from "@/lib/db/uuid";

/**
 * Connexion de consolidation multi-sociétés (arbitrage D21, ticket L0-06).
 *
 * **Ce module est réservé à `lib/reporting`.** C'est la seule connexion du dépôt
 * qui contourne les politiques de cloisonnement, et elle le fait pour une raison
 * précise : consolider plusieurs sociétés est, par définition, lire au-dessus
 * d'elles. Partout ailleurs, le contournement serait une porte dérobée. Le test
 * `tests/unit/reporting/connexion-reservee.test.ts` parcourt le dépôt et échoue
 * si un fichier hors de `lib/reporting/` importe ce module ou nomme sa variable
 * d'environnement.
 *
 * Les trois garde-fous de D21 sont tenus ici et dans la migration
 * `20260820150000_authentification_et_roles` :
 *   1. `SELECT` seul, sur aucune table de données personnelles — la migration
 *      accorde nommément, et `verifierRoleReporting` refuse la connexion si le
 *      rôle détient le moindre droit d'écriture ;
 *   2. toute requête est journalisée avec l'utilisateur d'origine — c'est
 *      `avecConsolidation` qui l'écrit, sur la connexion APPLICATIVE : le rôle
 *      de consolidation, lui, ne sait qu'écrire… rien ;
 *   3. le rôle est distinct de `codiplan_app` et porte son propre garde.
 */

/** Variable d'environnement portant l'URL du rôle `codiplan_reporting`. */
export const VARIABLE_URL_CONSOLIDATION = "REPORTING_DATABASE_URL";

const global = globalThis as unknown as {
  prismaConsolidation: PrismaClient | undefined;
  controleRoleConsolidation: Promise<void> | undefined;
};

function urlConsolidation(): string {
  const url = process.env[VARIABLE_URL_CONSOLIDATION];
  if (url === undefined || url === "") {
    throw new Error(
      `${VARIABLE_URL_CONSOLIDATION} n'est pas renseignée : la consolidation ` +
        "multi-sociétés exige sa propre connexion, avec le rôle " +
        "codiplan_reporting (D21). La réutilisation de DATABASE_URL est " +
        "refusée — ce serait rendre l'application capable de contourner le " +
        "cloisonnement.",
    );
  }
  return url;
}

/**
 * Client Prisma de consolidation. Instancié à la demande : un déploiement qui
 * n'utilise pas le reporting n'ouvre jamais cette connexion.
 */
export function clientConsolidation(): PrismaClient {
  global.prismaConsolidation ??= new PrismaClient({
    datasources: { db: { url: urlConsolidation() } },
  });
  return global.prismaConsolidation;
}

/**
 * Contrôle au démarrage, symétrique de `garantirRoleApplicatif` et d'exigences
 * inverses : ici `BYPASSRLS` est requis, l'écriture est disqualifiante.
 * Mémorisé, échec compris.
 */
export function garantirRoleConsolidation(): Promise<void> {
  global.controleRoleConsolidation ??= verifierRoleReporting(
    clientConsolidation(),
  ).then(
    () => undefined,
    async (erreur: unknown) => {
      await clientConsolidation().$disconnect();
      throw erreur;
    },
  );
  return global.controleRoleConsolidation;
}

/** Qui demande la consolidation — journalisé à chaque requête (D21, n°2). */
export type OrigineConsolidation = {
  utilisateurId: string;
  role: Role;
  /** Ce que la requête agrège, en clair. Apparaît au journal. */
  motif: string;
};

/**
 * Exécute une requête de consolidation, après contrôle du rôle et
 * journalisation de son origine.
 *
 * La journalisation précède la requête : une consolidation qui échoue laisse
 * quand même la trace de qui l'a demandée.
 */
export async function avecConsolidation<T>(
  origine: OrigineConsolidation,
  travail: (client: PrismaClient) => Promise<T>,
): Promise<T> {
  await garantirRoleConsolidation();

  await avecDesignationAuth(clientApplicatif).journalAcces.create({
    data: {
      id: uuidv7(),
      utilisateur_id: origine.utilisateurId,
      evenement: EvenementAcces.requete_consolidation,
      role: origine.role,
      detail: origine.motif,
    },
  });

  return travail(clientConsolidation());
}

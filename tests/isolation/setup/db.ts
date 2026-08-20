import { PrismaClient } from "@prisma/client";

import { Role as RoleCanonique, type Role } from "@/lib/auth/roles";

import {
  ROLE_APP,
  ROLE_REPORTING,
  VAR_CLIENT,
  VAR_PERIMETRE,
  VAR_ROLE,
  VAR_SOCIETE,
} from "./fixtures";

/**
 * Connexions et contexte pour les scénarios d'isolation (L0-05).
 *
 * Deux rôles, deux connexions :
 *   - `clientOwner` — propriétaire du schéma (migration, seed, DDL des fixtures).
 *     Non soumis à RLS, réservé au harnais.
 *   - `clientApp` — rôle `codiplan_app`, NON propriétaire et NON BYPASSRLS,
 *     SOUS lequel tournent tous les scénarios : c'est la seule façon de vérifier
 *     que les politiques mordent réellement (le propriétaire, lui, les
 *     contournerait).
 *   - `clientReporting` — rôle `codiplan_reporting` (D21), BYPASSRLS et SELECT
 *     seul, ajouté au ticket L0-06. Les scénarios s'en servent pour prouver ce
 *     qu'il peut (lire par-dessus le cloisonnement) ET ce qu'il ne peut pas
 *     (écrire, ou lire une table de données personnelles).
 */

/** URL d'administration : la base jetable pilotée par TEST_DATABASE_URL. */
export function urlOwner(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL est requis pour les tests d'isolation. " +
        "La base doit être un PostgreSQL local jetable, jamais Neon " +
        "(voir docs/decisions/2026-08-20-tests-isolation-postgres-local.md).",
    );
  }
  return url;
}

/** URL applicative : même base, rôle non-owner `codiplan_test_app`, sans mot de passe (auth trust locale). */
export function urlApp(): string {
  const url = new URL(urlOwner());
  url.username = ROLE_APP;
  url.password = "";
  return url.toString();
}

/** URL de consolidation : même base, rôle `codiplan_reporting` (D21). */
export function urlReporting(): string {
  const url = new URL(urlOwner());
  url.username = ROLE_REPORTING;
  url.password = "";
  return url.toString();
}

let owner: PrismaClient | undefined;
let app: PrismaClient | undefined;
let reporting: PrismaClient | undefined;

export function clientOwner(): PrismaClient {
  owner ??= new PrismaClient({ datasources: { db: { url: urlOwner() } } });
  return owner;
}

export function clientApp(): PrismaClient {
  app ??= new PrismaClient({ datasources: { db: { url: urlApp() } } });
  return app;
}

export function clientReporting(): PrismaClient {
  reporting ??= new PrismaClient({
    datasources: { db: { url: urlReporting() } },
  });
  return reporting;
}

/** Ferme les connexions ouvertes par un fichier de scénarios. */
export async function fermerClients(): Promise<void> {
  await Promise.all([
    owner?.$disconnect(),
    app?.$disconnect(),
    reporting?.$disconnect(),
  ]);
  owner = undefined;
  app = undefined;
  reporting = undefined;
}

/** Contexte d'un compte portail (D10) : société + client + périmètre de sites. */
export type ContextePortail = {
  societeId: string;
  clientId: string;
  /** Vide = tous les sites du client. */
  perimetreSites?: readonly string[];
};

/**
 * Exécute `travail` sous le contexte d'un utilisateur interne de `societeId`.
 * Aucun `client_id` posé : le parc entier de la société est visible.
 */
export function avecSociete<T>(
  societeId: string,
  travail: (tx: PrismaClient) => Promise<T>,
): Promise<T> {
  return avecSocieteEtRole(societeId, null, travail);
}

/**
 * Même chose, en posant en plus `app.role` (L0-06). C'est ce contexte-là que
 * pose réellement `lib/db/rls.ts` pour une session : société ET rôle.
 * `societeId` peut être `null` — le cas des rôles éditeur, qui n'ont aucune
 * société active et dont on veut précisément vérifier qu'ils ne lisent rien de
 * cloisonné.
 */
export function avecSocieteEtRole<T>(
  societeId: string | null,
  role: Role | null,
  travail: (tx: PrismaClient) => Promise<T>,
): Promise<T> {
  return clientApp().$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "SELECT set_config($1, $2, true)",
      VAR_SOCIETE,
      societeId ?? "",
    );
    await tx.$executeRawUnsafe(
      "SELECT set_config($1, $2, true)",
      VAR_ROLE,
      role ?? "",
    );
    return travail(tx as unknown as PrismaClient);
  });
}

/**
 * Exécute `travail` sous le contexte d'un compte portail : société, client et,
 * s'il est renseigné, périmètre de sites (liste d'UUID jointe par des virgules).
 *
 * Le rôle posé est toujours `client` : un compte portail n'en tient pas
 * d'autre (D10), et poser le rôle ici rend le contexte du portail aussi complet
 * que celui d'un utilisateur interne — sans quoi les scénarios de rôle ne
 * pourraient rien vérifier sur lui.
 */
export function avecPortail<T>(
  contexte: ContextePortail,
  travail: (tx: PrismaClient) => Promise<T>,
): Promise<T> {
  const perimetre = (contexte.perimetreSites ?? []).join(",");
  return clientApp().$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "SELECT set_config($1, $2, true)",
      VAR_SOCIETE,
      contexte.societeId,
    );
    await tx.$executeRawUnsafe(
      "SELECT set_config($1, $2, true)",
      VAR_ROLE,
      RoleCanonique.client,
    );
    await tx.$executeRawUnsafe(
      "SELECT set_config($1, $2, true)",
      VAR_CLIENT,
      contexte.clientId,
    );
    await tx.$executeRawUnsafe(
      "SELECT set_config($1, $2, true)",
      VAR_PERIMETRE,
      perimetre,
    );
    return travail(tx as unknown as PrismaClient);
  });
}

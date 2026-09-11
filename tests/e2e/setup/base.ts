import { execFileSync } from "node:child_process";

import { PrismaClient } from "@prisma/client";

/**
 * LA BASE DES SCÉNARIOS DE BOUT EN BOUT — jetable, locale, jamais l'hébergée.
 *
 * ## Pourquoi elle n'existait pas, et ce que cela coûtait
 *
 * *Mesuré le 11/09/2026 : `pnpm test:e2e` tournait sans AUCUNE base.* Trois
 * scénarios y vivaient — l'accueil, le thème, le gardien hors-ligne —, et aucun
 * ne franchissait un écran authentifié : le premier `goto("/planning")` aurait
 * redirigé vers `/connexion`. **Tout ce qui se passe après la connexion était
 * donc hors de portée d'un scénario de bout en bout**, c'est-à-dire tout le
 * produit.
 *
 * C'est le §9 du 08/09 pris un étage plus haut : *une suite qui éprouve tous
 * les maillons n'éprouve pas la chaîne.* Le dépôt s'était donné un appelant de
 * la chaîne de session (`tests/isolation/chaine-session.test.ts`) ; il n'avait
 * aucun appelant de la chaîne **écran**.
 *
 * ## Ce que ce module fait
 *
 * Il provisionne une base jetable par le CHEMIN DE PRODUCTION et par lui seul :
 * `prisma migrate deploy` — qui crée au passage le rôle applicatif restreint —
 * puis le semis de démonstration. Aucune table fabriquée pour le test, aucune
 * politique posée à la main : *ce qui n'est pas dans la migration n'existe pas
 * pour ces scénarios*, et un cloisonnement cassé les casse.
 *
 * ## Le garde-fou, et il est le même que celui du harnais d'isolation
 *
 * La base de bout en bout n'est JAMAIS l'hébergée. Trois refus, et le troisième
 * est celui qu'on oublie : une URL Neon, une URL identique à `DATABASE_URL`,
 * et **l'absence de la variable**, qui ferait silencieusement retomber le
 * serveur de test sur la base de développement de qui l'exécute.
 */

/** La variable qui pilote la base de bout en bout. */
export const VARIABLE_BASE_E2E = "E2E_DATABASE_URL";

/**
 * L'URL d'ADMINISTRATION de la base jetable — rôle propriétaire, migrations et
 * semis. Ce n'est jamais l'URL que le serveur de test reçoit.
 */
export function urlAdministration(): string {
  const url = process.env[VARIABLE_BASE_E2E];
  if (url === undefined || url.trim().length === 0) {
    throw new Error(
      `${VARIABLE_BASE_E2E} est requis pour les scénarios de bout en bout qui ` +
        "traversent une session. La base doit être un PostgreSQL local " +
        "jetable, jamais la base hébergée.",
    );
  }
  if (/neon\.tech/i.test(url)) {
    throw new Error(
      `${VARIABLE_BASE_E2E} pointe vers Neon. Les scénarios de bout en bout ` +
        "exigent un PostgreSQL local jetable — jamais la base hébergée.",
    );
  }
  if (process.env.DATABASE_URL === url) {
    throw new Error(
      `${VARIABLE_BASE_E2E} est identique à DATABASE_URL. La base de bout en ` +
        "bout doit être une base locale distincte et jetable.",
    );
  }
  return url;
}

/**
 * L'URL que le SERVEUR DE TEST reçoit : même base, rôle applicatif restreint.
 *
 * C'est la moitié qui compte. `codiplan_app` est créé par la migration — ni
 * propriétaire, ni superutilisateur, ni `BYPASSRLS` —, et `lib/db/garde-role.ts`
 * refuse la connexion sinon. *Un scénario joué sous le rôle propriétaire ne
 * mesurerait rien du cloisonnement : il verrait tout.*
 */
export function urlApplicative(): string {
  const url = new URL(urlAdministration());
  url.username = "codiplan_app";
  url.password = "";
  return url.toString();
}

/**
 * RECRÉE la base — vide, à chaque exécution.
 *
 * *Jetable veut dire jetée.* Une base conservée d'une exécution à l'autre
 * garderait les déplacements du scénario précédent, et le premier scénario
 * accepté rendrait le suivant vert pour une mauvaise raison — le bloc étant
 * déjà là où on croit l'avoir mis (§9, 11/09 : le succès a-t-il bien la cause
 * que je crois ?).
 *
 * La connexion se fait sur la base de maintenance du même serveur : on ne
 * supprime pas la base à laquelle on est connecté.
 */
export async function recreerLaBase(): Promise<void> {
  const cible = new URL(urlAdministration());
  const nom = cible.pathname.replace(/^\//, "");
  if (nom.length === 0) {
    throw new Error(
      `${VARIABLE_BASE_E2E} ne nomme aucune base : impossible de la recréer.`,
    );
  }
  const maintenance = new URL(cible.toString());
  maintenance.pathname = "/postgres";
  const client = new PrismaClient({
    datasources: { db: { url: maintenance.toString() } },
  });
  try {
    await client.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${nom}"`);
    await client.$executeRawUnsafe(`CREATE DATABASE "${nom}"`);
  } finally {
    await client.$disconnect();
  }
}

/** Exécute une commande du dépôt contre la base d'administration. */
function contreLaBase(commande: string, arguments_: readonly string[]): void {
  execFileSync(commande, [...arguments_], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: urlAdministration() },
  });
}

/**
 * Applique les migrations et le semis de démonstration.
 *
 * `migrate deploy` et non `migrate reset` : c'est LA commande de mise en ligne
 * (§4 du CLAUDE.md), et l'éprouver ici l'éprouve là-bas. La base étant
 * recréée par l'appelant, elle est vide au départ.
 */
export function preparerLaBase(): void {
  contreLaBase("pnpm", ["exec", "prisma", "migrate", "deploy"]);
  contreLaBase("pnpm", ["db:seed"]);
}

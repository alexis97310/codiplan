import { randomBytes } from "node:crypto";
import { join } from "node:path";

import { defineConfig, devices } from "@playwright/test";

import { FICHIER_COURRIELS_CAPTURES } from "./tests/e2e/setup/courriel-captures";

// `__dirname` — CE FICHIER EST COMPILÉ EN COMMONJS PAR PLAYWRIGHT (mesuré :
// `import.meta.url` y casse le chargement, « exports is not defined in ES
// module scope » — le transform interne de Playwright, à la différence de
// `vitest.config.mts` et `prisma.config.ts`, ne le prend pas en charge).
const RACINE = __dirname;

const PORT = Number(process.env.PORT ?? 3100);
/** Exportée : `tests/e2e/setup/global.ts` en a besoin pour son propre navigateur. */
export const BASE_URL = process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`;

/**
 * LE SERVEUR DE TEST REÇOIT UNE BASE, ET UN SECRET TIRÉ AU SORT (R2-18).
 *
 * *Mesuré le 11/09/2026 : `pnpm test:e2e` tournait sans aucune base et sans
 * secret. `/connexion` et `/enrolement` rendaient 500, et tout ce qui se passe
 * APRÈS la connexion était hors de portée d'un scénario de bout en bout,
 * c'est-à-dire tout le produit.*
 *
 * La base est pilotée par `E2E_DATABASE_URL` — locale et jetable, avec trois
 * refus qui garantissent qu'elle n'est jamais l'hébergée (`tests/e2e/setup/base.ts`).
 * Le serveur la voit sous le rôle APPLICATIF restreint, jamais sous le
 * propriétaire : un scénario joué sous le propriétaire ne mesurerait rien du
 * cloisonnement, il verrait tout.
 *
 * Le secret est **tiré au sort à chaque exécution** et passé par
 * l'environnement : jamais écrit dans le dépôt, jamais dans un fichier (I9).
 */
function environnementDuServeur(): Record<string, string> {
  const base = process.env.E2E_DATABASE_URL;
  if (base === undefined || base.trim().length === 0) {
    return {};
  }
  const applicative = new URL(base);
  applicative.username = "codiplan_app";
  applicative.password = "";
  return {
    DATABASE_URL: applicative.toString(),
    BETTER_AUTH_SECRET:
      process.env.BETTER_AUTH_SECRET ?? randomBytes(32).toString("hex"),
    BETTER_AUTH_URL: BASE_URL,
    // ── LE CANAL COURRIEL, DOUBLÉ (AVERTISSEMENTS-1, 24/09/2026) ────────────
    //
    // Une clé qui ne vaut rien chez un vrai prestataire — `--require` charge
    // `tests/e2e/setup/double-courriel.cjs` AVANT le serveur, qui intercepte
    // les seuls appels vers `api.resend.com` et rend un succès fabriqué.
    // Sans ces deux variables, `configurationCourriel` refuserait tout envoi
    // (canal non configuré) et `tests/e2e/avertissements-1.spec.ts` ne
    // pourrait jamais mesurer le cas « parti ».
    COURRIEL_API_CLE: "e2e-cle-sans-valeur",
    COURRIEL_EXPEDITEUR: "codiplan@e2e.test",
    E2E_COURRIELS_CAPTURES: FICHIER_COURRIELS_CAPTURES,
    NODE_OPTIONS: `--require ${join(RACINE, "tests/e2e/setup/double-courriel.cjs")}`,
  };
}

/**
 * Porte `pnpm test:e2e`, incluse dans `pnpm verify:full` seulement (D14).
 * Le serveur testé est une compilation de production : c'est celui-là qui part
 * chez le client, et le mode développement masque les erreurs de rendu serveur.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  // La préparation ne touche RIEN quand `E2E_DATABASE_URL` est absente : les
  // scénarios qui ont besoin d'une base le disent alors eux-mêmes en échouant.
  // Un saut silencieux rendrait un vert qui ne parle de rien (§9, 30/08).
  globalSetup: "./tests/e2e/setup/global.ts",
  // Les fichiers du harnais ne sont pas des scénarios.
  testIgnore: "**/setup/**",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    locale: "fr-FR",
    // Nouvelle-Calédonie : UTC+11, sans changement d'heure.
    timezoneId: "Pacific/Noumea",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Compilation incluse : `pnpm test:e2e` reste utilisable seul, et le
    // cache Next rend la reconstruction quasi immédiate après `pnpm verify`.
    command: `pnpm run build && pnpm exec next start --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: environnementDuServeur(),
  },
});

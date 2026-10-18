import { randomBytes } from "node:crypto";
import { join } from "node:path";

import { defineConfig, devices } from "@playwright/test";

import { FICHIER_COURRIELS_CAPTURES } from "./tests/e2e/setup/courriel-captures";

const RACINE = __dirname;

const PORT = Number(process.env.PORT ?? 3100);
export const BASE_URL = process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`;

/**
 * L'OUTIL DE L'AUDIT FONCTIONNEL (9F5-AUDIT-FONCTIONNEL-PARCOURS) — À PART de
 * `playwright.config.ts`, sur le modèle exact de `playwright.audit.config.ts`.
 *
 * ## Pourquoi une configuration séparée plutôt qu'un projet de plus
 *
 * Ce lot ne vérifie aucune assertion fonctionnelle existante : il PARCOURT le
 * dépôt (balayage par rôle, parcours scriptés) en relevant des mesures, et
 * écrit des rapports sous `docs/audits/9F5-fonctionnel/`. Le mélanger à
 * `tests/e2e` l'aurait fait jouer par `pnpm test:e2e` et donc par
 * `pnpm verify:full` — un balayage de tout le dépôt à chaque lot, alors qu'il
 * ne doit tourner qu'à la demande (`pnpm audit:fonctionnel`). `testDir` pointe
 * donc vers `tests/audit-fonctionnel/`, jamais vers `tests/e2e/`.
 *
 * ## Ce qu'il réutilise, et ce qu'il n'invente pas
 *
 * Le `globalSetup` est EXACTEMENT celui de `tests/e2e/setup/global.ts` — même
 * base jetable (`E2E_DATABASE_URL`), même semis, même scène, mêmes comptes
 * d'épreuve. `environnementDuServeur` ci-dessous est DUPLIQUÉE depuis
 * `playwright.config.ts`, à l'identique de `playwright.audit.config.ts` et
 * pour la même raison annoncée là-bas : donner au serveur de balayage le même
 * secret de session et le même canal courriel doublé, sans toucher à un
 * fichier hors du territoire de ce lot.
 *
 * Un seul worker, exécution sérielle : le balayage par rôle écrit un fichier
 * JSON unique (`docs/audits/9F5-fonctionnel/balayage.json`) et plusieurs
 * identités MFA (TOTP dépendant du temps) ne supportent pas deux connexions
 * concurrentes sur la même identité.
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
    COURRIEL_API_CLE: "e2e-cle-sans-valeur",
    COURRIEL_EXPEDITEUR: "codiplan@e2e.test",
    E2E_COURRIELS_CAPTURES: FICHIER_COURRIELS_CAPTURES,
    NODE_OPTIONS: `--require ${join(RACINE, "tests/e2e/setup/double-courriel.cjs")}`,
  };
}

export default defineConfig({
  testDir: "./tests/audit-fonctionnel",
  globalSetup: "./tests/e2e/setup/global.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 300_000,
  use: {
    baseURL: BASE_URL,
    locale: "fr-FR",
    timezoneId: "Pacific/Noumea",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm run build && pnpm exec next start --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 240_000,
    env: environnementDuServeur(),
  },
});

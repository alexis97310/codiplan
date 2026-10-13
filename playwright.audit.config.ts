import { randomBytes } from "node:crypto";
import { join } from "node:path";

import { defineConfig, devices } from "@playwright/test";

import { FICHIER_COURRIELS_CAPTURES } from "./tests/e2e/setup/courriel-captures";

const RACINE = __dirname;

const PORT = Number(process.env.PORT ?? 3100);
export const BASE_URL = process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`;

/**
 * L'OUTIL DE PRISE DE VUE DE L'AUDIT VISUEL (9EWC-AUDIT-VISUEL-ECRAN) — À PART
 * de `playwright.config.ts`, et c'est tout l'objet du fichier.
 *
 * ## Pourquoi une configuration séparée plutôt qu'un projet de plus
 *
 * Ce lot ne vérifie rien : il REND chaque écran, à deux largeurs, et le
 * COMPARE à la maquette rendue. Le mélanger à `tests/e2e` l'aurait fait jouer
 * par `pnpm test:e2e` et donc par `pnpm verify:full` — un gardien qui tourne à
 * chaque lot pour une prise de vue qui ne doit tourner qu'à la demande
 * (`pnpm audit:visuel`). `testDir` pointe donc vers `tests/audit-visuel/`,
 * jamais vers `tests/e2e/`.
 *
 * ## Ce qu'il réutilise, et ce qu'il n'invente pas
 *
 * Le `globalSetup` est EXACTEMENT celui de `tests/e2e/setup/global.ts` — même
 * base jetable (`E2E_DATABASE_URL`), même semis, même scène, mêmes comptes
 * d'épreuve. Une base ou des comptes réécrits ici auraient divergé en silence
 * de ce que `pnpm test:e2e` éprouve ; ce fichier ne les copie donc pas, il les
 * IMPORTE.
 *
 * L'environnement du serveur (`environnementDuServeur` ci-dessous) est en
 * revanche DUPLIQUÉ depuis `playwright.config.ts`, et c'est une exception
 * annoncée : ce fichier-ci est hors territoire du lot (voir le ticket), la
 * fonction n'en est pas exportée, et la dupliquer ici est le seul moyen de
 * donner au serveur de capture le même secret de session et le même canal
 * courriel doublé que le serveur des épreuves — sans toucher à un fichier
 * qu'on n'a pas le droit d'ouvrir.
 *
 * Un seul worker : la spec écrit un fichier JSON unique de mesures
 * (`docs/propositions/9EWC-AUDIT-VISUEL-ECRAN/mesures.json`), et deux workers
 * qui y écriraient en même temps en perdraient la moitié.
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
  testDir: "./tests/audit-visuel",
  globalSetup: "./tests/e2e/setup/global.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 60_000,
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

import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3100);
const BASE_URL = process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`;

/**
 * Porte `pnpm test:e2e`, incluse dans `pnpm verify:full` seulement (D14).
 * Le serveur testé est une compilation de production : c'est celui-là qui part
 * chez le client, et le mode développement masque les erreurs de rendu serveur.
 */
export default defineConfig({
  testDir: "./tests/e2e",
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
  },
});

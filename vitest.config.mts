import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const racine = fileURLToPath(new URL(".", import.meta.url));

/**
 * Deux projets, deux portes distinctes (arbitrage D14) :
 *   pnpm test            → projet « unit »      (tests/unit)
 *   pnpm test:isolation  → projet « isolation » (tests/isolation, sanctuarisé)
 * Les tests bout en bout relèvent de Playwright, pas de Vitest.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": racine,
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: ["./tests/unit/setup.ts"],
          include: ["tests/unit/**/*.test.{ts,tsx}"],
        },
      },
      {
        extends: true,
        test: {
          name: "isolation",
          environment: "node",
          include: ["tests/isolation/**/*.test.ts"],
        },
      },
    ],
  },
});

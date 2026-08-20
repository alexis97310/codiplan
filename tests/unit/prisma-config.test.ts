import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Vitest s'exécute depuis la racine du dépôt.
const racine = process.cwd();
const packageJson = JSON.parse(
  readFileSync(join(racine, "package.json"), "utf8"),
) as Record<string, unknown>;
const configuration = readFileSync(join(racine, "prisma.config.ts"), "utf8");

/**
 * Ticket L0-E — la configuration Prisma a quitté `package.json#prisma`, déprécié
 * et supprimé en Prisma 7, pour `prisma.config.ts`. Voir
 * docs/decisions/2026-08-20-configuration-prisma-hors-package-json.md.
 *
 * Deux régressions silencieuses à refermer, et c'est tout l'objet de ce fichier :
 * la clé remise dans `package.json`, où elle serait ignorée au profit du
 * fichier ; et le rechargement de `.env` retiré du fichier, ce qui casserait
 * `pnpm db:migrate` et `pnpm db:seed` sur un poste de développement — la CLI ne
 * charge plus `.env` d'elle-même dès qu'une configuration existe.
 */
describe("configuration Prisma", () => {
  it("ne laisse plus de clé « prisma » dans package.json", () => {
    expect(packageJson).not.toHaveProperty("prisma");
  });

  it("déclare la commande d'amorçage, dont dépend `pnpm db:seed`", () => {
    expect(configuration).toContain('seed: "tsx prisma/seed.ts"');
  });

  it("recharge lui-même `.env`, que la CLI ne charge plus", () => {
    expect(configuration).toContain("loadEnvFile");
  });
});

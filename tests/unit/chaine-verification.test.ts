import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

type PackageJson = { scripts: Record<string, string> };

// Vitest s'exécute depuis la racine du dépôt.
const scripts = (
  JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf8"),
  ) as PackageJson
).scripts;

/**
 * Ticket L0-02 — arbitrage D14 : deux portes distinctes, dont la composition
 * est elle-même vérifiée. Sans ce test, retirer `test:isolation` de `verify`
 * passerait inaperçu et désarmerait le gardien de cloisonnement.
 */
describe("chaîne de vérification", () => {
  it("expose les commandes attendues", () => {
    for (const commande of [
      "typecheck",
      "lint",
      "test",
      "test:isolation",
      "test:e2e",
      "build",
      "verify",
      "verify:full",
    ]) {
      expect(scripts, `commande manquante : ${commande}`).toHaveProperty(
        commande,
      );
    }
  });

  it("enchaîne typecheck, lint, test, test:isolation et build dans verify", () => {
    const etapes = [
      "pnpm typecheck",
      "pnpm lint",
      "pnpm test",
      "pnpm test:isolation",
      "pnpm build",
    ];

    let position = -1;
    for (const etape of etapes) {
      const suivante = scripts.verify.indexOf(etape, position + 1);
      expect(
        suivante,
        `étape absente ou hors ordre : ${etape}`,
      ).toBeGreaterThan(position);
      position = suivante;
    }
  });

  it("n'ajoute les tests bout en bout que dans verify:full", () => {
    expect(scripts.verify).not.toContain("test:e2e");
    expect(scripts["verify:full"]).toContain("pnpm verify");
    expect(scripts["verify:full"]).toContain("pnpm test:e2e");
  });

  it("refuse le moindre avertissement ESLint", () => {
    expect(scripts.lint).toContain("--max-warnings 0");
  });
});

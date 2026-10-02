import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RACINE } from "../outils/fichiers-source";

/**
 * « DB doublons machine — démonstration » : RÉSERVÉ À LA DÉMONSTRATION, et
 * déclenché À LA MAIN uniquement (9CU-DEMO-DOUBLONS-MACHINE).
 *
 * Même famille que `migration-automatique.test.ts` et le gardien de
 * `db-resolve.yml` : statique, il lit le fichier du flux et le script qu'il
 * appelle, il ne peut pas dire ce qu'un exécuteur fera.
 */
const FLUX = join(
  RACINE,
  ".github",
  "workflows",
  "db-doublons-machine-demo.yml",
);
const SCRIPT = join(RACINE, "scripts", "nettoyer-doublons-machine-demo.mts");

function flux(): string {
  const texte = readFileSync(FLUX, "utf8");
  expect(
    texte.length,
    "db-doublons-machine-demo.yml est vide ou introuvable : le gardien ne mesure rien",
  ).toBeGreaterThan(200);
  return texte;
}

function script(): string {
  return readFileSync(SCRIPT, "utf8");
}

describe("db-doublons-machine-demo.yml — réservé à la démonstration, déclenché à la main", () => {
  it("le seul déclencheur est workflow_dispatch", () => {
    const texte = flux();
    const debut = texte.indexOf("\non:");
    const fin = texte.indexOf("\nconcurrency:");
    expect(debut, "le flux ne déclare plus de déclencheur").toBeGreaterThan(0);
    expect(fin, "le flux n'a plus de bloc concurrency").toBeGreaterThan(debut);
    const bloc = texte.slice(debut, fin);
    expect(bloc).toContain("workflow_dispatch:");
    expect(bloc).not.toContain("push:");
    expect(bloc).not.toContain("pull_request:");
    expect(bloc).not.toContain("schedule:");
  });

  it("l'entrée « appliquer » est booléenne, et part DÉCOCHÉE", () => {
    const texte = flux();
    const debut = texte.indexOf("      appliquer:");
    expect(debut, "l'entrée « appliquer » n'existe pas").toBeGreaterThan(0);
    const fin = texte.indexOf("\nconcurrency:");
    const bloc = texte.slice(debut, fin);
    expect(bloc).toContain("type: boolean");
    expect(bloc).toMatch(/default:\s*false/);
  });

  it("le mot PRODUCTION n'apparaît nulle part — base de démonstration seulement", () => {
    expect(flux().toUpperCase()).not.toContain("PRODUCTION");
  });

  it("une seule chaîne de connexion est lue : MIGRATION_DATABASE_URL, sans repli", () => {
    const texte = flux();
    expect(texte).toContain("secrets.MIGRATION_DATABASE_URL");
    // Aucune autre variable de secret de connexion : pas de choix de cible.
    const secrets = [...texte.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]);
    expect(new Set(secrets)).toEqual(new Set(["MIGRATION_DATABASE_URL"]));
  });

  it("il refuse explicitement si le secret est vide", () => {
    const texte = flux();
    expect(texte).toContain('-z "${DATABASE_URL:-}"');
    expect(texte).toContain("exit 1");
  });

  it("partage le groupe de concurrence « db-migrate », sans annuler ce qui tourne", () => {
    const texte = flux();
    const bloc = texte.slice(texte.indexOf("\nconcurrency:"));
    expect(bloc).toContain("group: db-migrate");
    expect(bloc).toContain("cancel-in-progress: false");
  });

  it("joue pnpm db:doublons-machine-demo, avec APPLIQUER dérivé de l'entrée", () => {
    const texte = flux();
    expect(texte).toContain("pnpm db:doublons-machine-demo");
    expect(texte).toContain(
      "APPLIQUER: ${{ inputs.appliquer && 'oui' || 'non' }}",
    );
  });
});

describe("scripts/nettoyer-doublons-machine-demo.mts — le cloisonnement n'est jamais désactivé", () => {
  it("ne lève JAMAIS FORCE ROW LEVEL SECURITY", () => {
    expect(script()).not.toContain("NO FORCE ROW LEVEL SECURITY");
  });

  it("ne désactive JAMAIS ROW LEVEL SECURITY", () => {
    expect(script()).not.toContain("DISABLE ROW LEVEL SECURITY");
  });

  it("ne console.log jamais (CLAUDE.md §5) — sortie par process.stdout.write", () => {
    expect(script()).not.toContain("console.log(");
    expect(script()).toContain("process.stdout.write");
  });
});

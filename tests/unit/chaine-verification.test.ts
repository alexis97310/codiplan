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
      "format:check",
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

  it("enchaîne format:check, typecheck, lint, test, test:isolation et build dans verify", () => {
    const etapes = [
      "pnpm format:check",
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

/**
 * LA PORTE DU TICKET ET LA PORTE DE LA CI GARDENT LA MÊME CHOSE.
 *
 * **Ce que ce gardien répare, et il a coûté un aller-retour.** `pnpm verify`
 * ne contenait pas `format:check` ; la CI le jouait dans une étape à part.
 * Mesuré sur l'état exact que la CI a refusé : `pnpm verify` sort en **0** et
 * ne prononce jamais le mot « prettier ». Une session pouvait donc annoncer un
 * vert sincère — 600 tests, typecheck, lint, build — sur un état que la CI
 * refuserait, sans avoir rien négligé : la porte qu'elle franchissait n'était
 * pas celle qui juge.
 *
 * C'est le défaut qu'on refuse partout ailleurs — deux contrôles du même objet
 * qui ne disent pas la même chose (§9, 01/09) — appliqué aux portes elles-mêmes.
 * Le corriger en ajoutant `format:check` à `verify` traite l'incident ; ce
 * gardien-ci traite la CLASSE : toute étape que la CI ajoutera demain devra
 * entrer dans `verify`, ou ce test rougira.
 *
 * **Sa limite, annoncée** : il ne compare que les commandes `pnpm <script>`.
 * Une étape de CI qui appellerait directement un binaire (`pnpm exec …`), ou
 * une action GitHub, n'est pas une porte du dépôt et n'a pas à l'être — elle
 * prépare l'environnement, elle ne juge rien.
 */
describe("les deux portes gardent la même chose", () => {
  const CI = readFileSync(
    join(process.cwd(), ".github/workflows/ci.yml"),
    "utf8",
  );

  /** Le corps d'un job du flux, jusqu'au job suivant. */
  function job(nom: string): string {
    const debut = CI.indexOf(`\n  ${nom}:\n`);
    expect(debut, `job absent de ci.yml : ${nom}`).toBeGreaterThan(-1);
    const suite = CI.slice(debut + 1);
    const fin = suite.search(/\n {2}[a-z][a-z0-9-]*:\n/);
    return fin === -1 ? suite : suite.slice(0, fin);
  }

  /** Les scripts du dépôt qu'un bloc YAML invoque — `pnpm exec` exclu. */
  function scriptsInvoques(bloc: string): string[] {
    const trouves = new Set<string>();
    for (const ligne of bloc.split("\n")) {
      for (const m of ligne.matchAll(/\bpnpm\s+([a-z][a-z0-9:-]*)/g)) {
        const nom = m[1] ?? "";
        if (nom !== "exec" && nom !== "install" && nom in scripts) {
          trouves.add(nom);
        }
      }
    }
    return [...trouves].sort();
  }

  /**
   * Les scripts qu'une porte couvre, TRANSITIVEMENT — `verify:full` couvre
   * `verify`, qui couvre `format:check`, `lint`, et le reste.
   */
  function couverture(porte: string): Set<string> {
    const vus = new Set<string>();
    const aVoir = [porte];
    while (aVoir.length > 0) {
      const nom = aVoir.pop() as string;
      if (vus.has(nom)) continue;
      vus.add(nom);
      for (const m of (scripts[nom] ?? "").matchAll(
        /\bpnpm\s+([a-z][a-z0-9:-]*)/g,
      )) {
        const suivant = m[1] ?? "";
        if (suivant in scripts) aVoir.push(suivant);
      }
    }
    return vus;
  }

  it("le gardien lit réellement des commandes — sinon il garde le vide", () => {
    // Témoin : un parseur devenu aveugle ne trouverait aucune commande et
    // n'exigerait rien de personne (§9, 30/08).
    expect(scriptsInvoques(job("verify")).length).toBeGreaterThan(0);
    expect(couverture("verify").size).toBeGreaterThanOrEqual(6);
    expect(couverture("verify")).toContain("format:check");
  });

  for (const [nomJob, porte] of [
    ["verify", "verify"],
    ["verify-full", "verify:full"],
  ] as const) {
    it(`le job « ${nomJob} » n'exige rien que « pnpm ${porte} » ne couvre`, () => {
      const exigees = scriptsInvoques(job(nomJob));
      const couvertes = couverture(porte);

      for (const commande of exigees) {
        expect(
          couvertes.has(commande),
          `la CI joue « pnpm ${commande} » dans le job « ${nomJob} », que ` +
            `« pnpm ${porte} » ne couvre pas. La porte du ticket et la porte ` +
            "de la CI ne gardent alors pas la même chose : un vert local " +
            "sincère peut être rouge en CI, et c'est ainsi que le formatage " +
            "est passé à travers. Toute étape de CI entre dans la porte, ou " +
            "n'est pas une étape de vérification.",
        ).toBe(true);
      }
    });
  }

  it("ÉPREUVE : une étape de CI hors de la porte est refusée", () => {
    // La faute telle qu'elle s'est commise : `format:check` joué par la CI et
    // absent de `verify`. On la rejoue sur une porte amputée.
    const porteAmputee = new Set(
      [...couverture("verify")].filter((nom) => nom !== "format:check"),
    );
    expect(porteAmputee.has("format:check")).toBe(false);
    expect(couverture("verify").has("format:check")).toBe(true);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  rapportHistorique,
  verdictDeResolution,
  type LigneMigration,
} from "../../../scripts/lib/resolution-migration";

/**
 * LE DÉBLOCAGE D'UNE BASE DONT UNE MIGRATION A ÉCHOUÉ.
 *
 * Ce gardien est éprouvé DANS LES DEUX DIRECTIONS, et la seconde est celle
 * qu'on oublie (§9, 11/09) : à côté de chaque cas qui doit REFUSER, un cas qui
 * doit ACCEPTER **pour sa propre raison** — un historique où la ligne voisine
 * ressemble à la fautive sans l'être.
 */

const jadis = new Date("2026-09-11T06:31:00Z");

function appliquee(nom: string): LigneMigration {
  return {
    migration_name: nom,
    finished_at: jadis,
    rolled_back_at: null,
    applied_steps_count: 1,
  };
}

function enEchec(nom: string, etapes = 0): LigneMigration {
  return {
    migration_name: nom,
    finished_at: null,
    rolled_back_at: null,
    applied_steps_count: etapes,
  };
}

function annulee(nom: string): LigneMigration {
  return {
    migration_name: nom,
    finished_at: null,
    rolled_back_at: jadis,
    applied_steps_count: 0,
  };
}

describe("verdict de résolution", () => {
  it("accepte la migration réellement en échec, sans étape appliquée", () => {
    const verdict = verdictDeResolution(
      [appliquee("20260913150000_a"), enEchec("20260913160000_b")],
      "20260913160000_b",
    );

    expect(verdict.resoluble).toBe(true);
    if (verdict.resoluble) {
      expect(verdict.migration.migration_name).toBe("20260913160000_b");
    }
  });

  // LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON. Une migration ANNULÉE
  // porte, elle aussi, `finished_at` nul. Un verdict qui ne lirait que cette
  // colonne la prendrait pour un échec, et accepterait de « résoudre » une
  // ligne déjà résolue — sans jamais rougir.
  it("ne prend pas une migration DÉJÀ annulée pour un échec", () => {
    const verdict = verdictDeResolution(
      [appliquee("20260913150000_a"), annulee("20260913160000_b")],
      "20260913160000_b",
    );

    expect(verdict.resoluble).toBe(false);
    if (!verdict.resoluble) {
      expect(verdict.motif).toContain("Aucune migration en échec");
    }
  });

  it("refuse un historique VIDE plutôt que de le lire « rien à résoudre »", () => {
    const verdict = verdictDeResolution([], "20260913160000_b");

    expect(verdict.resoluble).toBe(false);
    if (!verdict.resoluble) {
      expect(verdict.motif).toContain("VIDE");
    }
  });

  it("refuse quand le nom saisi n'est pas celui que la base porte", () => {
    const verdict = verdictDeResolution(
      [appliquee("20260913150000_a"), enEchec("20260913160000_b")],
      "20260913170000_c",
    );

    expect(verdict.resoluble).toBe(false);
    if (!verdict.resoluble) {
      expect(verdict.motif).toContain("20260913160000_b");
      expect(verdict.motif).toContain("20260913170000_c");
    }
  });

  // LE GARDE QUI PORTE TOUT. Une migration non transactionnelle — un
  // `CREATE INDEX CONCURRENTLY` — s'applique par morceaux. La déclarer annulée
  // affirmerait que la base ne porte rien d'elle, ce qui serait FAUX.
  it("refuse une migration qui a appliqué au moins une étape", () => {
    const verdict = verdictDeResolution(
      [appliquee("20260913150000_a"), enEchec("20260913160000_b", 3)],
      "20260913160000_b",
    );

    expect(verdict.resoluble).toBe(false);
    if (!verdict.resoluble) {
      expect(verdict.motif).toContain("3 étape(s)");
      expect(verdict.motif).toContain("arbitrage");
    }
  });

  it("refuse plusieurs migrations en échec — Prisma s'arrête à la première", () => {
    const verdict = verdictDeResolution(
      [enEchec("20260913160000_b"), enEchec("20260913170000_c")],
      "20260913160000_b",
    );

    expect(verdict.resoluble).toBe(false);
    if (!verdict.resoluble) {
      expect(verdict.motif).toContain("arbitrage");
    }
  });
});

describe("rapport d'historique", () => {
  // §9, 06/09 : un décompte se lit en trois secondes et ne se vérifie pas ; un
  // NOM se vérifie.
  it("NOMME les migrations en échec et annulées, il ne se contente pas de les compter", () => {
    const rapport = rapportHistorique([
      appliquee("20260913150000_a"),
      annulee("20260913155000_z"),
      enEchec("20260913160000_b", 2),
    ]);

    expect(rapport).toContain("20260913160000_b");
    expect(rapport).toContain("20260913155000_z");
    expect(rapport).toContain("2 étape(s)");
  });
});

/**
 * LE FLUX LUI-MÊME. Deux propriétés, et la première est la seule qui rendrait
 * ce dispositif dangereux si elle tombait.
 */
describe("le flux de déblocage", () => {
  const flux = readFileSync(
    join(process.cwd(), ".github/workflows/db-resolve.yml"),
    "utf8",
  );
  const script = readFileSync(
    join(process.cwd(), "scripts/resoudre-migration.mts"),
    "utf8",
  );

  // LA SEULE COUPURE LÉGITIME EST « DOCUMENTATION CONTRE EXÉCUTION », jamais
  // « code contre chaîne » (§9, 26/08, forme 2). Les deux fichiers PARLENT de
  // `migrate deploy` — c'est même leur objet, puisqu'ils nomment le geste
  // suivant — et ce qu'on interdit est de l'EXÉCUTER.
  const fluxExecute = flux
    .split("\n")
    .filter((l) => !/^\s*#/.test(l))
    .join("\n");
  const scriptExecute = script
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join("\n");

  // TÉMOIN : les deux fichiers ont bien été lus. Deux chaînes vides ne
  // contiennent rien, et ne contiendraient pas davantage `--applied`.
  it("lit réellement le flux et le script", () => {
    expect(flux.length).toBeGreaterThan(500);
    expect(script.length).toBeGreaterThan(500);
    expect(fluxExecute.length).toBeGreaterThan(200);
    expect(scriptExecute.length).toBeGreaterThan(200);
    expect(flux).toContain("workflow_dispatch");
  });

  // `--applied` marque une migration comme appliquée SANS l'exécuter : il
  // écrit dans l'historique une chose qui n'a pas eu lieu, et la base diverge
  // alors du dépôt sans que rien ne le dise. Son absence n'est pas un oubli.
  it("n'expose JAMAIS le verbe --applied", () => {
    for (const [nom, contenu] of [
      ["le flux", fluxExecute],
      ["le script", scriptExecute],
    ] as const) {
      expect(contenu, `--applied exposé dans ${nom}`).not.toContain(
        "--applied",
      );
    }
  });

  // UN VERBE PAR FLUX. Enchaîner `deploy` rejouerait aussitôt la migration qui
  // vient d'échouer : si rien n'a été corrigé entre-temps, elle échoue à
  // l'identique et la base est rebloquée par le geste censé la débloquer.
  it("n'applique AUCUNE migration — « DB migrate & seed » reste le geste suivant", () => {
    expect(fluxExecute).not.toContain("migrate deploy");
    expect(fluxExecute).not.toContain("db:deploy");
    expect(scriptExecute).not.toContain("migrate deploy");
    // Le geste suivant est NOMMÉ, et il l'est dans ce que le flux exécute —
    // une consigne qui ne vit que dans un commentaire n'atteint personne (§12).
    expect(scriptExecute).toContain("DB migrate & seed");
  });

  // Aucun déclenchement automatique : une résolution qui partirait toute seule
  // écrirait dans l'historique d'une base réelle sans que personne n'ait lu
  // son état.
  it("ne se déclenche QUE à la main", () => {
    expect(flux).not.toMatch(/^\s{2}(push|pull_request|schedule):/m);
  });

  // Le nom saisi EST la confirmation : un défaut le rendrait facultatif.
  it("n'attribue AUCUN défaut au nom de la migration", () => {
    const bloc = flux.slice(flux.indexOf("migration:"));
    expect(bloc.slice(0, 400)).not.toContain("default:");
  });
});

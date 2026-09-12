import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RACINE } from "../outils/fichiers-source";

/**
 * DEUX BASES, ET LE SEED N'ATTEINT JAMAIS CELLE DE PRODUCTION.
 *
 * La note de mise en ligne promet que *« les données de démonstration ne
 * s'installent pas en production »*. Une promesse écrite dans une note n'est
 * pas une garantie : `db-migrate.yml` jouait `pnpm db:seed` **sans condition**,
 * et la seule chose qui protégeait la production était que ses secrets
 * n'existaient pas encore. **Une garantie qui tient à l'absence d'une valeur
 * cesse le jour où on la dépose** — et ce jour-là, personne ne relira le flux.
 *
 * L'entrée `cible` rend la promesse vraie ; ce gardien vérifie qu'elle le
 * reste. Il est statique et il l'annonce : il lit le fichier du flux, il ne
 * peut pas dire ce qu'un exécuteur fera.
 */
const FLUX = join(RACINE, ".github", "workflows", "db-migrate.yml");

/** Les étapes du flux, découpées sur leur tiret de tête. */
function etapes(): string[] {
  const sql = readFileSync(FLUX, "utf8");
  const debut = sql.indexOf("    steps:");
  expect(
    debut,
    "le flux ne porte plus d'étapes : rien n'est mesuré",
  ).toBeGreaterThan(0);
  return sql
    .slice(debut)
    .split(/\n      - /)
    .slice(1);
}

/** L'étape dont la commande contient ce fragment. */
function etapeQuiJoue(fragment: string): string {
  const trouvees = etapes().filter((e) => e.includes(fragment));
  // TÉMOIN : zéro étape trouvée rendrait toute assertion ci-dessous vide.
  expect(
    trouvees.length,
    `aucune étape ne joue « ${fragment} » : le gardien ne mesure rien`,
  ).toBe(1);
  return trouvees[0] ?? "";
}

describe("le seed n'atteint jamais la base de production (db-migrate.yml)", () => {
  it("le flux offre le choix de la cible, et la démonstration est le défaut", () => {
    const sql = readFileSync(FLUX, "utf8");
    expect(sql).toContain("cible:");
    expect(sql).toContain("default: demonstration");
    expect(sql).toContain("- production");
  });

  /*
   * ── L'ANCRE A CHANGÉ LE 12/09/2026, LA PROPRIÉTÉ NON (D116) ──────────────
   *
   * Ces deux scénarios lisaient `inputs.cible != 'production'`. Depuis
   * l'amendement du §12, la cible est DÉCIDÉE une fois — `inputs.cible` vaut la
   * chaîne vide sur un déclenchement automatique — et les étapes lisent sa
   * sortie. *Ce n'est pas un test assoupli pour faire passer la vérification :
   * la propriété gardée est la même, et elle est même plus forte* — une étape
   * restée sur l'entrée brute se comporterait comme si la cible était vide, ce
   * que la borne 1 de `migration-automatique.test.ts` refuse séparément.
   */
  it("l'étape de seed est conditionnée à une cible qui n'est pas la production", () => {
    expect(etapeQuiJoue("pnpm db:seed")).toContain(
      "steps.cible.outputs.cible != 'production'",
    );
  });

  it("la purge de démonstration l'est aussi", () => {
    expect(etapeQuiJoue("purge-demonstration.mts")).toContain(
      "steps.cible.outputs.cible != 'production'",
    );
  });

  it("la migration, elle, N'EST PAS conditionnée par la CIBLE — le vert doit être mérité", () => {
    // Le cas qui doit rester vert pour sa propre raison (§9, 11/09) : migrer
    // est précisément ce que la production attend de ce flux. Un gardien qui
    // exigerait la condition sur toutes les étapes serait vert aussi, et il
    // décrirait un flux inutilisable.
    expect(etapeQuiJoue("run: pnpm prisma migrate deploy")).not.toContain(
      "steps.cible.outputs.cible",
    );
  });

  it("aucune EXPRESSION ne choisit un secret — le choix est dans un shell", () => {
    // La faute, écrite puis mesurée le 09/09/2026 : `inputs.cible ==
    // 'production' && secrets.PRODUCTION_… || secrets.…` a l'air d'un ternaire
    // et n'en est pas un quand la première valeur est VIDE — `&&` rend la
    // chaîne vide, `||` rend la seconde, et un secret de production absent fait
    // migrer LA DÉMONSTRATION sans que rien ne soit vide ni ne le dise.
    const sql = readFileSync(FLUX, "utf8");
    const executables = sql
      .split("\n")
      .filter((l) => !l.trim().startsWith("#") && l.includes("secrets."));
    // TÉMOIN : zéro ligne exposant un secret rendrait l'assertion vide.
    expect(executables.length).toBeGreaterThanOrEqual(4);
    for (const ligne of executables) {
      expect(
        ligne,
        "un secret ne se choisit pas dans une expression",
      ).not.toContain("||");
    }
    expect(sql).toContain("refuser plutôt que se rabattre");
  });
});

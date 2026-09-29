import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { sansCommentaires } from "../outils/fichiers-source";

/**
 * L'ÉCHELLE TYPOGRAPHIQUE (TP-UX1-1, D138) — huit tailles, LUES à la
 * spécification `ergonomie-graphisme-usage-2026-09-28.md` §3.2 :217-228 : 12,
 * 13, 14, 15, 16, 18, 24, 28 px. Aucune valeur inventée ici : ce gardien
 * confronte `app/globals.css` à cette liste, jamais l'inverse.
 *
 * Deux garanties de plus, dans le même fichier parce qu'elles touchent le
 * même bloc de style :
 * - aucun jeton de COULEUR (`--app-…`/`--color-app-…`) n'est ajouté par ce
 *   ticket — comptés avant (40 de chaque) et confrontés ici ;
 * - une règle de focus visible existe (spec §3.9 :317).
 */

const STYLE = sansCommentaires(
  readFileSync(join(process.cwd(), "app/globals.css"), "utf8"),
);

/** Les huit tailles de la spec §3.2 :221-227, dans l'ordre du document. */
const ECHELLE = [12, 13, 14, 15, 16, 18, 24, 28] as const;

/** Les noms de taille que Tailwind 4 déclare par défaut — jamais à redéfinir. */
const NOMS_TAILWIND_PAR_DEFAUT = [
  "xs",
  "sm",
  "base",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "6xl",
  "7xl",
  "8xl",
  "9xl",
];

function blocTheme(): string {
  const bloc = /@theme\s+inline\s*\{([\s\S]*?)\n\}/.exec(STYLE);
  if (bloc === null) {
    throw new Error(
      "le bloc `@theme inline` est introuvable dans app/globals.css — " +
        "le fichier a changé de forme, et ce gardien ne mesure plus rien",
    );
  }
  return bloc[1];
}

/** Les `--text-…` réellement déclarés dans `@theme inline`. */
function taillesDeclarees(): Map<string, string> {
  const declarations = new Map<string, string>();
  for (const m of blocTheme().matchAll(/--text-([a-z0-9]+)\s*:\s*([^;]+);/g)) {
    declarations.set(m[1], m[2].trim());
  }
  return declarations;
}

describe("l'échelle typographique (TP-UX1-1, D138)", () => {
  it("a réellement lu le bloc `@theme inline` — le témoin de non-vacuité", () => {
    expect(blocTheme().length).toBeGreaterThan(0);
  });

  it("déclare exactement les huit tailles de la spec §3.2, en pixels", () => {
    const declarees = taillesDeclarees();
    for (const taille of ECHELLE) {
      expect(declarees.get(String(taille)), `--text-${taille}`).toBe(
        `${taille}px`,
      );
    }
  });

  it("ne déclare AUCUNE taille hors des huit de la spec", () => {
    const noms = [...taillesDeclarees().keys()]
      .map(Number)
      .sort((a, b) => a - b);
    expect(noms).toEqual([...ECHELLE]);
  });

  it("ne redéfinit aucun nom de l'échelle Tailwind par défaut", () => {
    const noms = new Set(taillesDeclarees().keys());
    const collisions = NOMS_TAILWIND_PAR_DEFAUT.filter((nom) => noms.has(nom));
    expect(collisions).toEqual([]);
  });

  it("n'ajoute aucun jeton de couleur — 40 `--app-…`, 40 `--color-app-…`, comme avant ce ticket", () => {
    const app = new Set(STYLE.match(/--app-[a-z0-9-]+/g) ?? []);
    const colorApp = new Set(STYLE.match(/--color-app-[a-z0-9-]+/g) ?? []);
    expect(app.size).toBe(40);
    expect(colorApp.size).toBe(40);
  });

  it("pose une règle de focus visible (spec §3.9 :317, anneau de 3 px)", () => {
    expect(STYLE).toMatch(/:focus-visible\s*\{[^}]*3px[^}]*var\(--ring/);
  });
});

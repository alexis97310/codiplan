import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { sansCommentaires } from "../outils/fichiers-source";

/**
 * L'ANNEAU DE FOCUS SUR LA BARRE SOMBRE (décision d'Alexis du 30/09/2026,
 * « laissé au pilote » ; D144).
 *
 * `--ring`/`--ring-focus` sont déclarés SEULEMENT à `:root` (qui matche
 * `<html>`), alors que `data-apparence` — et les jetons du chrome qu'il
 * commande — est posé sur `<body>` (`app/layout.tsx`) : l'anneau général ne
 * suit donc PAS le thème de la colonne de navigation, et reste calé sur la
 * valeur de `--app-marque` vue à `:root`. Ce gardien MODÉLISE cette cascade —
 * en résolvant les jetons des DEUX thèmes déclarés séparément, `var()`
 * compris — plutôt que de la supposer, et calcule le contraste WCAG réel.
 */

const STYLE = sansCommentaires(
  readFileSync(join(process.cwd(), "app/globals.css"), "utf8"),
);
const BARRE = readFileSync(
  join(process.cwd(), "components/navigation/barre.tsx"),
  "utf8",
);

/** Le contenu `{ … }` d'un sélecteur EXACT — jamais un autre bloc du même fichier. */
function bloc(selecteur: string): string {
  const debut = STYLE.indexOf(`${selecteur} {`);
  if (debut === -1) {
    throw new Error(`le bloc ${selecteur} est introuvable dans globals.css`);
  }
  const fin = STYLE.indexOf("\n}", debut);
  if (fin === -1) {
    throw new Error(`la fin du bloc ${selecteur} est introuvable`);
  }
  return STYLE.slice(debut, fin);
}

/** Les jetons `--nom: valeur;` d'un bloc, à plat. */
function jetons(texteBloc: string): Map<string, string> {
  const table = new Map<string, string>();
  for (const m of texteBloc.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    table.set(m[1], m[2].trim());
  }
  return table;
}

/** Résout un `var(--x)` contre la table du MÊME bloc — jamais contre une autre. */
function resoudre(valeur: string, table: Map<string, string>): string {
  const m = /^var\(--([a-z0-9-]+)\)$/.exec(valeur);
  if (m === null) {
    return valeur;
  }
  const suivante = table.get(m[1]);
  if (suivante === undefined) {
    throw new Error(`le jeton --${m[1]} est introuvable dans ce bloc`);
  }
  return resoudre(suivante, table);
}

function hexVersRgb(hex: string): readonly [number, number, number] {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (m === null) {
    throw new Error(`couleur non hexadécimale à 6 chiffres : ${hex}`);
  }
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Luminance relative WCAG (sRGB, IEC 61966-2-1). */
function luminance([r, g, b]: readonly [number, number, number]): number {
  const canal = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Contraste WCAG 2.x entre deux couleurs hexadécimales. */
function contrasteWcag(hexA: string, hexB: string): number {
  const lA = luminance(hexVersRgb(hexA));
  const lB = luminance(hexVersRgb(hexB));
  const [clair, sombre] = lA > lB ? [lA, lB] : [lB, lA];
  return (clair + 0.05) / (sombre + 0.05);
}

const RACINE = jetons(bloc(":root"));
const MAQUETTE = jetons(bloc('[data-apparence="maquette"]'));
const TABLEAU = jetons(bloc('[data-apparence="tableau"]'));

describe("l'anneau de focus de la barre sombre (décision du 30/09/2026 ; D144)", () => {
  it("a réellement lu les trois blocs — le témoin de non-vacuité", () => {
    expect(RACINE.size).toBeGreaterThan(0);
    expect(MAQUETTE.size).toBeGreaterThan(0);
    expect(TABLEAU.size).toBeGreaterThan(0);
  });

  it("« --ring » est déclaré SEULEMENT à `:root`, jamais réécrit par un thème — la raison du constat", () => {
    expect(RACINE.get("ring")).toBe("var(--app-marque)");
    expect(MAQUETTE.has("ring")).toBe(false);
    expect(TABLEAU.has("ring")).toBe(false);
  });

  it("ÉPREUVE — `--app-marque` contre `--app-chrome-fond` est SOUS 3:1 (la raison du ticket)", () => {
    const marque = resoudre(MAQUETTE.get("app-marque")!, MAQUETTE);
    const chromeFond = resoudre(MAQUETTE.get("app-chrome-fond")!, MAQUETTE);
    expect(contrasteWcag(marque, chromeFond)).toBeLessThan(3);
  });

  it.each([["maquette", MAQUETTE] as const, ["tableau", TABLEAU] as const])(
    "thème « %s » — `--app-chrome-lien` tient AU-DESSUS de 3:1 contre le fond ET l'entrée active de la barre",
    (_nom, table) => {
      const lien = resoudre(table.get("app-chrome-lien")!, table);
      const fond = resoudre(table.get("app-chrome-fond")!, table);
      const actif = resoudre(table.get("app-chrome-actif")!, table);
      expect(contrasteWcag(lien, fond)).toBeGreaterThanOrEqual(3);
      expect(contrasteWcag(lien, actif)).toBeGreaterThanOrEqual(3);
    },
  );

  it("la règle `[data-chrome] :focus-visible` existe, à 3 px, avec `--app-chrome-lien`", () => {
    const motif =
      /\[data-chrome\]\s*:focus-visible\s*\{[^}]*box-shadow:\s*0 0 0 3px var\(--app-chrome-lien\)[^}]*\}/;
    expect(STYLE).toMatch(motif);
  });

  it("aucun décalage (offset) — toujours `0 0 0 3px`", () => {
    const trouve = /\[data-chrome\]\s*:focus-visible\s*\{([^}]*)\}/.exec(STYLE);
    expect(trouve).not.toBeNull();
    expect(trouve![1]).toContain("0 0 0 3px");
  });

  it("`components/navigation/barre.tsx` pose `data-chrome` sur la colonne (l'`<aside>`)", () => {
    expect(BARRE).toMatch(/<aside[^>]*\bdata-chrome\b/);
  });
});

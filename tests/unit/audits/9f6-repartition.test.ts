import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * LA RÉPARTITION EN 8 PAQUETS (point 4 du ticket 9F6A-DOSSIER-AUDIT-8-AGENTS)
 * — chaque écran du dossier d'audit dans EXACTEMENT un paquet, jamais zéro,
 * jamais deux. L'épreuve lit `index.json`, le fichier que `pnpm audit:visuel`
 * écrit réellement (`tests/audit-visuel/dossier.ts`) — jamais une liste
 * recopiée à la main, qui diverge du dossier en silence.
 */

const FICHIER_INDEX = join(process.cwd(), "docs/audits/9F6/index.json");

const PAQUETS_CONNUS: readonly string[] = [
  "P1 — Accès et sans session",
  "P2 — Pilotage",
  "P3 — Planning",
  "P4 — Demandes et registre",
  "P5 — Fiches intervention et bon",
  "P6 — Clients, sites, parc, VGP",
  "P7 — Paramètres et imports",
  "P8 — Terrain",
];

type EntreeIndex = { readonly cle: string; readonly paquet: string };

describe("9F6 — répartition en 8 paquets", () => {
  it("le dossier existe — sinon ce gardien ne prouve rien", () => {
    expect(existsSync(FICHIER_INDEX)).toBe(true);
  });

  if (!existsSync(FICHIER_INDEX)) return;

  const entrees = JSON.parse(readFileSync(FICHIER_INDEX, "utf-8")) as EntreeIndex[];

  it("porte au moins un écran", () => {
    expect(entrees.length).toBeGreaterThan(0);
  });

  it("chaque écran a une clé UNIQUE — sinon un paquet compterait deux fois le même écran", () => {
    const cles = entrees.map((e) => e.cle);
    expect(new Set(cles).size).toBe(cles.length);
  });

  it("chaque écran porte EXACTEMENT un paquet connu de la liste close", () => {
    const horsListe = entrees.filter((e) => !PAQUETS_CONNUS.includes(e.paquet));
    expect(horsListe.map((e) => `${e.cle} → ${e.paquet}`)).toEqual([]);
  });

  it("tous les paquets déclarés sont utilisés au moins une fois", () => {
    const utilises = new Set(entrees.map((e) => e.paquet));
    const inutilises = PAQUETS_CONNUS.filter((p) => !utilises.has(p));
    expect(inutilises).toEqual([]);
  });

  it("la somme des paquets égale le total des écrans", () => {
    const parPaquet = new Map<string, number>();
    for (const e of entrees) {
      parPaquet.set(e.paquet, (parPaquet.get(e.paquet) ?? 0) + 1);
    }
    const somme = [...parPaquet.values()].reduce((a, b) => a + b, 0);
    expect(somme).toBe(entrees.length);
  });
});

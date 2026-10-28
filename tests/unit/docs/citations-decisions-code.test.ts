import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  analyserCitationsCode,
  type Fichier,
} from "../../../scripts/lib/citations-decisions-code";

/**
 * Ticket 9I3 — audit équipe du 28/10/2026 (constats M2 « D127 », M3 « huit
 * renvois égarés », C3/C4/C5 du rapport détaillé).
 *
 * Trois gardiens tenaient déjà qu'une référence `Dxx` s'adosse à une décision
 * réelle : `amendements-arbitrages`, `cablage-arbitrages`, `coherence-backlog`.
 * Tous les trois ne lisent que des DOCUMENTS entre eux — jamais `app/`,
 * `components/`, `lib/`, `tests/`, `scripts/`. C'est exactement là que D127 a
 * vécu 33 citations dans 16 fichiers sans jamais avoir de titre au registre,
 * et là que D80 a survécu dans 4 fichiers après que le registre eut déclaré
 * DEUX FOIS qu'il n'existe pas. Ce gardien est la population qui manquait,
 * jamais un remplacement des trois autres.
 *
 * LA POPULATION est DÉRIVÉE du dépôt (`git ls-files`), pas d'une liste à
 * tenir à jour — même précaution que les gardiens voisins (§9, 31/08).
 */

const racine = process.cwd();
const ARBITRAGES = readFileSync(join(racine, "docs/arbitrages.md"), "utf8");

const DOSSIERS = ["app", "components", "lib", "tests", "scripts"];
const EXTENSIONS_DE_PROSE = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".sql",
  ".md",
  ".css",
]);

function fichiersSuivis(): readonly Fichier[] {
  const sortie = execSync(`git ls-files ${DOSSIERS.join(" ")}`, {
    cwd: racine,
    encoding: "utf8",
  });
  return sortie
    .split("\n")
    .filter((chemin) => chemin.trim().length > 0)
    .filter((chemin) =>
      EXTENSIONS_DE_PROSE.has(chemin.slice(chemin.lastIndexOf("."))),
    )
    .map((chemin) => ({
      chemin,
      contenu: readFileSync(join(racine, chemin), "utf8"),
    }));
}

const FICHIERS = fichiersSuivis();

/** Planchers — même mécanique que les gardiens voisins, ils ne se baissent jamais. */
const PLANCHER_FICHIERS = 1000;
const PLANCHER_CITATIONS = 3000;
const PLANCHER_TITRES = 150;

describe("citations de décisions dans le CODE : toute référence Dxx nue résout vers une décision réelle", () => {
  const analyse = analyserCitationsCode(ARBITRAGES, FICHIERS);

  it("a réellement lu des fichiers, des citations et des titres de décision", () => {
    expect(FICHIERS.length).toBeGreaterThanOrEqual(PLANCHER_FICHIERS);
    expect(analyse.citations.length).toBeGreaterThanOrEqual(PLANCHER_CITATIONS);
    expect(analyse.titresConnus.length).toBeGreaterThanOrEqual(PLANCHER_TITRES);
  });

  it("n'observe aucun écart sur le dépôt actuel", () => {
    expect(analyse.ecarts, analyse.ecarts.join("\n")).toEqual([]);
  });

  it("D127 a désormais un titre, et les citations réelles le résolvent", () => {
    expect(analyse.titresConnus).toContain("D127");
    const d127 = analyse.citations.filter((c) => c.citation === "D127");
    expect(d127.length).toBeGreaterThan(0);
    expect(d127.every((c) => c.connue)).toBe(true);
  });

  it("D80 n'a aucune citation NUE restante — corrigées vers D204 (le vrai renvoi)", () => {
    const bare = analyse.citations.filter(
      (c) => c.citation === "D80" && !c.qualifiee,
    );
    expect(bare).toEqual([]);
  });
});

/**
 * Les jumeaux. Chaque refus est écrit sur un fichier FABRIQUÉ pour l'épreuve,
 * jamais sur le dépôt — montrer que le gardien rougit avant de le déclarer bon.
 */
describe("jumeaux — le gardien mord sur une citation fabriquée, jamais sur le dépôt réel", () => {
  it("refuse une référence Dxx nue qui ne résout vers aucune décision", () => {
    const fabrique: Fichier = {
      chemin: "lib/fabrique-pour-l-epreuve.ts",
      contenu: "// une note qui cite D999, jamais écrite au registre\n",
    };
    const analyse = analyserCitationsCode(ARBITRAGES, [fabrique]);
    expect(analyse.ecarts).toContain(
      "lib/fabrique-pour-l-epreuve.ts:1 cite D999, qui n'existe pas dans docs/arbitrages.md",
    );
  });

  it("accepte la même référence sous sa forme qualifiée « d'Alexis »", () => {
    const fabrique: Fichier = {
      chemin: "lib/fabrique-pour-l-epreuve.ts",
      contenu: "// une note qui cite D999 d'Alexis, jamais écrite au registre\n",
    };
    expect(analyserCitationsCode(ARBITRAGES, [fabrique]).ecarts).toEqual([]);
  });

  it("accepte « décision N d'Alexis » écrit en toutes lettres, puis repris en DN dans le MÊME paragraphe", () => {
    const fabrique: Fichier = {
      chemin: "lib/fabrique-pour-l-epreuve.ts",
      contenu:
        "// la décision 999 d'Alexis du 18/09/2026 (D999) règle ce point précis\n",
    };
    expect(analyserCitationsCode(ARBITRAGES, [fabrique]).ecarts).toEqual([]);
  });

  it("refuse une citation qualifiée dans un AUTRE paragraphe — le qualifiant ne voyage pas (C5)", () => {
    const fabrique: Fichier = {
      chemin: "lib/fabrique-pour-l-epreuve.ts",
      contenu: [
        "// la décision 999 d'Alexis du 18/09/2026 règle ce point précis",
        "",
        "// DEPUIS D999 (un second bloc, le qualifiant ne le couvre plus)",
      ].join("\n"),
    };
    const analyse = analyserCitationsCode(ARBITRAGES, [fabrique]);
    expect(analyse.ecarts).toContain(
      "lib/fabrique-pour-l-epreuve.ts:3 cite D999, qui n'existe pas dans docs/arbitrages.md",
    );
  });

  it("accepte une référence qui résout vers une décision réellement écrite", () => {
    const fabrique: Fichier = {
      chemin: "lib/fabrique-pour-l-epreuve.ts",
      contenu: "// cf. D1, la hiérarchie des sources\n",
    };
    expect(analyserCitationsCode(ARBITRAGES, [fabrique]).ecarts).toEqual([]);
  });

  it("ignore une valeur de DONNÉE qui ressemble à une citation — jamais un commentaire", () => {
    // Mesuré sur le dépôt réel : `tests/isolation/machine.test.ts` ("SN-D07")
    // et `tests/unit/excel/fixture-dates.test.ts` ("D533") — un numéro de
    // série et une référence de cellule, aucun rapport avec une décision.
    const fabrique: Fichier = {
      chemin: "lib/fabrique-pour-l-epreuve.ts",
      contenu: 'const serie = "SN-D999";\n',
    };
    expect(analyserCitationsCode(ARBITRAGES, [fabrique]).ecarts).toEqual([]);
  });

  it("lit la prose entière d'un fichier `.md`, hors de toute syntaxe de commentaire", () => {
    const fabrique: Fichier = {
      chemin: "docs-fabrique.md",
      contenu: "Ce paragraphe cite D999 sans aucun marqueur de commentaire.\n",
    };
    const analyse = analyserCitationsCode(ARBITRAGES, [fabrique]);
    expect(analyse.ecarts).toContain(
      "docs-fabrique.md:1 cite D999, qui n'existe pas dans docs/arbitrages.md",
    );
  });

  it("échoue sur zéro titre connu plutôt que de passer pour un sans-faute", () => {
    const analyse = analyserCitationsCode("# vide\n", []);
    expect(analyse.titresConnus).toEqual([]);
    expect(analyse.titresConnus.length).toBeLessThan(PLANCHER_TITRES);
  });
});

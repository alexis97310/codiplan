import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RACINE } from "../outils/fichiers-source";

/**
 * DURCISSEMENT DES FLUX QUI PORTENT LA CHAÎNE DE PRODUCTION (9L22-CI-DURCIE,
 * décision d'Alexis du 10/11/2026).
 *
 * Statique, et il l'annonce : il lit le fichier du flux, il ne peut pas dire
 * ce qu'un exécuteur fera. Trois propriétés, sur les quatre flux qui migrent,
 * amorcent ou résolvent une base réelle :
 *
 *   1. toute action tierce (`uses: owner/repo@…`) est épinglée par empreinte
 *      de commit (40 caractères hexadécimaux), jamais par un nom de version
 *      mobile (`@v5`) — la version lisible reste en commentaire ;
 *   3. chaque flux porte un bloc `permissions:` qui ne concède AUCUN droit
 *      d'écriture ;
 *   5. le flux « Ouvrir le PREMIER compte » refuse une entrée « base » qui ne
 *      commence pas par `https://`, et la mesure est COMPORTEMENTALE : le
 *      fragment de shell réel du flux est extrait et exécuté.
 */
const FICHIERS = [
  "db-migrate.yml",
  "premier-compte.yml",
  "amorcage-base.yml",
  "db-resolve.yml",
] as const;

function flux(nom: string): string {
  const texte = readFileSync(
    join(RACINE, ".github", "workflows", nom),
    "utf8",
  );
  expect(
    texte.length,
    `${nom} est vide ou introuvable : le gardien ne mesure rien`,
  ).toBeGreaterThan(500);
  return texte;
}

describe.each(FICHIERS)(
  "chaque action tierce est épinglée par empreinte de commit — %s",
  (nom) => {
    it("aucun « uses: » ne porte un nom de version mobile", () => {
      const texte = flux(nom);
      const usages = [...texte.matchAll(/^\s*- uses: (\S+)@(\S+)/gm)];
      expect(usages.length, "aucune action tierce trouvée").toBeGreaterThan(
        0,
      );
      for (const [, action, reference] of usages) {
        expect(
          reference,
          `« ${action} » n'est pas épinglée par une empreinte de commit (référence : ${reference})`,
        ).toMatch(/^[0-9a-f]{40}$/);
      }
    });

    it("chaque référence porte la version lisible en commentaire", () => {
      const texte = flux(nom);
      const lignes = texte
        .split("\n")
        .filter((ligne) => /^\s*- uses: \S+@[0-9a-f]{40}/.test(ligne));
      expect(lignes.length).toBeGreaterThan(0);
      for (const ligne of lignes) {
        expect(
          ligne,
          `pas de version en commentaire sur : ${ligne}`,
        ).toMatch(/#\s*v\d+(\.\d+)*\s*$/);
      }
    });
  },
);

describe.each(FICHIERS)(
  "bloc `permissions:` minimal, sans aucun droit d'écriture — %s",
  (nom) => {
    it("porte un bloc permissions qui ne concède que des lectures", () => {
      const texte = flux(nom);
      // La clé YAML réelle, jamais sa mention dans un commentaire (ce flux en
      // porte une, entre apostrophes inverses) : une ligne faite EXACTEMENT
      // de « permissions: », espaces de tête mis à part.
      const correspondance = /^([ \t]*)permissions:[ \t]*$/m.exec(texte);
      expect(
        correspondance,
        "aucun bloc « permissions: » dans ce flux",
      ).not.toBeNull();
      const debut = correspondance?.index ?? -1;
      const indentation = correspondance?.[1]?.length ?? 0;
      const suite = texte.slice(debut).split("\n").slice(1);
      const corps: string[] = [];
      for (const ligne of suite) {
        if (ligne.trim().length === 0) continue;
        const indentationLigne = ligne.length - ligne.trimStart().length;
        if (indentationLigne <= indentation) break;
        corps.push(ligne);
      }
      expect(
        corps.length,
        "le bloc « permissions: » est vide : rien n'est restreint",
      ).toBeGreaterThan(0);
      const bloc = corps.join("\n");
      expect(bloc).toContain("contents: read");
      expect(bloc, "un droit d'écriture est concédé").not.toContain("write");
    });
  },
);

/**
 * BORNE DE FORME (point 5) — ÉPROUVÉE EN EXÉCUTANT LE FRAGMENT RÉEL.
 *
 * Une mesure de texte (« le flux contient la chaîne https:// ») passerait sur
 * un commentaire qui en PARLE sans rien refuser. Le fragment de shell de
 * l'étape est donc extrait du flux et JOUÉ, avec une entrée fabriquée, sous
 * `bash -c` — la même interprétation que l'exécuteur GitHub.
 */
describe("premier-compte.yml refuse une « base » qui ne commence pas par https://", () => {
  function fragment(): string {
    const texte = flux("premier-compte.yml");
    const debut = texte.indexOf(
      "- name: Refuser une base qui ne commence pas par https://",
    );
    expect(debut, "l'étape de refus n'existe pas").toBeGreaterThan(-1);
    const run = texte.indexOf("run: |", debut);
    const finEtape = texte.indexOf("\n      - ", run);
    expect(run).toBeGreaterThan(debut);
    expect(finEtape).toBeGreaterThan(run);
    // Les lignes du bloc `run: |`, désindentées d'autant que la première.
    const brut = texte.slice(run + "run: |".length, finEtape);
    const lignes = brut.split("\n").filter((l) => l.trim().length > 0);
    const indentation = Math.min(
      ...lignes.map((l) => l.length - l.trimStart().length),
    );
    return lignes.map((l) => l.slice(indentation)).join("\n");
  }

  function jouer(base: string): number {
    const resultat = spawnSync("bash", ["-c", fragment()], {
      env: { ...process.env, BASE: base },
      encoding: "utf8",
    });
    expect(resultat.error, "bash n'a pas pu être lancé").toBeUndefined();
    return resultat.status ?? -1;
  }

  it("accepte une URL https://", () => {
    expect(jouer("https://codiplan.example.com")).toBe(0);
  });

  it("refuse http:// (non chiffré)", () => {
    expect(jouer("http://codiplan.example.com")).not.toBe(0);
  });

  it("refuse une chaîne qui n'est pas une URL", () => {
    expect(jouer("pas une url")).not.toBe(0);
  });

  it("refuse une entrée vide", () => {
    expect(jouer("")).not.toBe(0);
  });
});

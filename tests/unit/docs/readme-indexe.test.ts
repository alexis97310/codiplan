import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { entreesDuSommaire, titresDuCorps } from "../../../scripts/lib/sommaires";

/**
 * Gardien du SOMMAIRE de `README.md` — DOC-2, 23/09/2026.
 *
 * **Pourquoi il existe.** README.md pèse 1 867 lignes / 214 Ko (mesuré sur
 * `main` le 23/09/2026) — le plus gros document du dépôt, et le seul que
 * DOC-1 (22/09/2026) a explicitement laissé de côté (« README.md non touché »,
 * territoire limité à `docs/constitution/`). Sans sommaire, une session qui
 * cherche une règle précise n'a pas d'autre choix que de charger les
 * 214 Ko entiers.
 *
 * **Même forme que `docs/constitution/erreurs-a-ne-pas-refaire.md`** (voir
 * `tests/unit/docs/constitution-indexee.test.ts`, description « DEUX
 * FORMES ») : un sommaire à TITRES, à plat, dans l'ordre du document — README
 * n'a pas la contrainte du bloc de code unique qui a forcé
 * `organisation-du-code.md` vers un sommaire par ligne. Les niveaux indexés
 * sont `##`/`###` (et non `###`/`####` comme dans le fichier voisin) parce que
 * c'est à CES deux niveaux que README structure son contenu — `#` n'apparaît
 * qu'une fois, pour le titre du document lui-même, et n'est pas une entrée de
 * navigation.
 *
 * **LES DEUX SENS SONT GARDÉS**, exactement comme pour les fichiers de
 * `docs/constitution/` : un titre du corps sans entrée de sommaire est
 * orphelin, une entrée de sommaire sans titre réel est un fantôme. La logique
 * de lecture (`titresDuCorps`, `entreesDuSommaire`) est IMPORTÉE de
 * `scripts/lib/sommaires.ts` — la même que le gardien voisin et que
 * `scripts/regenerer-sommaires.mts` : une seule implémentation, jamais deux
 * lectures d'un même critère.
 */

const RACINE = process.cwd();
const MARQUEUR = "## Sommaire";
const NIVEAUX: [number, number] = [2, 3];

function corps(texte: string): string[] {
  return titresDuCorps(texte, MARQUEUR, NIVEAUX);
}

function sommaire(texte: string): string[] {
  return entreesDuSommaire(texte, MARQUEUR);
}

describe("README.md porte un sommaire, et il s'accorde au corps dans les deux sens (DOC-2)", () => {
  const texte = readFileSync(join(RACINE, "README.md"), "utf8");

  it("README dépasse le seuil de navigabilité — sinon la règle ne s'exerce sur rien", () => {
    // Le seuil de 250 lignes est celui que DOC-1 a mesuré et posé pour
    // `docs/constitution/` ; README (1 867 lignes) le dépasse d'un ordre de
    // grandeur, et n'a besoin d'aucun ajustement du seuil pour l'exiger.
    expect(texte.split("\n").length).toBeGreaterThan(250);
  });

  it("README porte « ## Sommaire »", () => {
    expect(texte).toContain(MARQUEUR);
  });

  it("le sommaire n'est pas vide", () => {
    expect(sommaire(texte).length).toBeGreaterThan(0);
  });

  it("aucun titre du corps n'est orphelin du sommaire", () => {
    const orphelins = corps(texte).filter((t) => !sommaire(texte).includes(t));
    expect(
      orphelins,
      `absents du sommaire — ${orphelins.join(" / ")}`,
    ).toEqual([]);
  });

  it("aucune entrée du sommaire ne pointe dans le vide", () => {
    const fantomes = sommaire(texte).filter((e) => !corps(texte).includes(e));
    expect(
      fantomes,
      `le sommaire pointe dans le vide — ${fantomes.join(" / ")}`,
    ).toEqual([]);
  });
});

describe("ÉPREUVE — le sommaire de README.md et le corps divergent (DOC-2)", () => {
  const texte = readFileSync(join(RACINE, "README.md"), "utf8");
  const premierTitre = corps(texte)[0] ?? "";

  it("population non vide, sinon l'épreuve ne mettrait rien à l'échec", () => {
    expect(premierTitre.length).toBeGreaterThan(0);
  });

  it("un titre retiré du corps est vu comme orphelin du sommaire", () => {
    // On met en échec le VERROU visé, pas un voisin : seule la ligne de titre
    // disparaît, le paragraphe qui suit reste intact.
    const mutant = texte.replace(`## ${premierTitre}\n`, "");
    expect(mutant).not.toEqual(texte);

    const titres = corps(mutant);
    const entrees = sommaire(mutant);
    expect(entrees.filter((e) => !titres.includes(e))).toEqual([premierTitre]);
  });

  it("une entrée ajoutée au sommaire sans titre réel est vue comme fantôme", () => {
    const mutant = texte.replace(
      "## Sommaire\n\n- ",
      "## Sommaire\n\n- UN TITRE QUI N'EXISTE NULLE PART\n- ",
    );
    expect(mutant).not.toEqual(texte);

    const titres = corps(mutant);
    const entrees = sommaire(mutant);
    expect(entrees.filter((e) => !titres.includes(e))).toEqual([
      "UN TITRE QUI N'EXISTE NULLE PART",
    ]);
  });

  it("ET IL RESTE VERT POUR SA PROPRE RAISON — sur le fichier réel, non modifié", () => {
    const titres = corps(texte);
    const entrees = sommaire(texte);
    expect(titres.filter((t) => !entrees.includes(t))).toEqual([]);
    expect(entrees.filter((e) => !titres.includes(e))).toEqual([]);
  });
});

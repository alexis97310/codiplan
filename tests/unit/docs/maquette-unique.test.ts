import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * LA MAQUETTE N'EXISTE QU'EN UN EXEMPLAIRE (D95, hygiène du 11/09/2026).
 *
 * Depuis D95 elle fait foi sur la disposition et sur les couleurs ; deux
 * gardiens la lisent — la barre de navigation et les jetons d'apparence — et
 * l'annexe C s'y adosse. *Une source qui fait foi en deux exemplaires n'est
 * plus une source* : le jour où l'un des deux bouge, rien ne le dit, et chacun
 * des deux lecteurs a raison sur le sien.
 *
 * **Elle a réellement vécu en double quelques heures**, le 11/09/2026 —
 * `docs/CODIPLAN_Maquette.html` et `docs/maquette/CODIPLAN_Maquette.html`,
 * `cmp` muet, même empreinte MD5. Les deux gardiens lisaient le premier, le
 * `CLAUDE.md` citait le second. *Rien n'était faux, et rien ne serait resté
 * vrai.*
 *
 * C'est la classe du §9 (01/09) — *une liste close recopiée « pour la
 * lisibilité » devient fausse le jour où la première grandit, sans rougir* —
 * appliquée à un document entier plutôt qu'à une liste.
 */

const DOCS = join(process.cwd(), "docs");
const NOM = "CODIPLAN_Maquette.html";

/** Tous les chemins portant ce nom, sous `docs/`, à n'importe quelle profondeur. */
function exemplaires(racine: string, prefixe = ""): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(racine)) {
    const chemin = join(racine, entree);
    const relatif = prefixe === "" ? entree : `${prefixe}/${entree}`;
    if (statSync(chemin).isDirectory()) {
      trouves.push(...exemplaires(chemin, relatif));
    } else if (entree === NOM) {
      trouves.push(`docs/${relatif}`);
    }
  }
  return trouves;
}

describe("la maquette, source de rang 1 depuis D95, n'a qu'un exemplaire", () => {
  it("un seul fichier porte ce nom sous `docs/`", () => {
    const trouves = exemplaires(DOCS);
    // Le témoin et l'assertion sont la même ligne : zéro exemplaire est aussi
    // un échec, et il le serait silencieusement si l'on ne comparait qu'à « au
    // plus un » — les deux gardiens qui la lisent lèveraient alors, mais un
    // jour plus tard et en parlant d'autre chose.
    expect(trouves, `exemplaires trouvés : ${trouves.join(", ")}`).toEqual([
      "docs/maquette/CODIPLAN_Maquette.html",
    ]);
  });

  it("et cet exemplaire porte bien une maquette — pas un fichier vide", () => {
    const contenu = readFileSync(
      join(DOCS, "maquette", NOM),
      "utf8",
    );
    expect(contenu).toContain('<div class="nav">');
    expect(contenu).toMatch(/:root\s*\{/);
  });

  it("aucun fichier du dépôt ne désigne l'ancien chemin", () => {
    // Le sens qu'on oublie : le doublon supprimé, une référence restée sur
    // l'ancien chemin fait échouer un gardien avec un message de fichier
    // absent, à trois modules de là. Ce scénario nomme la cause tout de suite.
    const suspects = [
      "CLAUDE.md",
      "app/globals.css",
      "lib/navigation/entrees.ts",
      "lib/theme/apparence.ts",
      "tests/unit/navigation/entrees.test.ts",
      "tests/unit/theme/apparence.test.ts",
    ];
    for (const chemin of suspects) {
      const contenu = readFileSync(join(process.cwd(), chemin), "utf8");
      expect(
        contenu.includes("docs/CODIPLAN_Maquette.html"),
        `${chemin} désigne encore l'ancien chemin`,
      ).toBe(false);
    }
  });
});

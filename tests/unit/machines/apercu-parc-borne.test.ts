import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * LE GARDIEN DE L'APPELANT (PARC-1) — quelle lecture chaque écran appelle.
 *
 * `tests/isolation/historique-machine-borne.test.ts` prouve un FAIT : la
 * lecture bornée ramène exactement sa borne sur une machine à quinze
 * interventions. Il ne dit pas qui l'appelle. Or la faute d'origine n'était
 * pas dans `lib/machines/historique.ts` — elle était dans la PAGE, qui
 * appelait la lecture complète puis tronquait. Une lecture bornée que
 * personne n'appelle est une politique juste que personne n'arme (§9, 09/09),
 * et la page pourrait revenir à `.slice(0, 3)` sans qu'une épreuve de base
 * ne bouge.
 *
 * Ce gardien lit donc les deux écrans, et exige de chacun ce qu'il doit :
 *   - `/parc` (l'aperçu) appelle `teteDeLHistorique`, avec une borne NOMMÉE,
 *     et n'appelle plus `historiqueDeLaMachine` ;
 *   - `/parc/[id]` (la fiche) appelle `historiqueDeLaMachine` — le cas qui
 *     doit rester vert POUR SA PROPRE RAISON (§9, 11/09) : un gardien qui ne
 *     ferait que bannir la lecture complète l'aurait chassée de la fiche
 *     aussi, et la fiche est légitime à tout lire.
 * Et il lit le module : la borne y est un ARGUMENT — `take: limite` —,
 * jamais un nombre écrit dans la requête.
 *
 * Éprouvé sur la faute RÉELLE (§9, 21/08) : la ligne de `11b6d9b`, greffée
 * dans le fichier courant à la place de l'appel borné, est refusée.
 */

const PAGE_APERCU = join(process.cwd(), "app/(back-office)/parc/page.tsx");
const PAGE_FICHE = join(process.cwd(), "app/(back-office)/parc/[id]/page.tsx");
const MODULE = join(process.cwd(), "lib/machines/historique.ts");

const APPEL_BORNE =
  /teteDeLHistorique\(\s*contexte,\s*[\w.]+,\s*([A-Z_]+),?\s*\)/;
const APPEL_COMPLET = /\bhistoriqueDeLaMachine\(/;

/** L'appel que la page faisait avant PARC-1, mot pour mot (`11b6d9b`). */
const APPEL_D_ORIGINE =
  "(await historiqueDeLaMachine(contexte, selection.id)).slice(0, 3)";

function lire(chemin: string): string {
  return readFileSync(chemin, "utf8");
}

/** Ce que l'aperçu doit faire : la lecture bornée, par un nom, et rien d'autre. */
function apercuBorne(source: string): boolean {
  return APPEL_BORNE.test(source) && !APPEL_COMPLET.test(source);
}

describe("l'aperçu du parc appelle la lecture BORNÉE, avec sa borne nommée (PARC-1)", () => {
  it("`/parc` appelle teteDeLHistorique avec une constante nommée, et plus historiqueDeLaMachine", () => {
    const source = lire(PAGE_APERCU);
    expect(apercuBorne(source)).toBe(true);
    // La borne est déclarée dans la page, avec sa valeur — c'est la page qui
    // sait combien elle affiche.
    const nom = APPEL_BORNE.exec(source)?.[1];
    expect(nom).toBeDefined();
    expect(source).toMatch(new RegExp(`const ${nom} = \\d+;`));
  });

  it("MISE EN ÉCHEC — l'appel d'origine, greffé dans la page courante, est refusé", () => {
    const source = lire(PAGE_APERCU);
    const appelCourant = APPEL_BORNE.exec(source)?.[0];
    if (appelCourant === undefined) {
      throw new Error("l'appel borné est introuvable dans la page courante");
    }
    const retour = source.replace(appelCourant, APPEL_D_ORIGINE);
    // Témoin : la greffe a bien eu lieu — sans lui, un `replace` sans effet
    // ferait éprouver la page saine sous le nom de la faute.
    expect(retour).not.toBe(source);
    expect(retour).toContain(".slice(0, 3)");
    expect(apercuBorne(retour)).toBe(false);
  });

  it("LA FICHE `/parc/[id]` appelle la lecture COMPLÈTE — le cas qui reste vert pour sa propre raison", () => {
    const source = lire(PAGE_FICHE);
    expect(APPEL_COMPLET.test(source)).toBe(true);
    expect(APPEL_BORNE.test(source)).toBe(false);
  });

  it("dans le module, la borne est un ARGUMENT (`take: limite`), jamais un nombre dans la requête", () => {
    const source = lire(MODULE);
    expect(source).toMatch(/take:\s*limite\b/);
    expect(source).not.toMatch(/take:\s*\d/);
    // Une seule requête pour deux lectures : `findMany` n'est écrit qu'une
    // fois, sinon le filtre « la machine, jamais le site » (L2-05) devrait
    // être juste deux fois.
    expect(source.match(/\.findMany\(/g)).toHaveLength(1);
  });
});

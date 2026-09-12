import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  LATENCE_PESSIMISTE_MS as LATENCE_SEED,
  DUREE_MAXIMALE_MS as DUREE_SEED,
} from "../../prisma/seed-delais";
import {
  ATTENTE_CONNEXION_MS,
  DELAIS_VEILLE,
  DUREE_MAXIMALE_MS,
  LATENCE_PESSIMISTE_MS,
  allersRetoursObservation,
} from "../../scripts/lib/veille-delais";
import { RACINE } from "./outils/fichiers-source";

const VEILLE = join(RACINE, "scripts", "veille-hebergee.mts");
const SOURCE = readFileSync(VEILLE, "utf8");

/**
 * LE BUDGET DE TEMPS DE LA VEILLE — l'incident du 12/09/2026.
 *
 * La veille tenait son observation dans une transaction interactive SANS DÉLAI
 * DÉCLARÉ, donc sous les 5 000 ms de Prisma. *Mesuré deux fois sur le commit
 * `cca4295`, à deux heures d'écart : 5 199 ms, puis 5 152 ms.* Le dépassement
 * est de trois pour cent : il se reproduit chaque nuit, et il ne se voit sur
 * aucun PostgreSQL local, où l'aller-retour coûte une milliseconde.
 *
 * **Aucun test exécutable ne peut donc constater le défaut** — c'est le même
 * angle mort que le seed du 23/08/2026. Ce qui se vérifie est l'ARITHMÉTIQUE,
 * et le fait que la veille ne s'en remette pas au défaut de Prisma.
 */
describe("délais de la transaction de la veille", () => {
  it("le budget tient : allers-retours × latence majorée < délai déclaré", () => {
    const allersRetours = allersRetoursObservation(SOURCE);
    const budget = allersRetours * LATENCE_PESSIMISTE_MS;

    expect(
      budget,
      `la veille compte ${allersRetours} allers-retours à ` +
        `${LATENCE_PESSIMISTE_MS} ms, soit ${budget} ms, pour un délai de ` +
        `${DUREE_MAXIMALE_MS} ms. Elle a grossi au-delà de son budget : ` +
        "relever DUREE_MAXIMALE_MS en connaissance de cause, ou retirer un " +
        "contrôle. Ne PAS découper la transaction — les contrôles doivent " +
        "observer le MÊME état de la base.",
    ).toBeLessThan(DUREE_MAXIMALE_MS);
  });

  it("le budget n'est pas creux : la transaction compte bien une dizaine d'allers-retours", () => {
    // Le témoin du §9 (30/08) : un décompte nul ressemble à un sans-faute, et
    // un budget qui tient parce qu'on ne compte rien ne garde rien.
    expect(allersRetoursObservation(SOURCE)).toBeGreaterThan(10);
  });

  it("les deux délais dépassent les défauts de Prisma — sinon ils ne servent à rien", () => {
    // Défauts de Prisma : maxWait 2 000 ms, timeout 5 000 ms.
    expect(DELAIS_VEILLE.maxWait).toBe(ATTENTE_CONNEXION_MS);
    expect(DELAIS_VEILLE.timeout).toBe(DUREE_MAXIMALE_MS);
    expect(DELAIS_VEILLE.maxWait).toBeGreaterThan(2_000);
    expect(DELAIS_VEILLE.timeout).toBeGreaterThan(5_000);
  });

  /**
   * LA RECOPIE EST CONFRONTÉE, sinon ce n'est pas un contrôle mais un doublon.
   *
   * La latence et la durée sont écrites deux fois — au semis et ici — parce que
   * la veille ne doit pas dépendre du semis. *Le test à faire passer à toute
   * duplication qui se prétend un contrôle : qu'est-ce qui confronterait les
   * deux copies ?* (§9, 01/09). C'est ceci.
   */
  it("la latence et la durée sont les MÊMES que celles du semis", () => {
    expect(LATENCE_PESSIMISTE_MS).toBe(LATENCE_SEED);
    expect(DUREE_MAXIMALE_MS).toBe(DUREE_SEED);
  });
});

/**
 * GARDIEN STATIQUE — la veille ne s'en remet jamais au défaut de Prisma.
 *
 * Le défaut invisible en local est ici même : `$transaction(async (tx) => …)`
 * sans second argument compile, passe toute la suite, et n'échoue qu'à Sydney.
 */
describe("la transaction de la veille déclare ses délais", () => {
  it("`$transaction` porte DELAIS_VEILLE", () => {
    const appel = SOURCE.match(/\$transaction\([\s\S]{0,2000}?\n\s*\)/);
    expect(
      appel,
      "aucun appel à `$transaction` trouvé dans la veille",
    ).not.toBe(null);
    expect(
      appel?.[0],
      "la transaction de la veille n'énonce pas ses délais : elle hérite des " +
        "5 000 ms de Prisma, qui sont une valeur de réseau local. C'est " +
        "l'incident du 12/09/2026.",
    ).toMatch(/DELAIS_VEILLE/);
  });
});

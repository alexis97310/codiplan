import { describe, expect, it } from "vitest";

import {
  ecartsListeParc,
  TABLES_PARC,
} from "../../../scripts/lib/politiques-rls";

/**
 * La liste close du PARC — deuxième des trois gardiens du contrat R0-a
 * (écart É14 de la revue R0 ; arbitrages D10 et D22).
 *
 * **Pourquoi ce fichier existe, et pourquoi ici.** Ces assertions vivaient dans
 * `tests/isolation/politiques-rls.test.ts`, c'est-à-dire derrière un PostgreSQL
 * jetable. `ecartsListeParc` ne lit pourtant NI `pg_policies`, NI la moindre
 * ligne : c'est de la logique pure. Le ticket L1-01 a mesuré la conséquence en
 * jouant la réparation naïve pour de bon — le leg qui retire `client` de
 * `TABLES_PARC` ne faisait rougir que des scénarios d'isolation, si bien
 * qu'une session lançant `pnpm test` seul ne voyait rien tomber. Un gardien
 * qu'on peut rendre exécutable sans base doit l'être : sa portée est plus
 * large, et son silence est plus dur à obtenir.
 *
 * **Ce que ce gardien tient, et que les deux autres ne tiennent pas.** La forme
 * mesurée dans `pg_policies` juge la politique d'une table du parc ; elle ne
 * peut rien dire d'une table qu'on a RETIRÉE de la liste, puisqu'elle ne la
 * regarde plus. Le plancher de scénarios compte les scénarios, pas les entrées
 * de la liste. C'est ici, et seulement ici, que le retrait est refusé.
 *
 * **Et c'est le RETRAIT qui est dangereux, pas l'addition.** Retirer `client`
 * ne casse rien, ne fait échouer aucun scénario, et fait retomber la table sur
 * la forme « société » — qui passe. Le filtre portail de D10 et le chemin QR de
 * D22 disparaissent alors sans qu'aucun test ne rougisse. C'est exactement
 * l'écart É14, et c'est le seul endroit du dépôt où une réparation plausible
 * réduit la couverture en silence.
 */
describe("la liste close du parc (R0-a, É14, D10, D22)", () => {
  it("ne contient que `client`, `site`, `machine`, `contact`, `intervention` et `demande`", () => {
    expect(ecartsListeParc()).toEqual([]);
    expect(TABLES_PARC.map((entree) => entree.table)).toEqual([
      "client",
      "site",
      "machine",
      // `contact` rejoint le parc au ticket L1-03, et sa colonne de périmètre
      // est la PREMIÈRE nullable du dépôt : un contact sans site est un contact
      // du client.
      "contact",
      // `intervention` rejoint le parc au lot 2, PAR L'ARBITRAGE QUE LA LISTE
      // RÉCLAMAIT — D84. Elle était jusqu'ici le cas NOMMÉ de l'épreuve
      // d'addition ci-dessous : la liste a exigé qu'on la regarde, un
      // arbitrage a répondu, et l'entrée a changé de côté. C'est tout ce
      // qu'une liste close sait faire de bien.
      "intervention",
      // `demande` rejoint le parc au lot 2, PAR L'ARBITRAGE D102 — et c'est la
      // seule entrée de la liste où un compte de PORTAIL ÉCRIT (chapitre 9,
      // parcours P5). *Mesuré avant sa déclaration : la table portait déjà la
      // forme « parc » et le gardien de forme était VERT, une politique plus
      // stricte satisfaisant l'attente « société ». Sans cette entrée, un
      // affaiblissement ultérieur n'aurait donc rien fait rougir.*
      "demande",
    ]);
  });

  it("`client` ne porte pas le filtre de périmètre, les autres si", () => {
    // Témoin de non-vacuité : une liste dont toutes les entrées se
    // ressembleraient ne prouverait pas que le champ `perimetre` est lu. Et la
    // distinction est réelle — `client` EST le client, il n'y a pas de site
    // au-dessus d'elle.
    expect(
      Object.fromEntries(
        TABLES_PARC.map((entree) => [entree.table, entree.perimetre]),
      ),
    ).toEqual({
      client: false,
      site: true,
      machine: true,
      contact: true,
      intervention: true,
      demande: true,
    });
  });

  it("ÉCHOUE sur un RETRAIT — le geste que É14 décrit", () => {
    const ecarts = ecartsListeParc([
      "site",
      "machine",
      "contact",
      "intervention",
      "demande",
    ]);

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("client");
    expect(ecarts[0]).toContain("RETIRÉE");
  });

  it("ÉCHOUE sur un retrait de CHACUNE, pas seulement de `client`", () => {
    // Sans cette mesure, le gardien pourrait ne mordre que sur l'entrée qui a
    // motivé son écriture — et laisser partir `site` ou `machine` en silence
    // aux tickets L1-02 et L2-01, où la même faute se commettra.
    for (const partie of [
      "client",
      "site",
      "machine",
      "contact",
      "intervention",
      "demande",
    ]) {
      const restantes = TABLES_PARC.map((entree) => entree.table).filter(
        (table) => table !== partie,
      );
      const ecarts = ecartsListeParc(restantes);

      expect(ecarts, partie).toHaveLength(1);
      expect(ecarts[0]).toContain(partie);
      expect(ecarts[0]).toContain("RETIRÉE");
    }
  });

  it("ÉCHOUE sur une ADDITION — elle passe par un arbitrage", () => {
    // L'ÉPREUVE A CHANGÉ DE SUJET, et c'est le signe que le mécanisme a
    // fonctionné. `intervention` était le cas nommé ici jusqu'au 09/09/2026 ;
    // D84 l'a arbitrée, elle est passée dans la liste, et une épreuve qui
    // l'aurait gardée pour cible aurait cessé de rejouer une VIOLATION — elle
    // aurait mesuré un cas devenu légitime, en restant verte (§9, 11/09).
    //
    // Le nouveau cas nommé est `contrat` : le chapitre 11 la porte, elle
    // n'existe pas encore au schéma, et le portail la verra un jour. Son
    // entrée au parc sera un arbitrage, jamais une ligne ajoutée en séance.
    const ecarts = ecartsListeParc([
      "client",
      "site",
      "machine",
      "contact",
      "intervention",
      "demande",
      "contrat",
    ]);

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("contrat");
    expect(ecarts[0]).toContain("arbitrage");
  });

  it("ÉCHOUE sur une liste VIDE, et le dit SIX fois", () => {
    // Le cas dégénéré : vider la liste ferait sortir toutes les tables du
    // périmètre du gardien de forme sans qu'aucune ne soit nommée ailleurs. Le
    // décompte suit la liste — six depuis l'entrée de `demande` (D102).
    expect(ecartsListeParc([])).toHaveLength(6);
  });
});

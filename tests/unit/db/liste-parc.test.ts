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
  it("ne contient que `client`, `site`, `machine`, `contact` et `intervention`", () => {
    expect(ecartsListeParc()).toEqual([]);
    expect(TABLES_PARC.map((entree) => entree.table)).toEqual([
      "client",
      "site",
      "machine",
      // `contact` rejoint le parc au ticket L1-03, et sa colonne de périmètre
      // est la PREMIÈRE nullable du dépôt : un contact sans site est un contact
      // du client.
      "contact",
      // `intervention` rejoint le parc au ticket L2-10, par l'arbitrage D82 —
      // que le module ANNONÇAIT : « le jour où intervention rejoindra le parc,
      // ce sera un arbitrage, pris au lot 2, jamais une ligne ajoutée en
      // séance ». Elle porte client_id et site_id en propre, comme `machine` :
      // c'est une table DU parc, pas une table FILLE du parc.
      "intervention",
    ]);
  });

  it("`client` ne porte pas le filtre de périmètre, les deux autres si", () => {
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
    });
  });

  it("ÉCHOUE sur un RETRAIT — le geste que É14 décrit", () => {
    const ecarts = ecartsListeParc([
      "site",
      "machine",
      "contact",
      "intervention",
    ]);

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("client");
    expect(ecarts[0]).toContain("RETIRÉE");
  });

  it("ÉCHOUE sur un retrait de CHACUNE des trois, pas seulement de `client`", () => {
    // Sans cette mesure, le gardien pourrait ne mordre que sur l'entrée qui a
    // motivé son écriture — et laisser partir `site` ou `machine` en silence
    // aux tickets L1-02 et L2-01, où la même faute se commettra.
    for (const partie of [
      "client",
      "site",
      "machine",
      "contact",
      "intervention",
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
    // Le sujet de cette épreuve a CHANGÉ au ticket L2-10, et il fallait qu'il
    // change : `intervention` était l'addition non arbitrée tant qu'elle ne
    // l'était pas, et D82 l'a arbitrée. Une épreuve qui continuerait de
    // l'employer serait devenue verte pour la mauvaise raison — la table est
    // désormais LICITE. `demande` prend sa place, pour la raison exacte qui
    // faisait la force de la précédente : le chapitre 11.2 la décrit, elle
    // portera client_id et site_id, et son entrée au parc sera un arbitrage.
    const ecarts = ecartsListeParc([
      "client",
      "site",
      "machine",
      "contact",
      "intervention",
      "demande",
    ]);

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("demande");
    expect(ecarts[0]).toContain("arbitrage");
  });

  it("ÉCHOUE sur une liste VIDE, et le dit cinq fois", () => {
    // Le cas dégénéré : vider la liste ferait sortir les cinq tables du
    // périmètre du gardien de forme sans qu'aucune ne soit nommée ailleurs.
    expect(ecartsListeParc([])).toHaveLength(5);
  });
});

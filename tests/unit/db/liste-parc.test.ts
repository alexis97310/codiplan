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
  it("ne contient que `client`, `site` et `machine`", () => {
    expect(ecartsListeParc()).toEqual([]);
    expect(TABLES_PARC.map((entree) => entree.table)).toEqual([
      "client",
      "site",
      "machine",
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
    ).toEqual({ client: false, site: true, machine: true });
  });

  it("ÉCHOUE sur un RETRAIT — le geste que É14 décrit", () => {
    const ecarts = ecartsListeParc(["site", "machine"]);

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("client");
    expect(ecarts[0]).toContain("RETIRÉE");
  });

  it("ÉCHOUE sur un retrait de CHACUNE des trois, pas seulement de `client`", () => {
    // Sans cette mesure, le gardien pourrait ne mordre que sur l'entrée qui a
    // motivé son écriture — et laisser partir `site` ou `machine` en silence
    // aux tickets L1-02 et L2-01, où la même faute se commettra.
    for (const partie of ["client", "site", "machine"]) {
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
    // `intervention` est le cas nommé : D10 donne au portail la vue de ses
    // interventions, et son entrée au parc sera un arbitrage du lot 2.
    const ecarts = ecartsListeParc([
      "client",
      "site",
      "machine",
      "intervention",
    ]);

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("intervention");
    expect(ecarts[0]).toContain("arbitrage");
  });

  it("ÉCHOUE sur une liste VIDE, et le dit trois fois", () => {
    // Le cas dégénéré : vider la liste ferait sortir les trois tables du
    // périmètre du gardien de forme sans qu'aucune ne soit nommée ailleurs.
    expect(ecartsListeParc([])).toHaveLength(3);
  });
});

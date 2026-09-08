import { describe, expect, it } from "vitest";

import {
  TABLES_APPARTENANCE,
  ecartsListeAppartenance,
} from "@/scripts/lib/politiques-rls";

/**
 * LA LISTE CLOSE DE LA HUITIÈME FORME, GARDÉE DANS LES DEUX SENS (D61).
 *
 * Même forme que `liste-parc.test.ts`, et pour la même raison : la liste ne lit
 * ni `pg_policies` ni la moindre base — c'est une constante du dépôt, et son
 * gardien se joue donc en unitaire, sans PostgreSQL.
 *
 * **Les deux sens ne coûtent pas la même chose, et il faut le dire.**
 * L'ADDITION étend une exception au cloisonnement société : une table de plus
 * dont une ligne devient lisible hors de sa société. Le RETRAIT, lui, ne
 * casse rien de visible — il fait retomber `utilisateur_societe` sur la forme
 * « société », qui PASSE tous les gardiens de forme, et le mur revient : aucun
 * compte ne peut plus découvrir sa propre société. C'est le sens silencieux,
 * et c'est celui qu'on oublierait de garder.
 */
describe("la liste close des tables d'appartenance", () => {
  it("l'état du dépôt n'a aucun écart — sinon tout le reste ment", () => {
    expect(ecartsListeAppartenance()).toEqual([]);
  });

  it("elle porte bien l'entrée que D61 arbitre — témoin de non-vacuité", () => {
    expect([...TABLES_APPARTENANCE]).toEqual(["utilisateur_societe"]);
  });

  it("une ADDITION est refusée, et le message dit pourquoi", () => {
    const ecarts = ecartsListeAppartenance([
      "utilisateur_societe",
      "utilisateur_client",
    ]);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("utilisateur_client");
    expect(ecarts[0]).toMatch(/lisible HORS de sa société/);
  });

  it("un RETRAIT est refusé aussi — c'est le sens silencieux", () => {
    const ecarts = ecartsListeAppartenance([]);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toMatch(/le mur que D61 abat/);
  });
});

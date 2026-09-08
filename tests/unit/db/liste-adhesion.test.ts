import { describe, expect, it } from "vitest";

import {
  TABLES_ADHESION,
  ecartsListeAdhesion,
  formeAttendue,
} from "@/scripts/lib/politiques-rls";

/**
 * LA LISTE CLOSE DE LA NEUVIÈME FORME, GARDÉE DANS LES DEUX SENS (D67).
 *
 * Même forme que `liste-parc.test.ts` et `liste-appartenance.test.ts`, et pour
 * la même raison : la liste ne lit ni `pg_policies` ni la moindre base — c'est
 * une constante du dépôt, et son gardien se joue en unitaire.
 *
 * **Les deux sens ne coûtent pas la même chose.** L'ADDITION étend à une autre
 * table une lecture hors de sa société, sur la seule identité de l'appelant. Le
 * RETRAIT, lui, ne casse rien de visible : il fait retomber `societe` sur la
 * forme « identité » seule, qui PASSE tous les gardiens de forme, et le mur du
 * sélecteur revient — plus aucun compte ne peut lire le nom de ses sociétés.
 * C'est le sens silencieux, et c'est celui qu'on oublierait de garder.
 */
describe("la liste close des tables d'adhésion", () => {
  it("l'état du dépôt n'a aucun écart — sinon tout le reste ment", () => {
    expect(ecartsListeAdhesion()).toEqual([]);
  });

  it("elle porte bien l'entrée que D67 arbitre — témoin de non-vacuité", () => {
    expect([...TABLES_ADHESION]).toEqual(["societe"]);
  });

  it("une ADDITION est refusée, et le message dit pourquoi", () => {
    const ecarts = ecartsListeAdhesion(["societe", "client"]);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("client");
    expect(ecarts[0]).toMatch(/lisible HORS de sa société/);
  });

  it("le RETRAIT — le sens SILENCIEUX — est refusé lui aussi", () => {
    const ecarts = ecartsListeAdhesion([]);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("societe");
    expect(ecarts[0]).toMatch(/mur que D67 abat/);
  });

  it("`societe` porte bien la forme « adhésion », et non « société »", () => {
    // Le témoin qui dit que l'ordre de `formeAttendue` n'a pas été inversé :
    // sous la forme « société », `societe` serait jugée sur un ancrage
    // `societe_id` qu'elle n'a pas.
    expect(formeAttendue("societe")).toBe("adhésion");
    expect(formeAttendue("agence")).toBe("société");
  });
});

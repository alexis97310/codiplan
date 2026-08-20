import { describe, expect, it } from "vitest";

import {
  ecartsPrivilegesConsolidation,
  versPrivileges,
  type PrivilegeAccorde,
} from "../../../scripts/lib/privileges-consolidation";

/**
 * Contrôle permanent des privilèges du rôle de consolidation (arbitrage D38).
 *
 * Ici, la règle seule — l'observation contre une vraie base est jouée par
 * `tests/isolation/reporting.test.ts` et, sur la base hébergée, par
 * `scripts/controle-cloisonnement.mts`. Ce que ces scénarios protègent tient en
 * une phrase : le jour où un droit d'écriture apparaît sur `codiplan_reporting`,
 * quelque chose doit tomber au rouge. Un contrôle qui ne saurait pas échouer ne
 * contrôlerait rien.
 */
const selectSur = (table: string): PrivilegeAccorde => ({
  table,
  privilege: "SELECT",
  transmissible: false,
});

describe("privilèges du rôle de consolidation", () => {
  it("accepte le SELECT seul, sur les quatre tables de D21", () => {
    const observes = ["agence", "devise", "parite", "societe"].map(selectSur);
    expect(ecartsPrivilegesConsolidation(observes)).toEqual([]);
  });

  it("ÉCHOUE si un droit d'écriture apparaît un jour", () => {
    for (const privilege of ["INSERT", "UPDATE", "DELETE", "TRUNCATE"]) {
      const ecarts = ecartsPrivilegesConsolidation([
        selectSur("societe"),
        { table: "societe", privilege, transmissible: false },
      ]);
      expect(ecarts, `${privilege} devrait être refusé`).toHaveLength(1);
      expect(ecarts[0]).toContain(privilege);
    }
  });

  it("ÉCHOUE sur un SELECT transmissible — un droit redistribuable n'en est pas une limite", () => {
    const ecarts = ecartsPrivilegesConsolidation([
      { table: "societe", privilege: "SELECT", transmissible: true },
    ]);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("GRANT OPTION");
  });

  it("ÉCHOUE sur zéro privilège observé — un contrôle aveugle n'est pas un contrôle réussi", () => {
    // C'est le piège du contrôle : `information_schema.role_table_grants` ne
    // montre que les droits dont le rôle connecté est bénéficiaire ou
    // concédant. Joué sous le mauvais rôle, il rend zéro ligne — et un vide
    // ressemble beaucoup trop à la conformité.
    const ecarts = ecartsPrivilegesConsolidation([]);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("aveugle");
  });

  it("lit le domaine `yes_or_no` de la norme SQL, et non un booléen", () => {
    expect(
      versPrivileges([
        { table: "societe", privilege: "SELECT", transmissible: "NO" },
        { table: "devise", privilege: "SELECT", transmissible: "YES" },
      ]),
    ).toEqual([
      { table: "societe", privilege: "SELECT", transmissible: false },
      { table: "devise", privilege: "SELECT", transmissible: true },
    ]);
  });
});

import { describe, expect, it } from "vitest";

import {
  ecartsPrivilegesJournal,
  PRIVILEGES_ATTENDUS,
  ROLE_APPLICATIF,
  SQL_PRIVILEGES_JOURNAL,
  TABLE_JOURNAL_AUDIT,
  versPrivilegesJournal,
  type PrivilegeJournal,
} from "../../../scripts/lib/privileges-journal";

/**
 * L'ajout seul du journal d'audit — la RÈGLE, éprouvée sans base
 * (ticket L0-10, invariant I8, arbitrage D32).
 *
 * La lecture réelle de `information_schema` est éprouvée contre un PostgreSQL
 * dans `tests/isolation/journal-audit.test.ts`. Ici, on éprouve le VERDICT :
 * quels états d'un rôle sont acceptés, lesquels sont refusés, et avec quel
 * message. Les deux comptent — un contrôle qui observe bien mais juge mal ne
 * garde rien.
 */

function privileges(...detenus: PrivilegeJournal[]): PrivilegeJournal[] {
  return detenus;
}

const accorde = (
  privilege: string,
  transmissible = false,
): PrivilegeJournal => ({
  privilege,
  transmissible,
});

describe("le journal d'audit est en ajout seul (L0-10)", () => {
  it("SELECT et INSERT, et rien d'autre : aucun écart", () => {
    expect(
      ecartsPrivilegesJournal(privileges(accorde("INSERT"), accorde("SELECT"))),
    ).toEqual([]);
  });

  it("UPDATE fait échouer le contrôle, en le nommant", () => {
    // L'objet même du contrôle : le droit de réécrire l'histoire.
    const ecarts = ecartsPrivilegesJournal(
      privileges(accorde("INSERT"), accorde("SELECT"), accorde("UPDATE")),
    );

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("UPDATE");
    expect(ecarts[0]).toContain(TABLE_JOURNAL_AUDIT);
    expect(ecarts[0]).toContain("AJOUT SEUL");
  });

  it("DELETE et TRUNCATE échouent aussi — chacun pour son compte", () => {
    const ecarts = ecartsPrivilegesJournal(
      privileges(
        accorde("INSERT"),
        accorde("SELECT"),
        accorde("DELETE"),
        accorde("TRUNCATE"),
      ),
    );

    expect(ecarts).toHaveLength(2);
    expect(ecarts.join("\n")).toContain("DELETE");
    expect(ecarts.join("\n")).toContain("TRUNCATE");
  });

  it("INSERT MANQUANT échoue aussi, et c'est le cas qu'on oublie", () => {
    // Le déclencheur s'exécute en SECURITY INVOKER : sans INSERT, ce n'est pas
    // le journal qui se dégrade, c'est toute écriture métier qui tombe. Un
    // contrôle qui ne regarderait que les droits de TROP laisserait passer une
    // application entièrement bloquée.
    const ecarts = ecartsPrivilegesJournal(privileges(accorde("SELECT")));

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("ne détient PAS INSERT");
    expect(ecarts[0]).toContain("SECURITY INVOKER");
  });

  it("un droit transmissible n'est plus une limite", () => {
    const ecarts = ecartsPrivilegesJournal(
      privileges(accorde("INSERT", true), accorde("SELECT")),
    );

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("WITH GRANT OPTION");
  });

  it("zéro privilège observé est un ÉCHEC, pas un succès", () => {
    // Le vide ressemble trop à la conformité : sous un rôle qui n'a pas posé
    // les GRANT, la vue est aveugle et rendrait zéro ligne. Même règle que le
    // contrôle de D38.
    const ecarts = ecartsPrivilegesJournal([]);

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("aucun privilège observé");
    expect(ecarts[0]).toContain("MIGRATION_DATABASE_URL");
  });

  it("les lignes brutes de PostgreSQL sont converties fidèlement", () => {
    // `is_grantable` est du domaine `yes_or_no` de la norme SQL : une chaîne,
    // jamais un booléen. La confondre avec `Boolean("NO")` — qui vaut vrai —
    // rendrait tous les droits transmissibles.
    expect(
      versPrivilegesJournal([
        { privilege: "INSERT", transmissible: "NO" },
        { privilege: "SELECT", transmissible: "YES" },
      ]),
    ).toEqual([
      { privilege: "INSERT", transmissible: false },
      { privilege: "SELECT", transmissible: true },
    ]);
  });

  it("la requête est paramétrée, jamais interpolée", () => {
    // Le rôle et la table sont des paramètres liés. Une interpolation ferait du
    // contrôle de cloisonnement un chemin d'injection.
    expect(SQL_PRIVILEGES_JOURNAL).toContain("$1");
    expect(SQL_PRIVILEGES_JOURNAL).toContain("$2");
    expect(SQL_PRIVILEGES_JOURNAL).not.toContain(ROLE_APPLICATIF);
    expect(SQL_PRIVILEGES_JOURNAL).not.toContain(TABLE_JOURNAL_AUDIT);
  });

  it("la liste des privilèges attendus est celle de l'ajout seul", () => {
    // Recopiée ici : c'est la propriété qu'on garde, pas une commodité de
    // rédaction. L'élargir doit faire tomber ce test-ci.
    expect([...PRIVILEGES_ATTENDUS]).toEqual(["INSERT", "SELECT"]);
  });
});

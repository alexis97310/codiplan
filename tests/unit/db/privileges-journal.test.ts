import { describe, expect, it } from "vitest";

import {
  ecartsDurcissementPartitions,
  ecartsPrivilegesJournal,
  PRIVILEGES_ATTENDUS,
  ROLE_APPLICATIF,
  SQL_PARTITIONS_JOURNAL,
  SQL_PRIVILEGES_JOURNAL,
  TABLE_JOURNAL_AUDIT,
  versPartitionsJournal,
  versPrivilegesJournal,
  type PartitionJournal,
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

/**
 * LE DURCISSEMENT DES PARTITIONS — la règle, éprouvée sans base.
 *
 * Ce contrôle existe parce que le précédent ne suffisait pas : il interroge le
 * PARENT, et « une garantie posée sur une table ne suit pas ses partitions »
 * (§9). Mesuré sur le contrôle lui-même avant correction : une partition créée
 * nue portait `DELETE,INSERT,SELECT,UPDATE` sans aucune RLS, et le verdict
 * était VERT.
 */

function partition(
  surcharge: Partial<PartitionJournal> = {},
): PartitionJournal {
  return {
    partition: "journal_audit_2026_08",
    rlsActivee: true,
    rlsForcee: true,
    privileges: [],
    ...surcharge,
  };
}

describe("chaque partition du journal est durcie (L0-10)", () => {
  it("une partition sans privilège et sous RLS forcée : aucun écart", () => {
    expect(ecartsDurcissementPartitions([partition()])).toEqual([]);
  });

  it("ZÉRO partition observée est un ÉCHEC — la leçon du témoin", () => {
    // La table est partitionnée depuis sa création : elle en a forcément. Une
    // énumération vide ne prouve pas un sans-faute, elle prouve qu'on n'a rien
    // regardé — et c'est précisément le mode de défaillance de cette méthode.
    const ecarts = ecartsDurcissementPartitions([]);

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("aucune partition observée");
    expect(ecarts[0]).toContain("MIGRATION_DATABASE_URL");
  });

  it("un privilège sur une partition est refusé, et nommé", () => {
    const ecarts = ecartsDurcissementPartitions([
      partition({
        partition: "journal_audit_2099_01",
        privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      }),
    ]);

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("journal_audit_2099_01");
    expect(ecarts[0]).toContain("DELETE, INSERT, SELECT, UPDATE");
    expect(ecarts[0]).toContain("une AUTRE société");
  });

  it("LES DEUX DRAPEAUX sont exigés — FORCE seul ne suffit pas", () => {
    // Mesuré en base : `relrowsecurity = false`, `relforcerowsecurity = true`,
    // et la ligne reste lisible en nommant la partition. Un contrôle qui ne
    // regarderait que FORCE laisserait passer une RLS inerte.
    const ecarts = ecartsDurcissementPartitions([
      partition({ rlsActivee: false, rlsForcee: true }),
    ]);

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("NON activée, forcée");
    expect(ecarts[0]).toContain(
      "FORCE seul laisse les politiques inappliquées",
    );
  });

  it("ENABLE seul ne suffit pas davantage — le propriétaire y échapperait", () => {
    const ecarts = ecartsDurcissementPartitions([
      partition({ rlsActivee: true, rlsForcee: false }),
    ]);

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("activée, NON forcée");
  });

  it("une partition nue cumule les DEUX écarts", () => {
    const ecarts = ecartsDurcissementPartitions([
      partition({
        rlsActivee: false,
        rlsForcee: false,
        privileges: ["SELECT"],
      }),
    ]);

    expect(ecarts).toHaveLength(2);
  });

  it("une seule partition fautive parmi des saines suffit à faire échouer", () => {
    // Le cas réel : quatorze partitions durcies par la migration, une quinzième
    // créée par un autre chemin. Un contrôle qui jugerait « la plupart » ne
    // servirait à rien.
    const ecarts = ecartsDurcissementPartitions([
      partition({ partition: "journal_audit_2026_08" }),
      partition({ partition: "journal_audit_2026_09" }),
      partition({ partition: "journal_audit_defaut" }),
      partition({ partition: "journal_audit_2099_01", privileges: ["UPDATE"] }),
    ]);

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("journal_audit_2099_01");
  });

  it("les lignes brutes sont converties fidèlement, chaîne vide comprise", () => {
    // Une partition SANS privilège rend une chaîne vide, pas `null` : la
    // découper naïvement produirait `[""]`, c'est-à-dire un privilège fantôme
    // qui ferait échouer toutes les partitions saines.
    expect(
      versPartitionsJournal([
        {
          partition: "journal_audit_2026_08",
          rls_activee: true,
          rls_forcee: true,
          privileges: "",
        },
        {
          partition: "journal_audit_2099_01",
          rls_activee: false,
          rls_forcee: false,
          privileges: "SELECT,UPDATE",
        },
      ]),
    ).toEqual([
      {
        partition: "journal_audit_2026_08",
        rlsActivee: true,
        rlsForcee: true,
        privileges: [],
      },
      {
        partition: "journal_audit_2099_01",
        rlsActivee: false,
        rlsForcee: false,
        privileges: ["SELECT", "UPDATE"],
      },
    ]);
  });

  it("la requête énumère les PARTITIONS, et non le parent", () => {
    // Le défaut corrigé : l'ancien contrôle filtrait sur `table_name` = le
    // parent. Celui-ci part de `pg_inherits`, donc des partitions réelles.
    expect(SQL_PARTITIONS_JOURNAL).toContain("pg_inherits");
    expect(SQL_PARTITIONS_JOURNAL).toContain("relforcerowsecurity");
    expect(SQL_PARTITIONS_JOURNAL).toContain("relrowsecurity");
    // Le LEFT JOIN est ce qui permet à une partition SANS privilège
    // d'apparaître : une jointure interne la ferait disparaître, et « aucune
    // partition privilégiée » deviendrait « aucune partition ».
    expect(SQL_PARTITIONS_JOURNAL).toContain("LEFT JOIN");
    expect(SQL_PARTITIONS_JOURNAL).toContain("$1");
  });
});

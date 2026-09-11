import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  RESSERREMENTS_DEJA_APPLIQUES,
  TABLES_VIDES_AU_RESSERREMENT,
  migrationsQuiResserrent,
  resserrements,
  type MigrationLue,
} from "../../../scripts/lib/resserrements-migration";

/**
 * CE QUI DÉSIGNE UNE MIGRATION À REJOUER CONTRE DES DONNÉES.
 *
 * La règle est éprouvée ici sur des migrations FABRIQUÉES — c'est le seul moyen
 * d'écrire la faute telle qu'elle se commettrait —, puis confrontée aux 47
 * migrations RÉELLES du dépôt, qui sont la source que ce fichier ne contrôle pas.
 */

const RACINE = join(process.cwd(), "prisma", "migrations");
const REELLES: MigrationLue[] = readdirSync(RACINE)
  .filter((nom) => nom !== "migration_lock.toml")
  .sort()
  .map((nom) => ({
    nom,
    sql: readFileSync(join(RACINE, nom, "migration.sql"), "utf8"),
  }));

describe("ce qui est un resserrement", () => {
  it("une contrainte posée sur une table ANTÉRIEURE en est un", () => {
    const trouves = resserrements([
      { nom: "1_naissance", sql: `CREATE TABLE "t" ("a" int);` },
      {
        nom: "2_resserre",
        sql: `ALTER TABLE "t" ADD CONSTRAINT "t_a_positif" CHECK ("a" > 0);`,
      },
    ]);

    expect(trouves).toHaveLength(1);
    expect(trouves[0]).toMatchObject({
      migration: "2_resserre",
      table: "t",
      genre: "CHECK",
      neeEn: "1_naissance",
    });
  });

  // LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON (§9, 11/09). Une table
  // créée par la migration elle-même NAÎT VIDE : la contrainte ne peut rien
  // refuser, et l'exiger au rejeu demanderait une amorce impossible à écrire.
  it("une contrainte posée sur une table née DANS LA MÊME migration n'en est pas un", () => {
    const trouves = resserrements([
      {
        nom: "1_tout_en_un",
        sql: `CREATE TABLE "t" ("a" int);
              ALTER TABLE "t" ADD CONSTRAINT "t_a_positif" CHECK ("a" > 0);`,
      },
    ]);

    expect(trouves).toEqual([]);
  });

  // C'est la DÉFINITION de NOT VALID : elle ne relit pas les lignes d'avant.
  it("une contrainte NOT VALID n'en est pas un", () => {
    const trouves = resserrements([
      { nom: "1_naissance", sql: `CREATE TABLE "t" ("a" int);` },
      {
        nom: "2_souple",
        sql: `ALTER TABLE "t" ADD CONSTRAINT "t_a_positif" CHECK ("a" > 0) NOT VALID;`,
      },
    ]);

    expect(trouves).toEqual([]);
  });

  // LE PIÈGE DU COMPTAGE DE PARENTHÈSES. Une expression CHECK en contient ;
  // s'arrêter à la première fermante lirait `(("statut" = 'x')` et manquerait
  // le NOT VALID qui suit l'expression ENTIÈRE.
  it("reconnaît NOT VALID derrière une expression à parenthèses imbriquées", () => {
    const trouves = resserrements([
      { nom: "1_naissance", sql: `CREATE TABLE "t" ("s" text, "m" text);` },
      {
        nom: "2_souple",
        sql: `ALTER TABLE "t" ADD CONSTRAINT "t_equivalence" CHECK (
                ("s" = 'suspendue') = ("m" IS NOT NULL)
              ) NOT VALID;`,
      },
    ]);

    expect(trouves).toEqual([]);
  });

  it("une colonne NOT NULL sans défaut en est un, avec défaut non", () => {
    const trouves = resserrements([
      { nom: "1_naissance", sql: `CREATE TABLE "t" ("a" int);` },
      {
        nom: "2_sans_defaut",
        sql: `ALTER TABLE "t" ADD COLUMN "b" text NOT NULL;`,
      },
      {
        nom: "3_avec_defaut",
        sql: `ALTER TABLE "t" ADD COLUMN "c" text NOT NULL DEFAULT 'x';`,
      },
    ]);

    expect(trouves.map((r) => r.migration)).toEqual(["2_sans_defaut"]);
  });

  // CELLE QU'ON OUBLIE, parce qu'elle ne ressemble pas à une contrainte : une
  // conversion réussit toujours sur une table vide et échoue sur la première
  // valeur que le cast refuse.
  it("un changement de TYPE de colonne en est un", () => {
    const trouves = resserrements([
      { nom: "1_naissance", sql: `CREATE TABLE "t" ("id" text);` },
      {
        nom: "2_convertit",
        sql: `ALTER TABLE "t" ALTER COLUMN "id" TYPE uuid USING "id"::uuid;`,
      },
    ]);

    expect(trouves).toHaveLength(1);
    expect(trouves[0]).toMatchObject({
      migration: "2_convertit",
      table: "t",
      genre: "ALTER COLUMN TYPE",
      objet: "id",
    });
  });

  // TROIS FORMES QUE LE DÉPÔT N'ÉCRIT PAS — mesuré le 11/09/2026 : aucune
  // n'apparaît dans les 47 migrations. Elles sont reconnues quand même, et
  // éprouvées ICI faute de cas réel. *Un lecteur qui ne connaît que ce qui
  // existe devient faux en silence le jour où quelqu'un écrit autre chose.*
  it.each([
    [
      "VALIDATE CONSTRAINT",
      `ALTER TABLE "t" VALIDATE CONSTRAINT "t_a_positif";`,
      "t_a_positif",
    ],
    [
      "ATTACH PARTITION",
      `ALTER TABLE "t" ATTACH PARTITION "t_2027" FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');`,
      "t_2027",
    ],
    [
      "EXCLUDE",
      `ALTER TABLE "t" ADD CONSTRAINT "t_sans_chevauchement" EXCLUDE USING gist ("a" WITH =);`,
      "t_sans_chevauchement",
    ],
  ])("reconnaît %s, que le dépôt n'écrit pas encore", (genre, sql, objet) => {
    const trouves = resserrements([
      { nom: "1_naissance", sql: `CREATE TABLE "t" ("a" int);` },
      { nom: "2_resserre", sql },
    ]);

    expect(trouves).toHaveLength(1);
    expect(trouves[0]).toMatchObject({ genre, objet, table: "t" });
  });

  it("ne lit pas les COMMENTAIRES — documentation contre exécution", () => {
    const trouves = resserrements([
      { nom: "1_naissance", sql: `CREATE TABLE "t" ("a" int);` },
      {
        nom: "2_bavarde",
        sql: `-- ALTER TABLE "t" ADD CONSTRAINT "t_a_positif" CHECK ("a" > 0);
              SELECT 1;`,
      },
    ]);

    expect(trouves).toEqual([]);
  });
});

describe("les formes absentes du dépôt", () => {
  // LE TÉMOIN DE CETTE ABSENCE. Le jour où une migration écrira l'une de ces
  // trois formes, ce scénario rougit — non parce que la forme serait
  // interdite, mais parce que la phrase « le dépôt ne les écrit pas », écrite
  // le 11/09/2026 au README et dans le module, cesserait d'être vraie.
  // *Une affirmation datée qui ne se re-mesure pas devient un vestige.*
  it("VALIDATE CONSTRAINT, ATTACH PARTITION et EXCLUDE n'apparaissent nulle part", () => {
    const executables = REELLES.map((m) =>
      m.sql
        .split("\n")
        .filter((ligne) => !/^\s*--/.test(ligne))
        .join("\n"),
    );
    expect(executables.length).toBeGreaterThan(40);

    for (const forme of [
      /VALIDATE\s+CONSTRAINT/i,
      /ATTACH\s+PARTITION/i,
      /ADD\s+CONSTRAINT\s+"?[a-z0-9_]+"?\s+EXCLUDE\b/i,
    ]) {
      const ecrivent = REELLES.filter((_, i) =>
        forme.test(executables[i]!),
      ).map((m) => m.nom);
      expect(
        ecrivent,
        `${forme} apparaît désormais : le rejeu la reconnaît, mais la phrase ` +
          "« le dépôt ne l'écrit pas » doit être retirée du README et du module.",
      ).toEqual([]);
    }
  });
});

describe("les migrations réelles du dépôt", () => {
  const trouves = resserrements(REELLES);
  const quiResserrent = migrationsQuiResserrent(trouves);

  // TÉMOIN DE NON-VACUITÉ : un lecteur devenu aveugle rendrait un vert sur
  // toutes les assertions qui suivent.
  it("sont lues, et le lecteur voit quelque chose", () => {
    expect(REELLES.length).toBeGreaterThan(40);
    expect(trouves.length).toBeGreaterThan(0);
  });

  // L'ADOSSEMENT (§9, 31/08). Une entrée qui ne désigne plus aucun
  // resserrement n'exempte plus personne — et le premier objet qui reprendra
  // ce nom héritera d'une exemption que nul ne lui a accordée.
  it("chaque entrée de l'inventaire désigne une migration qui resserre RÉELLEMENT", () => {
    for (const entree of RESSERREMENTS_DEJA_APPLIQUES) {
      expect(
        quiResserrent,
        `${entree.migration} est inventoriée et ne resserre rien`,
      ).toContain(entree.migration);
      expect(entree.justification.length).toBeGreaterThan(40);
    }
  });

  // LE TÉMOIN QUI EMPÊCHE L'INVENTAIRE DE TOUT AVALER. Si toutes les
  // migrations qui resserrent étaient inventoriées, le rejeu ne mesurerait
  // plus rien — et il resterait vert.
  it("l'inventaire ne couvre PAS tous les resserrements", () => {
    const inventoriees = new Set(
      RESSERREMENTS_DEJA_APPLIQUES.map((e) => e.migration),
    );
    const aRejouer = quiResserrent.filter((nom) => !inventoriees.has(nom));

    expect(aRejouer.length).toBeGreaterThan(0);
  });

  // Chaque entrée de la seconde liste close désigne un resserrement réel : une
  // table que la migration nommée resserre vraiment.
  it("chaque table déclarée vide est réellement resserrée par sa migration", () => {
    for (const entree of TABLES_VIDES_AU_RESSERREMENT) {
      const correspond = trouves.some(
        (r) => r.migration === entree.migration && r.table === entree.table,
      );
      expect(
        correspond,
        `${entree.migration} ne resserre pas « ${entree.table} »`,
      ).toBe(true);
      expect(entree.mesure.length).toBeGreaterThan(60);
    }
  });
});

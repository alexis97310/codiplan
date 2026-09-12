import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

import {
  RESSERREMENTS_DEJA_APPLIQUES,
  TABLES_VIDES_AU_RESSERREMENT,
  migrationsQuiResserrent,
  resserrements,
  type MigrationLue,
} from "../../scripts/lib/resserrements-migration";
import { urlOwner } from "./setup/db";

/**
 * LES MIGRATIONS, REJOUÉES CONTRE UNE BASE QUI PORTE DÉJÀ DES DONNÉES.
 *
 * ## CE QUE CE SCÉNARIO RÉPARE, et il a été mesuré
 *
 * `pnpm verify` migre une base **VIDE** puis la sème : toute ligne respecte par
 * construction la règle que la migration vient de poser. **Aucune migration
 * n'était donc jamais éprouvée contre des données préexistantes** — c'est-à-dire
 * contre le seul monde où elle s'applique vraiment.
 *
 * Le 11/09/2026, `20260913160000_suspension_l2_10` a échoué en `23514` sur la
 * base de démonstration, bloqué six migrations derrière elle (`P3018`) et laissé
 * `/planning` en exception serveur pendant plus de quatre heures. **La CI était
 * verte, et elle avait raison** : elle ne gardait pas ce monde-là.
 *
 * ## COMMENT LE REJEU EST FAIT, et pourquoi pas autrement
 *
 * Migration par migration, **avec `prisma migrate deploy`** — le chemin exact de
 * la production, transaction implicite comprise. *Mesuré : `$executeRawUnsafe`
 * refuse un fichier multi-instructions (`42601`, « cannot insert multiple
 * commands into a prepared statement »), donc rejouer le SQL « à la main »
 * n'était pas seulement moins fidèle : c'était impossible.*
 *
 * On s'arrête **avant chaque migration qui resserre** une table préexistante,
 * on joue son amorce s'il en existe une, **et on compte les lignes de la table
 * resserrée**. Un zéro fait échouer le scénario : *une migration éprouvée contre
 * une table vide n'est pas éprouvée du tout* — et c'est exactement l'erreur que
 * ce harnais a commise à sa première exécution, où il a annoncé « toutes les
 * migrations appliquées » sur une base dont l'amorce avait échoué en silence.
 *
 * ## CE QU'IL NE PRÉTEND PAS
 *
 * Il ne dit pas qu'une migration est sûre : il dit qu'elle a été **éprouvée
 * contre des lignes**. L'amorce décrit une base plausible de cette époque ; si
 * une migration échoue ici, c'est ou bien qu'elle manque son rattrapage, ou bien
 * que l'amorce décrit une base impossible. La seconde lecture se vérifie, elle
 * ne se suppose pas.
 */

const RACINE = join(process.cwd(), "prisma", "migrations");
const AMORCES = join(
  process.cwd(),
  "tests",
  "isolation",
  "fixtures",
  "base-agee",
);

const MIGRATIONS: MigrationLue[] = readdirSync(RACINE)
  .filter((nom) => nom !== "migration_lock.toml")
  .sort()
  .map((nom) => ({
    nom,
    sql: readFileSync(join(RACINE, nom, "migration.sql"), "utf8"),
  }));

const TROUVES = resserrements(MIGRATIONS);
const INVENTORIEES = new Set(
  RESSERREMENTS_DEJA_APPLIQUES.map((e) => e.migration),
);
/** Les arrêts : les resserrements que le passé ne couvre pas. */
const ARRETS = migrationsQuiResserrent(TROUVES).filter(
  (nom) => !INVENTORIEES.has(nom),
);

/** Une base SÉPARÉE, sur le même cluster jetable : le harnais d'isolation
 *  recrée la sienne à chaque exécution, et ce rejeu la traverserait. */
const BASE_AGEE = "codiplan_base_agee";

function urlBaseAgee(): string {
  const url = new URL(urlOwner());
  url.pathname = `/${BASE_AGEE}`;
  return url.toString();
}

let clientAgee: PrismaClient | undefined;
afterAll(async () => {
  await clientAgee?.$disconnect();
});

/**
 * Les instructions d'une amorce, commentaires retirés.
 *
 * La coupure est « documentation contre exécution » (§9, 26/08) : les amorces
 * de ce dépôt sont commentées, et leurs commentaires contiennent des
 * points-virgules. Aucun littéral n'en contient — c'est une propriété des
 * amorces, et le découpage naïf serait faux sans elle ; un scénario l'éprouve.
 */
export function instructionsDe(sql: string): string[] {
  return sql
    .split("\n")
    .filter((ligne) => !/^\s*--/.test(ligne))
    .join("\n")
    .split(";")
    .map((instruction) => instruction.trim())
    .filter((instruction) => instruction.length > 0);
}

/** Les lignes que porte la table, sous le propriétaire — c'est un DÉCOMPTE, et
 *  aucune assertion de cloisonnement n'en est tirée. */
async function lignes(table: string): Promise<number> {
  const [{ n }] = await clientAgee!.$queryRawUnsafe<{ n: number }[]>(
    `SELECT count(*)::int AS n FROM "${table}"`,
  );
  return n;
}

describe("les migrations rejouées sur une base âgée", () => {
  it("s'appliquent toutes, et chaque resserrement rencontre des LIGNES", async () => {
    // TÉMOIN : sans arrêt, ce scénario ne rejouerait rien et resterait vert.
    expect(ARRETS.length).toBeGreaterThan(0);

    const administration = new PrismaClient({
      datasources: { db: { url: urlOwner() } },
    });
    try {
      await administration.$executeRawUnsafe(
        `DROP DATABASE IF EXISTS "${BASE_AGEE}"`,
      );
      await administration.$executeRawUnsafe(`CREATE DATABASE "${BASE_AGEE}"`);
    } finally {
      await administration.$disconnect();
    }
    clientAgee = new PrismaClient({
      datasources: { db: { url: urlBaseAgee() } },
    });

    const racineTemp = mkdtempSync(join(tmpdir(), "codiplan-base-agee-"));
    const prismaTemp = join(racineTemp, "prisma");
    mkdirSync(join(prismaTemp, "migrations"), { recursive: true });
    cpSync(
      join(process.cwd(), "prisma", "schema.prisma"),
      join(prismaTemp, "schema.prisma"),
    );
    cpSync(
      join(RACINE, "migration_lock.toml"),
      join(prismaTemp, "migrations", "migration_lock.toml"),
    );

    /** Copie les migrations strictement antérieures à `borne` (toutes si nulle). */
    const copierJusqua = (borne: string | null): void => {
      for (const migration of MIGRATIONS) {
        if (borne !== null && migration.nom >= borne) break;
        const cible = join(prismaTemp, "migrations", migration.nom);
        if (!existsSync(cible)) {
          cpSync(join(RACINE, migration.nom), cible, { recursive: true });
        }
      }
    };

    const deployer = (): void => {
      execFileSync(
        "pnpm",
        [
          "exec",
          "prisma",
          "migrate",
          "deploy",
          "--schema",
          join(prismaTemp, "schema.prisma"),
        ],
        { env: { ...process.env, DATABASE_URL: urlBaseAgee() }, stdio: "pipe" },
      );
    };

    const videsDeclarees = new Set(
      TABLES_VIDES_AU_RESSERREMENT.map((e) => `${e.migration}/${e.table}`),
    );
    const videsRencontrees = new Set<string>();
    let amorcesJouees = 0;

    for (const arret of [...ARRETS, null]) {
      copierJusqua(arret);
      deployer();
      if (arret === null) break;

      const amorce = join(AMORCES, `${arret}.sql`);
      if (existsSync(amorce)) {
        // UNE AMORCE EST UN LOT, et elle est jouée DANS UNE TRANSACTION : une
        // amorce à moitié posée est pire qu'une absente — *elle laisse une base
        // qu'on croit vieillie et qui ne l'est qu'à moitié*, et c'est ainsi que
        // ce harnais a annoncé « toutes appliquées » sur une base vide à sa
        // première exécution.
        //
        // Instruction par instruction, et non par `psql` : le rejeu ne doit
        // dépendre d'aucun binaire que l'exécuteur d'intégration continue
        // pourrait ne pas porter. *Mesuré : `$executeRawUnsafe` refuse un lot
        // multi-instructions (42601), d'où le découpage.*
        const instructions = instructionsDe(readFileSync(amorce, "utf8"));
        expect(
          instructions.length,
          `amorce vide : ${arret}.sql ne pose aucune ligne`,
        ).toBeGreaterThan(0);
        await clientAgee.$transaction(
          instructions.map((sql) => clientAgee!.$executeRawUnsafe(sql)),
        );
        amorcesJouees += 1;
      }

      for (const table of new Set(
        TROUVES.filter((r) => r.migration === arret).map((r) => r.table),
      )) {
        const compte = await lignes(table);
        const cle = `${arret}/${table}`;
        if (compte === 0) {
          expect(
            videsDeclarees.has(cle),
            `${arret} resserre « ${table} » et la table est VIDE : la migration ` +
              "ne serait éprouvée contre rien. Ajouter les lignes dans " +
              `tests/isolation/fixtures/base-agee/${arret}.sql, ou — si aucun ` +
              "chemin ne pouvait la remplir à ce point de l'histoire — l'inscrire " +
              "dans TABLES_VIDES_AU_RESSERREMENT avec sa MESURE.",
          ).toBe(true);
          videsRencontrees.add(cle);
        } else if (videsDeclarees.has(cle)) {
          // LE SENS QU'ON OUBLIE : l'entrée exemptait sans raison.
          expect(
            compte,
            `${cle} est déclarée impossible à remplir, et le rejeu y trouve ` +
              `${compte} ligne(s). L'entrée exempte sans raison : la retirer.`,
          ).toBe(0);
        }
      }
    }

    // TÉMOINS. Sans amorce jouée, le rejeu aurait traversé une base vide et
    // conclu « toutes appliquées » — c'est littéralement ce qu'il a fait à sa
    // première exécution.
    expect(amorcesJouees).toBeGreaterThan(0);
    expect([...videsDeclarees].filter((c) => !videsRencontrees.has(c))).toEqual(
      [],
    );

    // ── LA LIGNE QUI A CASSÉ LA PRODUCTION, ET CE QU'ELLE EST DEVENUE ──────
    //
    // ~~`expect(survivante.statut).toBe("suspendue")`~~ — cette assertion
    // décrivait le monde d'avant R3-02 : `NOT VALID` laissait la ligne
    // tranquille, et la suite le constatait. **C'est exactement cette paix-là
    // qui a coûté une base le 12/09/2026** : la contrainte acceptait la ligne
    // au repos et l'a refusée dès que le semis l'a touchée, et la seule sortie
    // trouvée à 23 h a été de tout purger.
    //
    // Elle prouve désormais l'inverse, et c'est une assertion plus forte : la
    // ligne a **traversé le rattrapage**. Sans motif, elle ne pouvait pas
    // rester suspendue — *une suspension qui ne peut pas dire pourquoi n'est
    // pas une suspension* (D117) —, et le statut qu'elle reçoit est celui que
    // sa date et son créneau dictent, par la règle de `statutALaCreation` :
    // **`a_planifier`**, l'amorce ne lui donnant ni l'une ni l'autre.
    expect(await lignes("intervention")).toBeGreaterThan(0);
    const [survivante] = await clientAgee.$queryRawUnsafe<
      {
        statut: string;
        motif_suspension: string | null;
        suspendue_le: Date | null;
      }[]
    >(
      `SELECT "statut"::text, "motif_suspension", "suspendue_le" FROM "intervention"`,
    );
    expect(survivante.statut).toBe("a_planifier");
    // LES DEUX COLONNES PARTENT AVEC L'ÉTAT. Les laisser ferait un RÉSIDU,
    // c'est-à-dire l'autre sens de la même contrainte — et le `VALIDATE` qui
    // suit refuserait. *Ce n'est donc pas du zèle : c'est la condition pour que
    // la migration aille jusqu'au bout.*
    expect(survivante.motif_suspension).toBeNull();
    expect(survivante.suspendue_le).toBeNull();

    // ── ET LES DEUX CONTRAINTES SONT VALIDÉES, ce qui est le point du ticket ─
    //
    // *C'est le seul geste qui transforme « vaut pour les lignes nouvelles » en
    // « vaut pour toutes ».* Le lire ici plutôt que de croire la migration :
    // `VALIDATE CONSTRAINT` relit toutes les lignes, et une assertion sur le
    // catalogue dit qu'il l'a fait.
    const validees = await clientAgee.$queryRawUnsafe<
      { conname: string; convalidated: boolean }[]
    >(`SELECT "conname", "convalidated"
         FROM pg_constraint
        WHERE "conname" IN ('intervention_suspension_a_son_motif',
                            'intervention_suspension_a_sa_date')`);
    // TÉMOIN : zéro contrainte lue rendrait la boucle suivante vide (§9, 30/08).
    expect(validees).toHaveLength(2);
    for (const contrainte of validees) {
      expect(contrainte.convalidated, contrainte.conname).toBe(true);
    }
  }, 300_000);
});

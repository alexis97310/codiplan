import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

import { fermerClients, urlOwner } from "./setup/db";

/**
 * Les instructions d'une amorce, commentaires retirés — copie délibérée de
 * `instructionsDe` (`tests/isolation/migrations-sur-base-agee.test.ts`), et
 * non un import : ce fichier-là enregistre son propre `describe` à
 * l'évaluation du module, et l'importer rejouerait son rejeu complet (300 s)
 * comme effet de bord de celui-ci. Même règle de découpage : aucun littéral
 * de cette amorce ne porte de point-virgule.
 */
function instructionsDe(sql: string): string[] {
  return sql
    .split("\n")
    .filter((ligne) => !/^\s*--/.test(ligne))
    .join("\n")
    .split(";")
    .map((instruction) => instruction.trim())
    .filter((instruction) => instruction.length > 0);
}

/**
 * 9H1C-MIGRATIONS-SOUS-RLS — LES RATTRAPAGES DE 9H1 ET 9H2, SOUS LE VRAI RÔLE.
 *
 * ## CE QUE `migrations-sur-base-agee.test.ts` NE POUVAIT PAS VOIR
 *
 * Son rejeu joue `prisma migrate deploy` sous `urlOwner()` — sur la base
 * jetable de ce poste, ce rôle est SUPERUTILISATEUR, et un superutilisateur
 * contourne `FORCE ROW LEVEL SECURITY` par construction
 * (`tests/isolation/setup/db.ts`, en tête de `clientOwner`). Les deux
 * rattrapages réparés par ce lot (`20261022210000_rapport_valide_avant_cloture`,
 * `20261023073000_numerotation_interventions_demandes_9h2`) tournent, sur la
 * base hébergée, sous un propriétaire NON superutilisateur — et c'est SOUS LUI
 * SEUL que `FORCE` aveugle le rôle de migration (§9, 07/09,
 * `scripts/lib/gardes-migration.ts`). Ce fichier reproduit cette forme-là.
 *
 * ## LA PREUVE DU ROUGE, ET POURQUOI ELLE N'EST PAS ICI
 *
 * Avant le correctif de ce lot (point 1), ce scénario — rejoué à la main sur
 * les DEUX migrations telles qu'elles existaient avant ce commit — réussissait
 * SANS LA MOINDRE ERREUR tout en ne touchant AUCUNE ligne : `rapport_valide_le`
 * restait NUL sur l'intervention clôturée, et `numero`/`annee` restaient NULS
 * sur les six interventions et les cinq demandes de l'amorce. *Elle ne se
 * trompait pas, elle ne regardait rien.* Cet essai n'a jamais été commité —
 * un test qui encoderait un défaut qu'on vient de réparer serait un test mort
 * à la minute où il passerait —, et il n'est donc pas rejouable depuis ce
 * fichier ; la mesure a été faite une fois, à la main, avant d'écrire le
 * correctif.
 *
 * ## LA FORME DU RÔLE, ET POURQUOI ELLE SUFFIT
 *
 * `role_9h1c_proprietaire` : `LOGIN NOSUPERUSER NOBYPASSRLS` — rien de plus.
 * `codiplan_app` et `codiplan_reporting` existent déjà au cluster (créés par
 * d'autres bases de ce même conteneur), si bien que les migrations qui les
 * créent sautent leur `CREATE ROLE` (gardée par un test d'existence) et ce
 * rôle n'a donc jamais besoin de `CREATEROLE` — exactement le chemin de
 * production que `20260820130000_force_rls_role_applicatif` décrit en tête.
 */

const RACINE = join(process.cwd(), "prisma", "migrations");
const AMORCE = join(
  process.cwd(),
  "tests",
  "isolation",
  "fixtures",
  "9h1c-role-reel",
  "amorce.sql",
);

/** La borne : tout ce qui précède 9H1 est joué une première fois, sans amorce. */
const BORNE_9H1 = "20261022210000_rapport_valide_avant_cloture";

const NOMS_MIGRATIONS: string[] = readdirSync(RACINE)
  .filter((nom) => nom !== "migration_lock.toml")
  .sort();

const BASE = "codiplan_9h1c_role_reel";
const ROLE_PROPRIETAIRE = "role_9h1c_proprietaire";

function urlSousProprietaire(): string {
  const url = new URL(urlOwner());
  url.pathname = `/${BASE}`;
  url.username = ROLE_PROPRIETAIRE;
  url.password = "";
  return url.toString();
}

let clientProprietaire: PrismaClient | undefined;

afterAll(async () => {
  await clientProprietaire?.$disconnect();
  const administration = new PrismaClient({
    datasources: { db: { url: urlOwner() } },
  });
  try {
    await administration.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${BASE}"`);
    await administration.$executeRawUnsafe(
      `DO $$ BEGIN
         IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${ROLE_PROPRIETAIRE}') THEN
           EXECUTE 'DROP OWNED BY "${ROLE_PROPRIETAIRE}"';
           EXECUTE 'DROP ROLE "${ROLE_PROPRIETAIRE}"';
         END IF;
       END $$`,
    );
  } finally {
    await administration.$disconnect();
  }
  await fermerClients();
});

describe("les rattrapages de 9H1 et 9H2, sous le propriétaire NON superutilisateur", () => {
  it("numérotent et valident toutes les lignes, sur une base remplie, sous le VRAI rôle", async () => {
    // TÉMOIN : sans la borne, ce scénario rejouerait tout d'un coup et ne
    // prouverait rien sur la base REMPLIE spécifiquement.
    expect(NOMS_MIGRATIONS).toContain(BORNE_9H1);
    const indexBorne = NOMS_MIGRATIONS.indexOf(BORNE_9H1);
    const avant = NOMS_MIGRATIONS.slice(0, indexBorne);
    const apres = NOMS_MIGRATIONS.slice(indexBorne); // 9H1 puis 9H2.
    expect(avant.length).toBeGreaterThan(10);
    expect(apres).toHaveLength(2);

    const administration = new PrismaClient({
      datasources: { db: { url: urlOwner() } },
    });
    try {
      await administration.$executeRawUnsafe(
        `DROP DATABASE IF EXISTS "${BASE}"`,
      );
      await administration.$executeRawUnsafe(
        `DO $$ BEGIN
             IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${ROLE_PROPRIETAIRE}') THEN
               EXECUTE 'DROP OWNED BY "${ROLE_PROPRIETAIRE}"';
               EXECUTE 'DROP ROLE "${ROLE_PROPRIETAIRE}"';
             END IF;
           END $$`,
      );
      await administration.$executeRawUnsafe(
        `CREATE ROLE "${ROLE_PROPRIETAIRE}" LOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT`,
      );
      await administration.$executeRawUnsafe(
        `CREATE DATABASE "${BASE}" OWNER "${ROLE_PROPRIETAIRE}"`,
      );
    } finally {
      await administration.$disconnect();
    }

    const racineTemp = mkdtempSync(join(tmpdir(), "codiplan-9h1c-role-reel-"));
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
    for (const nom of avant) {
      cpSync(join(RACINE, nom), join(prismaTemp, "migrations", nom), {
        recursive: true,
      });
    }

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
        {
          env: { ...process.env, DATABASE_URL: urlSousProprietaire() },
          stdio: "pipe",
        },
      );
    };

    // ── 1. TOUTE L'HISTOIRE ANTÉRIEURE À 9H1, SOUS LE VRAI RÔLE ──────────
    deployer();

    clientProprietaire = new PrismaClient({
      datasources: { db: { url: urlSousProprietaire() } },
    });

    // ── 2. L'AMORCE — FORCE est levé pour la durée du seul peuplement ────
    //
    // Peupler n'est pas éprouver : ce que ce scénario mesure commence une
    // fois FORCE rendu, au moment où 9H1 et 9H2 s'exécutent réellement.
    const forcees = await clientProprietaire.$queryRawUnsafe<
      { relname: string }[]
    >(
      `SELECT relname FROM pg_class WHERE relforcerowsecurity AND relkind IN ('r','p')`,
    );
    expect(forcees.length).toBeGreaterThan(5);
    for (const { relname } of forcees) {
      await clientProprietaire.$executeRawUnsafe(
        `ALTER TABLE "${relname}" NO FORCE ROW LEVEL SECURITY`,
      );
    }

    const instructions = instructionsDe(readFileSync(AMORCE, "utf8"));
    expect(instructions.length).toBeGreaterThan(10);
    await clientProprietaire.$transaction(
      instructions.map((sql) => clientProprietaire!.$executeRawUnsafe(sql)),
    );

    for (const { relname } of forcees) {
      await clientProprietaire.$executeRawUnsafe(
        `ALTER TABLE "${relname}" FORCE ROW LEVEL SECURITY`,
      );
    }

    // ── 3. 9H1 PUIS 9H2, SOUS LE MÊME RÔLE, CONTRE LA BASE REMPLIE ───────
    for (const nom of apres) {
      cpSync(join(RACINE, nom), join(prismaTemp, "migrations", nom), {
        recursive: true,
      });
    }
    deployer();

    // ── 4. LES ATTENDUS, LUS SOUS LE PROPRIÉTAIRE APRÈS LEVÉE PONCTUELLE ─
    //
    // Le propriétaire reste soumis à FORCE après coup (c'est tout le point
    // de ce lot) : la LECTURE de vérification doit lever le drapeau, exactement
    // comme le rattrapage lui-même, pour ne pas confondre « zéro ligne
    // réparée » et « zéro ligne vue ».
    await clientProprietaire.$executeRawUnsafe(
      `ALTER TABLE "intervention" NO FORCE ROW LEVEL SECURITY`,
    );
    await clientProprietaire.$executeRawUnsafe(
      `ALTER TABLE "demande" NO FORCE ROW LEVEL SECURITY`,
    );
    await clientProprietaire.$executeRawUnsafe(
      `ALTER TABLE "compteur_numerotation" NO FORCE ROW LEVEL SECURITY`,
    );

    const interventions = await clientProprietaire.$queryRawUnsafe<
      {
        id: string;
        statut: string;
        rapport_valide_par: string | null;
        rapport_valide_le: Date | null;
        numero: number | null;
        annee: number | null;
        duree_estimee_min: number | null;
        statut_facturation: string | null;
        temps_valide_par: string | null;
        temps_valide_le: Date | null;
      }[]
    >(
      `SELECT "id", "statut"::text, "rapport_valide_par", "rapport_valide_le",
                "numero", "annee", "duree_estimee_min",
                "statut_facturation"::text, "temps_valide_par", "temps_valide_le"
           FROM "intervention" ORDER BY "id"`,
    );
    // TÉMOIN : l'amorce pose onze interventions (9H1D en ajoute cinq, qui
    // reproduisent l'état hérité qui a cassé la production le 24/10/2026) —
    // un décompte à zéro ne prouverait rien.
    expect(interventions).toHaveLength(11);
    for (const ligne of interventions) {
      expect(ligne.numero, ligne.id).not.toBeNull();
      expect(ligne.annee, ligne.id).not.toBeNull();
    }

    const cloturee_avec_date = interventions.find(
      (i) => i.id === "01920000-0000-7000-8000-00000000b00b",
    )!;
    expect(cloturee_avec_date.rapport_valide_par).toBeNull();
    expect(cloturee_avec_date.rapport_valide_le).not.toBeNull();

    const cloturee_sans_date = interventions.find(
      (i) => i.id === "01920000-0000-7000-8000-00000000b00c",
    )!;
    expect(cloturee_sans_date.rapport_valide_le).toBeNull();

    // ── 9H1D — LES TROIS LIGNES HÉRITÉES QUI VIOLENT CHACUNE UNE CONTRAINTE
    // « NOT VALID », RATTRAPÉES (numéro, année) SANS QUE LA LIGNE ELLE-MÊME
    // SOIT TOUCHÉE — rien n'est validé, rien n'est inventé à leur place.
    const planifieeSansDuree = interventions.find(
      (i) => i.id === "01920000-0000-7000-8000-00000000b010",
    )!;
    expect(planifieeSansDuree.numero).toBe(7);
    expect(planifieeSansDuree.annee).toBe(2026);
    expect(planifieeSansDuree.duree_estimee_min).toBeNull();

    const clotureeSansFacturation = interventions.find(
      (i) => i.id === "01920000-0000-7000-8000-00000000b011",
    )!;
    expect(clotureeSansFacturation.numero).toBe(8);
    expect(clotureeSansFacturation.annee).toBe(2026);
    expect(clotureeSansFacturation.statut_facturation).toBeNull();

    const validationIncoherente = interventions.find(
      (i) => i.id === "01920000-0000-7000-8000-00000000b012",
    )!;
    expect(validationIncoherente.numero).toBe(9);
    expect(validationIncoherente.annee).toBe(2026);
    expect(validationIncoherente.temps_valide_par).not.toBeNull();
    expect(validationIncoherente.temps_valide_le).toBeNull();

    // ── 9H1D — DEUX ANNÉES CIVILES POUR LA MÊME SOCIÉTÉ, DONT UNE À LA
    // FRONTIÈRE DU 31/12 À NOUMÉA. `b014` (00 h 30 le 1er janvier 2026 à
    // Nouméa, encore le 31 décembre 2025 en UTC) numérote 2026, PAS 2025 :
    // la preuve que le rattrapage lit l'année au fuseau de Nouméa et non en
    // UTC, pour une colonne SANS fuseau (voir le commentaire de la migration).
    const anneeCivile2025 = interventions.find(
      (i) => i.id === "01920000-0000-7000-8000-00000000b013",
    )!;
    expect(anneeCivile2025.annee).toBe(2025);
    expect(anneeCivile2025.numero).toBe(1);

    const frontiereNouvelAn = interventions.find(
      (i) => i.id === "01920000-0000-7000-8000-00000000b014",
    )!;
    expect(frontiereNouvelAn.annee).toBe(2026);
    expect(frontiereNouvelAn.numero).toBe(1);

    // LES TROIS CONTRAINTES RESTENT NOT VALID — rien n'est validé pour avoir
    // fait traverser ces lignes héritées au rattrapage.
    const contraintesNotValid = await clientProprietaire.$queryRawUnsafe<
      { conname: string; convalidated: boolean }[]
    >(
      `SELECT "conname", "convalidated" FROM pg_constraint
          WHERE "conname" IN ('intervention_cloture_a_son_statut_facturation',
                              'intervention_validation_tracee',
                              'intervention_planifiee_a_sa_duree')`,
    );
    expect(contraintesNotValid).toHaveLength(3);
    for (const contrainte of contraintesNotValid) {
      expect(contrainte.convalidated, contrainte.conname).toBe(false);
    }

    const demandes = await clientProprietaire.$queryRawUnsafe<
      {
        id: string;
        societe_id: string;
        numero: number | null;
        annee: number | null;
      }[]
    >(
      `SELECT "id", "societe_id", "numero", "annee" FROM "demande" ORDER BY "id"`,
    );
    expect(demandes).toHaveLength(5);
    for (const ligne of demandes) {
      expect(ligne.numero, ligne.id).not.toBeNull();
      expect(ligne.annee, ligne.id).not.toBeNull();
    }

    // LES DEUX SOCIÉTÉS NUMÉROTENT INDÉPENDAMMENT : la demande de la
    // société B porte le numéro 1, pas 6 — un compteur qui aurait traversé
    // le cloisonnement les aurait mélangées.
    const demandeSocieteB = demandes.find(
      (d) => d.societe_id === "01920000-0000-7000-8000-00000000b101",
    )!;
    expect(demandeSocieteB.numero).toBe(1);

    const compteurs = await clientProprietaire.$queryRawUnsafe<
      {
        societe_id: string;
        nature: string;
        annee: number;
        dernier_numero: number;
      }[]
    >(
      `SELECT "societe_id", "nature"::text, "annee", "dernier_numero"
           FROM "compteur_numerotation" ORDER BY "societe_id", "nature"`,
    );
    // CINQ LIGNES : société A porte désormais DEUX compteurs d'intervention
    // (2025 et 2026, 9H1D) là où elle n'en portait qu'un avant ces lignes.
    expect(compteurs).toHaveLength(5);
    const compteurInterventionA2026 = compteurs.find(
      (c) =>
        c.societe_id === "01920000-0000-7000-8000-00000000b001" &&
        c.nature === "intervention" &&
        c.annee === 2026,
    )!;
    expect(compteurInterventionA2026.dernier_numero).toBe(9);
    const compteurInterventionA2025 = compteurs.find(
      (c) =>
        c.societe_id === "01920000-0000-7000-8000-00000000b001" &&
        c.nature === "intervention" &&
        c.annee === 2025,
    )!;
    expect(compteurInterventionA2025.dernier_numero).toBe(1);
    const compteurDemandeA = compteurs.find(
      (c) =>
        c.societe_id === "01920000-0000-7000-8000-00000000b001" &&
        c.nature === "demande",
    )!;
    expect(compteurDemandeA.dernier_numero).toBe(4);

    await clientProprietaire.$executeRawUnsafe(
      `ALTER TABLE "intervention" FORCE ROW LEVEL SECURITY`,
    );
    await clientProprietaire.$executeRawUnsafe(
      `ALTER TABLE "demande" FORCE ROW LEVEL SECURITY`,
    );
    await clientProprietaire.$executeRawUnsafe(
      `ALTER TABLE "compteur_numerotation" FORCE ROW LEVEL SECURITY`,
    );

    // ── 5. LES QUATRE DRAPEAUX SONT RENDUS — PAS SEULEMENT DEMANDÉS ──────
    const etatFinal = await clientProprietaire.$queryRawUnsafe<
      { relname: string; relforcerowsecurity: boolean }[]
    >(
      `SELECT relname, relforcerowsecurity FROM pg_class
          WHERE relname IN ('intervention', 'demande', 'compteur_numerotation', 'journal_audit')`,
    );
    expect(etatFinal).toHaveLength(4);
    for (const table of etatFinal) {
      expect(table.relforcerowsecurity, table.relname).toBe(true);
    }

    // ── 6. LES DÉCLENCHEURS SUSPENDUS SONT RÉTABLIS, ET ILS REFUSENT DE NOUVEAU ─
    //
    // `intervention_facturation_a_la_cloture` est suspendu par L'AMORCE elle-
    // même (9H1D, pour poser « b011 » sans qu'il ne lui impose un statut de
    // facturation) — pas par la migration. Le vérifier ici prouve que
    // l'amorce l'a bien rétabli avant même que 9H2 ne s'exécute.
    const declencheurs = await clientProprietaire.$queryRawUnsafe<
      { tgname: string; tgenabled: string }[]
    >(
      `SELECT tgname, tgenabled FROM pg_trigger
          WHERE tgrelid = 'intervention'::regclass
            AND tgname IN ('intervention_cycle_de_vie', 'pas_sur_blocage_agenda',
                           'intervention_facturation_a_la_cloture')`,
    );
    expect(declencheurs).toHaveLength(3);
    for (const declencheur of declencheurs) {
      expect(declencheur.tgenabled, declencheur.tgname).toBe("O");
    }

    // Une clôturée reste intouchable après coup, exactement comme avant —
    // le rattrapage n'a pas ouvert de brèche permanente. FORCE est relevé
    // ici aussi : sans lui, le propriétaire ne verrait pas la ligne, et un
    // `UPDATE` qui ne touche RIEN ne prouverait pas que le déclencheur
    // refuse — seulement qu'il n'a jamais été appelé.
    await clientProprietaire.$executeRawUnsafe(
      `ALTER TABLE "intervention" NO FORCE ROW LEVEL SECURITY`,
    );
    await expect(
      clientProprietaire.$executeRawUnsafe(
        `UPDATE "intervention" SET "description" = 'x' WHERE "id" = '01920000-0000-7000-8000-00000000b00b'`,
      ),
    ).rejects.toThrow(/clôturée.*ne se modifie plus/);
    await clientProprietaire.$executeRawUnsafe(
      `ALTER TABLE "intervention" FORCE ROW LEVEL SECURITY`,
    );
  }, 300_000);
});

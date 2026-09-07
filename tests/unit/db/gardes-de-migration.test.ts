import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  GARDES_AVEUGLES_CONNUES,
  ecartsGardes,
  gardesAveugles,
  migrationsConnues,
  tablesLuesSousForce,
  type MigrationLue,
} from "../../../scripts/lib/gardes-migration";

/**
 * LA RÈGLE DES BLOCS DE GARDE — et non la réparation d'un cas (L1-02, 07/09).
 *
 * L'incident : le bloc de garde de `20260823130000` lit `agence` sous
 * `FORCE ROW LEVEL SECURITY`. Sur la base hébergée, dont le rôle de migration
 * est propriétaire NON superutilisateur, il voit zéro ligne et ne peut donc
 * rien refuser. Ce n'est pas cette migration qui est en cause, c'est la
 * CLASSE — et c'est la classe qui se garde ici. Le raisonnement complet est en
 * tête de `scripts/lib/gardes-migration.ts`.
 */

const MIGRATIONS = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "prisma",
  "migrations",
);

function migrations(): MigrationLue[] {
  return readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((entree) => entree.isDirectory())
    .map((entree) => ({
      nom: entree.name,
      sql: readFileSync(join(MIGRATIONS, entree.name, "migration.sql"), "utf8"),
    }));
}

describe("les blocs de garde des migrations ne lisent pas à l'aveugle", () => {
  const lues = migrations();

  it("le gardien a réellement lu des migrations, et des blocs de garde", () => {
    // DEUX témoins de non-vacuité, et le second est celui qui compte : des
    // migrations lues sans qu'aucun bloc `DO` ne soit reconnu signifierait que
    // le motif est aveugle — et le contrôle serait vert pour toujours.
    expect(lues.length).toBeGreaterThan(10);

    const avecBloc = lues.filter((m) => /DO\s+\$\$/i.test(m.sql));
    expect(
      avecBloc.length,
      "aucun bloc `DO $$` reconnu dans les migrations : le motif ne " +
        "reconnaît rien de réel",
    ).toBeGreaterThanOrEqual(3);
  });

  it("l'INVENTAIRE est exact : une seule migration appliquée porte le défaut", () => {
    // La liste que le directeur d'exploitation a demandée, et le gardien la
    // vérifie plutôt que de la croire : ce qui est inventorié est exactement ce
    // qui est trouvé, ni plus ni moins.
    const trouvees = new Set(
      lues.flatMap((m) => gardesAveugles(m)).map((g) => g.migration),
    );
    const inventoriees = new Set(migrationsConnues());

    // Les migrations déjà appliquées et défectueuses sont celles de la liste.
    for (const nom of inventoriees) {
      expect(
        trouvees.has(nom),
        `« ${nom} » est inventoriée comme aveugle, et le contrôle ne la ` +
          "trouve pas : l'inventaire décrit un défaut qui n'existe plus, ou " +
          "le motif a cessé de le reconnaître",
      ).toBe(true);
    }
    expect([...inventoriees]).toEqual([
      "20260823130000_territoire_du_ferie_reference",
    ]);
  });

  it("la migration de L1-02, elle, LÈVE le drapeau et constate la levée", () => {
    // La contre-épreuve sur le cas réel : sans elle, un motif qui déclarerait
    // tout le monde aveugle passerait le scénario précédent.
    const l102 = lues.find((m) => m.nom.endsWith("_site_l1_02"));
    expect(l102).toBeDefined();
    expect(gardesAveugles(l102 as MigrationLue)).toEqual([]);
  });

  it("aucun ÉCART : tout bloc aveugle est soit protégé, soit inventorié", () => {
    expect(ecartsGardes(lues), ecartsGardes(lues).join("\n")).toEqual([]);
  });

  it("ÉPREUVE : une migration NEUVE qui lit à l'aveugle est refusée", () => {
    // La faute, écrite dans la forme qu'elle prendrait réellement — un bloc de
    // garde de bonne foi, qui compte des lignes pour refuser un état.
    const ecarts = ecartsGardes([
      ...lues,
      {
        nom: "20261001000000_ticket_futur",
        sql: `
          DO $$
          DECLARE fautives bigint;
          BEGIN
            SELECT count(*) INTO fautives FROM "client" WHERE "actif" IS NULL;
            IF fautives > 0 THEN
              RAISE EXCEPTION 'Migration refusée : % fiche(s).', fautives;
            END IF;
          END
          $$;
        `,
      },
    ]);

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("20261001000000_ticket_futur");
    expect(ecarts[0]).toContain("« client »");
    expect(ecarts[0]).toContain("il ne regarde rien");
  });

  it("ÉPREUVE : la même migration AVEC la levée et le témoin passe", () => {
    // Ce qui distingue les deux n'est pas la prudence de l'auteur : ce sont
    // les deux gestes que la règle nomme.
    expect(
      ecartsGardes([
        ...lues,
        {
          nom: "20261001000000_ticket_futur",
          sql: `
            ALTER TABLE "client" NO FORCE ROW LEVEL SECURITY;
            DO $$
            DECLARE aveugle boolean; fautives bigint;
            BEGIN
              SELECT bool_or("c"."relforcerowsecurity") INTO aveugle
                FROM "pg_catalog"."pg_class" "c" WHERE "c"."relname" = 'client';
              IF aveugle IS DISTINCT FROM false THEN
                RAISE EXCEPTION 'Contrôle creux.';
              END IF;
              SELECT count(*) INTO fautives FROM "client" WHERE "actif" IS NULL;
              IF fautives > 0 THEN
                RAISE EXCEPTION 'Migration refusée : % fiche(s).', fautives;
              END IF;
            END
            $$;
            ALTER TABLE "client" FORCE ROW LEVEL SECURITY;
          `,
        },
      ]),
    ).toEqual([]);
  });

  it("ÉPREUVE : la levée SANS le témoin ne suffit pas", () => {
    // Le second geste est celui qu'on oublie — c'est pour cela qu'il est
    // éprouvé séparément. Une levée sans témoin est verte le jour où elle est
    // écrite et muette le jour où quelqu'un la retire.
    const ecarts = ecartsGardes([
      ...lues,
      {
        nom: "20261001000000_sans_temoin",
        sql: `
          ALTER TABLE "client" NO FORCE ROW LEVEL SECURITY;
          DO $$
          DECLARE fautives bigint;
          BEGIN
            SELECT count(*) INTO fautives FROM "client";
            IF fautives > 0 THEN RAISE EXCEPTION 'non'; END IF;
          END
          $$;
          ALTER TABLE "client" FORCE ROW LEVEL SECURITY;
        `,
      },
    ]);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("20261001000000_sans_temoin");
  });

  it("ÉPREUVE : un bloc qui ne lit AUCUNE table cloisonnée ne déclenche rien", () => {
    // La contre-épreuve du bruit : un gardien qui rougirait sur tout bloc `DO`
    // serait inutilisable, et passerait pourtant les épreuves ci-dessus.
    expect(
      ecartsGardes([
        ...lues,
        {
          nom: "20261001000000_sans_lecture",
          sql: `
            DO $$
            BEGIN
              IF to_regclass('public.devise') IS NULL THEN
                RAISE EXCEPTION 'référentiel absent';
              END IF;
            END
            $$;
          `,
        },
      ]),
    ).toEqual([]);
  });

  it("la GRAPHIE ne fait pas échapper — forme 1 du §9", () => {
    // Casse, guillemets, retours à la ligne entre mots-clés : le motif est
    // éprouvé dessus plutôt que sur la seule graphie canonique (§9, 26/08).
    for (const variante of [
      `do $$ begin perform 1 from client; end $$;`,
      `DO $$ BEGIN PERFORM 1 FROM\n   "client"; END $$;`,
      `DO $$ BEGIN PERFORM 1 FROM   CLIENT; END $$;`,
    ]) {
      expect(
        gardesAveugles({ nom: "variante", sql: variante }),
        variante,
      ).toHaveLength(1);
    }
  });

  it("les tables lues sont reconnues à travers FROM et JOIN", () => {
    expect(
      tablesLuesSousForce(
        `SELECT 1 FROM "agence" a JOIN "societe" s ON s.id = a.societe_id`,
      ),
    ).toEqual(["agence", "societe"]);
    // Un référentiel de plateforme n'est PAS sous FORCE (D4) : le lire depuis
    // une migration ne pose aucun problème, et le signaler serait du bruit.
    expect(tablesLuesSousForce(`SELECT 1 FROM "devise"`)).toEqual([]);
  });

  it("l'inventaire est clos des DEUX côtés", () => {
    // Une entrée qui ne s'adosse à aucune migration ne protège plus rien
    // (§9, 31/08 sur les sélections négatives), et une entrée sans
    // justification est un passage plutôt qu'un inventaire.
    expect(GARDES_AVEUGLES_CONNUES.length).toBeGreaterThan(0);
    expect(
      ecartsGardes(lues, [
        { migration: "20990101000000_fantome", justification: "peu importe" },
      ]),
    ).not.toEqual([]);
    expect(
      ecartsGardes(lues, [
        {
          migration: "20260823130000_territoire_du_ferie_reference",
          justification: "   ",
        },
      ]),
    ).not.toEqual([]);
  });
});

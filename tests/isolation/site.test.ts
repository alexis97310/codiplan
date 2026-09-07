import { afterAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "@prisma/client";

import { exigence } from "./setup/contrat";
import {
  avecPortail,
  avecSociete,
  clientApp,
  clientOwner,
  fermerClients,
} from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_A2,
  CLIENT_B1,
  SITE_A1_S1,
  SITE_A1_S2,
  SOCIETE_A,
  SOCIETE_B,
  VAR_SOCIETE,
} from "./setup/fixtures";

/**
 * Le site d'intervention, éprouvé sur la VRAIE table (ticket L1-02 ; I1 ;
 * D10, D22, D23, D48 ; RG-DRO-01).
 *
 * **Ce fichier existe parce que la seconde fixture s'est effacée.** Jusqu'à ce
 * ticket, `site` était une table du harnais. La migration
 * `20260906120000_site_l1_02` l'a créée pour de bon, et `global.ts` ne fabrique
 * plus la fixture : ce sont la table réelle et SA politique que tous les
 * scénarios traversent désormais. Les scénarios de périmètre de
 * `portail-client.test.ts` s'y sont reportés sans qu'une ligne change, ce qui
 * était tout l'objet du contrat de R0-a.
 *
 * **Ce que `site` ajoute et que `client` ne pouvait pas porter : le TROISIÈME
 * filtre.** Sur `client`, la forme « parc » n'a que deux moitiés — société et
 * `app.client_id` —, parce qu'il n'y a pas de site au-dessus d'un client. Ici
 * les trois mordent, et c'est le troisième qui est le plus facile à perdre : ni
 * la société ni le client ne séparent deux sites d'un MÊME client. Seul
 * `app.perimetre_sites` le fait, et c'est très exactement ce que RG-DRO-01
 * appelle « son propre périmètre ».
 *
 * **Chaque refus a son jumeau** (CLAUDE.md §9, 24/08) : un scénario qui retire
 * RÉELLEMENT le verrou visé, dans une transaction annulée, et montre que
 * l'écriture fautive passe alors.
 */

/** Sentinelle d'annulation : elle fait retomber la transaction, sans erreur. */
class Annulation extends Error {}

/** Identifiants jetables, jamais écrits durablement (les scénarios annulent). */
const SITE_NEUF = "aaaaaaaa-0000-7000-8000-0000000000e1";

/**
 * Exécute `travail` sous le PROPRIÉTAIRE, après avoir réellement défait le
 * verrou nommé, puis ANNULE tout.
 *
 * Le DDL est transactionnel en PostgreSQL : la contrainte revient au
 * `ROLLBACK`, et le jumeau rejoue à chaque `pnpm verify`.
 */
async function sansVerrou(
  retrait: readonly string[],
  societeId: string,
  travail: (tx: PrismaClient) => Promise<void>,
): Promise<void> {
  try {
    await clientOwner().$transaction(async (tx) => {
      for (const instruction of retrait) {
        await tx.$executeRawUnsafe(instruction);
      }
      await tx.$executeRawUnsafe(
        "SELECT set_config($1, $2, true)",
        VAR_SOCIETE,
        societeId,
      );
      await travail(tx as unknown as PrismaClient);
      throw new Annulation();
    });
  } catch (erreur) {
    if (!(erreur instanceof Annulation)) {
      throw erreur;
    }
  }
}

/** Insère un site par SQL brut — le chemin que rien ne filtre côté code. */
function insererSite(
  tx: PrismaClient,
  valeurs: {
    id: string;
    societeId: string;
    clientId: string;
    libelle: string;
    latitude?: number | null;
    longitude?: number | null;
  },
): Promise<number> {
  return tx.$executeRawUnsafe(
    `INSERT INTO "site" ("id", "societe_id", "client_id", "libelle", "latitude", "longitude")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6)`,
    valeurs.id,
    valeurs.societeId,
    valeurs.clientId,
    valeurs.libelle,
    valeurs.latitude ?? null,
    valeurs.longitude ?? null,
  );
}

describe("le site d'intervention (L1-02)", () => {
  afterAll(fermerClients);

  // ── 1. La politique en ÉCRITURE — forme « parc », moitié WITH CHECK ───────

  it("un utilisateur de A ne peut pas écrire un site de B", async () => {
    await expect(
      avecSociete(SOCIETE_A, (tx) =>
        insererSite(tx, {
          id: SITE_NEUF,
          societeId: SOCIETE_B,
          clientId: CLIENT_B1,
          libelle: "Lieu déposé chez le voisin",
        }),
      ),
    ).rejects.toThrow(/row-level security|violates row-level security/i);
  });

  it("ÉPREUVE PAR RETRAIT : sans le WITH CHECK, le site part chez le voisin", async () => {
    // Le verrou VISÉ est la moitié écriture de la politique, et non l'une des
    // deux clés étrangères : on remplace la politique par une variante ouverte,
    // tout le reste du schéma est intact, et l'écriture passe.
    let lignes = -1;

    await sansVerrou(
      [
        'DROP POLICY "cloisonnement_parc" ON "site"',
        'CREATE POLICY "tout_ouvert" ON "site" USING (true) WITH CHECK (true)',
      ],
      SOCIETE_A,
      async (tx) => {
        lignes = await insererSite(tx, {
          id: SITE_NEUF,
          societeId: SOCIETE_B,
          clientId: CLIENT_B1,
          libelle: "Lieu déposé chez le voisin",
        });
      },
    );

    expect(lignes).toBe(1);
  });

  // ── 2. LE TROISIÈME FILTRE, prouvé PAR LECTURE ────────────────────────────

  it(
    exigence(
      "perimetre_sites",
      "la clause société ET client, SANS le périmètre, ferait fuir l'autre site (D10)",
    ),
    async () => {
      // **La réparation naturelle, mesurée par ses conséquences.** C'est la
      // faute la plus plausible du ticket : recopier la politique de `client`
      // — société ET `app.client_id` — sur `site`. Elle a l'air juste, elle
      // passe le gardien de la forme « société », et elle perd le filtre qui
      // sépare S1 de S2. Or S1 et S2 appartiennent au MÊME client, dans la
      // MÊME société : aucun des deux autres filtres ne les distingue.
      //
      // `politiques-rls.test.ts` prouve que le gardien s'en apercevrait. Ce
      // scénario-ci prouve l'autre moitié, la plus concrète : ce que le compte
      // portail LIT alors (CLAUDE.md §9, 31/08 — la preuve par lecture est la
      // plus forte).
      let visibles: string[] = [];

      await sansVerrou(
        [
          'DROP POLICY "cloisonnement_parc" ON "site"',
          `CREATE POLICY "cloisonnement_parc_ampute" ON "site"
             USING (
               "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
               AND (
                 NULLIF(current_setting('app.client_id', true), '') IS NULL
                 OR "client_id" = NULLIF(current_setting('app.client_id', true), '')::uuid
               )
             )`,
        ],
        SOCIETE_A,
        async (tx) => {
          // On se place dans la peau du compte portail restreint à S1.
          await tx.$executeRawUnsafe(
            "SELECT set_config('app.client_id', $1, true)",
            CLIENT_A1,
          );
          await tx.$executeRawUnsafe(
            "SELECT set_config('app.perimetre_sites', $1, true)",
            SITE_A1_S1,
          );
          const lues = await tx.$queryRawUnsafe<Array<{ id: string }>>(
            `SELECT "id" FROM "site"
              WHERE "id" = ANY(ARRAY[$1::uuid, $2::uuid]) ORDER BY "id"`,
            SITE_A1_S1,
            SITE_A1_S2,
          );
          visibles = lues.map((ligne) => ligne.id);
        },
      );

      // Sans le troisième filtre, les DEUX sites du client sont atteignables,
      // alors même que le périmètre n'en nomme qu'un. C'est la fuite.
      expect(visibles).toEqual([SITE_A1_S1, SITE_A1_S2].sort());

      // Et sous la politique réelle, rétablie par le ROLLBACK, le compte
      // portail restreint n'en voit qu'un.
      const sousLaVraiePolitique = await avecPortail(
        {
          societeId: SOCIETE_A,
          clientId: CLIENT_A1,
          perimetreSites: [SITE_A1_S1],
        },
        (tx) =>
          tx.$queryRawUnsafe<Array<{ id: string }>>(
            `SELECT "id" FROM "site" ORDER BY "id"`,
          ),
      );
      expect(sousLaVraiePolitique.map((ligne) => ligne.id)).toEqual([
        SITE_A1_S1,
      ]);
    },
  );

  it(
    exigence(
      "perimetre_sites",
      "un compte portail n'ÉCRIT pas non plus hors de son périmètre",
    ),
    async () => {
      // Le périmètre n'est pas qu'une affaire de lecture. Sans la moitié
      // `WITH CHECK`, un compte portail restreint à S1 pourrait MODIFIER S2 —
      // qu'il ne relirait jamais, et dont le propriétaire verrait le libellé
      // changer sans comprendre d'où.
      const touchees = await avecPortail(
        {
          societeId: SOCIETE_A,
          clientId: CLIENT_A1,
          perimetreSites: [SITE_A1_S1],
        },
        (tx) =>
          tx.$executeRawUnsafe(
            `UPDATE "site" SET "libelle" = 'Renommé hors périmètre' WHERE "id" = $1::uuid`,
            SITE_A1_S2,
          ),
      );

      // Zéro ligne touchée : la politique a rendu S2 invisible, et un `UPDATE`
      // ne peut pas atteindre ce qu'il ne voit pas.
      expect(touchees).toBe(0);
    },
  );

  // ── 3. Le chaînage COMPOSITE vers le client (D48) ─────────────────────────

  it("un site ne peut pas désigner le client d'une AUTRE société", async () => {
    // **C'est la raison d'être de la clé COMPOSITE.** Une clé sur `client_id`
    // seul aurait accepté cette ligne : les contrôles d'intégrité référentielle
    // contournent les politiques RLS par construction en PostgreSQL, et le
    // verrou aurait été muet là précisément où le cloisonnement doit mordre.
    //
    // Le SQLSTATE `23503` désigne la violation de clé étrangère, et le message
    // nomme la contrainte — contrairement à l'unicité de L1-01, PostgreSQL la
    // donne ici.
    await expect(
      avecSociete(SOCIETE_A, (tx) =>
        insererSite(tx, {
          id: SITE_NEUF,
          societeId: SOCIETE_A,
          clientId: CLIENT_B1,
          libelle: "Lieu rattaché au client du voisin",
        }),
      ),
    ).rejects.toThrow(/site_client_fkey/);
  });

  it("ÉPREUVE PAR RETRAIT : sans la clé composite, le rattachement croisé passe", async () => {
    // Le jumeau retire LA contrainte visée — et non celle vers `societe`, qui
    // reste en place et laisserait passer cette même ligne.
    let lignes = -1;

    await sansVerrou(
      ['ALTER TABLE "site" DROP CONSTRAINT "site_client_fkey"'],
      SOCIETE_A,
      async (tx) => {
        lignes = await insererSite(tx, {
          id: SITE_NEUF,
          societeId: SOCIETE_A,
          clientId: CLIENT_B1,
          libelle: "Lieu rattaché au client du voisin",
        });
      },
    );

    expect(lignes).toBe(1);
  });

  it("un client qui a des sites ne s'efface pas (ON DELETE RESTRICT)", async () => {
    // L'action référentielle est une règle de gestion déguisée (CLAUDE.md §9,
    // 24/08) : `CASCADE` aurait effacé tout un parc sur un geste
    // d'administration, sans que personne ne l'ait demandé.
    //
    // **Le VOISIN est écarté d'abord, et c'est la troisième exigence du
    // 24/08.** La première rédaction attendait `site_client_fkey` et recevait
    // `utilisateur_client_client_fkey` : le client A1 porte AUSSI une
    // habilitation portail, dont la clé — posée par cette même migration —
    // refuse la suppression avant que celle des sites n'ait son mot à dire. Le
    // test aurait été vert pour la mauvaise raison, et il serait resté vert le
    // jour où `site_client_fkey` aurait disparu. On retire donc l'habilitation
    // dans une transaction ANNULÉE, de sorte que le seul verrou restant soit
    // celui qu'on prétend éprouver.
    let message = "";

    try {
      await clientOwner().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          "SELECT set_config($1, $2, true)",
          VAR_SOCIETE,
          SOCIETE_A,
        );
        await tx.$executeRawUnsafe(
          `DELETE FROM "utilisateur_client" WHERE "client_id" = $1::uuid`,
          CLIENT_A1,
        );
        try {
          await tx.$executeRawUnsafe(
            `DELETE FROM "client" WHERE "id" = $1::uuid`,
            CLIENT_A1,
          );
        } catch (erreur) {
          message = erreur instanceof Error ? erreur.message : String(erreur);
        }
        throw new Annulation();
      });
    } catch (erreur) {
      if (!(erreur instanceof Annulation)) {
        throw erreur;
      }
    }

    // Le verrou qui a mordu est bien celui des SITES, nommé.
    expect(message).toMatch(/site_client_fkey/);
  });

  // ── 4. Le libellé, contrôlé EN BASE ───────────────────────────────────────

  it("la base refuse un libellé vide", async () => {
    await expect(
      avecSociete(SOCIETE_A, (tx) =>
        insererSite(tx, {
          id: SITE_NEUF,
          societeId: SOCIETE_A,
          clientId: CLIENT_A1,
          libelle: "   ",
        }),
      ),
    ).rejects.toThrow(/site_libelle_non_vide/);
  });

  it("ÉPREUVE PAR RETRAIT : sans la contrainte, le site sans nom passe", async () => {
    let lignes = -1;

    await sansVerrou(
      ['ALTER TABLE "site" DROP CONSTRAINT "site_libelle_non_vide"'],
      SOCIETE_A,
      async (tx) => {
        lignes = await insererSite(tx, {
          id: SITE_NEUF,
          societeId: SOCIETE_A,
          clientId: CLIENT_A1,
          libelle: "   ",
        });
      },
    );

    expect(lignes).toBe(1);
  });

  // ── 5. Les bornes des coordonnées ─────────────────────────────────────────

  it("la base refuse une latitude hors bornes — l'inversion lat/lon", async () => {
    // Nouméa est à (−22,27 ; 166,45). Les inverser donne une latitude de
    // 166,45, que la borne attrape : c'est la faute de saisie la plus fréquente
    // sur des coordonnées, et elle est silencieuse sans contrainte.
    await expect(
      avecSociete(SOCIETE_A, (tx) =>
        insererSite(tx, {
          id: SITE_NEUF,
          societeId: SOCIETE_A,
          clientId: CLIENT_A1,
          libelle: "Coordonnées inversées",
          latitude: 166.4572,
          longitude: -22.2758,
        }),
      ),
    ).rejects.toThrow(/site_latitude_bornee/);
  });

  it("ÉPREUVE PAR RETRAIT : sans la borne, les coordonnées inversées passent", async () => {
    let lignes = -1;

    await sansVerrou(
      ['ALTER TABLE "site" DROP CONSTRAINT "site_latitude_bornee"'],
      SOCIETE_A,
      async (tx) => {
        lignes = await insererSite(tx, {
          id: SITE_NEUF,
          societeId: SOCIETE_A,
          clientId: CLIENT_A1,
          libelle: "Coordonnées inversées",
          latitude: 166.4572,
          longitude: -22.2758,
        });
      },
    );

    expect(lignes).toBe(1);
  });

  // ── 6. Le témoin : la table est bien celle de la migration ────────────────

  it("le gardien lit la table RÉELLE, et non une fixture du harnais", async () => {
    // Témoin de non-vacuité (CLAUDE.md §9, 30/08) : si le harnais fabriquait
    // encore sa fixture, elle ne porterait que `id`, `societe_id`, `client_id`
    // et `libelle`, et ces scénarios éprouveraient une autre table que celle de
    // la production.
    const colonnes = await clientApp().$queryRawUnsafe<
      Array<{ column_name: string }>
    >(
      `SELECT "column_name"::text FROM "information_schema"."columns"
        WHERE "table_schema" = 'public' AND "table_name" = 'site'
        ORDER BY "column_name"`,
    );
    const noms = colonnes.map((colonne) => colonne.column_name);

    for (const attendue of [
      "commune",
      "zone_geo",
      "latitude",
      "longitude",
      "consignes_acces",
      "horaires",
      "temps_trajet_min",
      "actif",
    ]) {
      expect(noms, attendue).toContain(attendue);
    }
  });

  it("le site est AUDITÉ, et personne n'a eu à l'inscrire nulle part (D55)", async () => {
    // **La propriété de D55, éprouvée en base plutôt que sur le schéma.** Le
    // gardien statique lit les migrations ; celui-ci lit le CATALOGUE, et il
    // constate en plus que le déclencheur ÉCRIT — un déclencheur posé mais
    // inopérant serait vert des deux côtés.
    let avant = -1;
    let apres = -1;

    await sansVerrou([], SOCIETE_A, async (tx) => {
      const compte = async (): Promise<number> => {
        const lignes = await tx.$queryRawUnsafe<Array<{ n: bigint }>>(
          `SELECT count(*) AS n FROM "journal_audit" WHERE "entite" = 'site'`,
        );
        return Number(lignes[0]?.n ?? -1);
      };
      avant = await compte();
      await insererSite(tx, {
        id: SITE_NEUF,
        societeId: SOCIETE_A,
        clientId: CLIENT_A2,
        libelle: "Lieu tracé par le déclencheur",
      });
      apres = await compte();
    });

    expect(avant).toBeGreaterThanOrEqual(0);
    expect(apres).toBe(avant + 1);
  });
});

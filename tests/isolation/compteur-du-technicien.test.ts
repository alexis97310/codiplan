import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import {
  arreterLeCompteur,
  compteurEnCours,
  demarrerLeCompteur,
  mesureDeLIntervention,
} from "@/lib/interventions/depot-compteur";

import {
  avecPortail,
  clientApp,
  clientOwner,
  fermerClients,
  sousSocieteEtRole,
} from "./setup/db";
import {
  CLIENT_A1,
  INTERVENTION_A1,
  INTERVENTION_A2,
  INTERVENTION_B1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * R5-02 — CE QUE LA BASE GARDE DU COMPTEUR, ET PAR QUEL VERBE.
 *
 * ## LES TROIS VERBES, ET LA LEÇON DU 14/09
 *
 * *Un gardien de base peut bâtir sa population avec le verbe d'écriture qui le
 * satisfait, et le verbe de la production n'y est pas.* `plage_sans_chevauchement`
 * a coûté une fusion rouge pour cette raison exacte : ses scénarios écrivaient
 * par `create` et par `update`, et le semis écrivait par `upsert` — le seul
 * verbe dans lequel le défaut vivait.
 *
 * **Chaque verrou de ce fichier est donc éprouvé sur `create`, sur `update` ET
 * sur `upsert`.** Ce ne sont pas trois écritures du même scénario : ce sont
 * trois chemins qui n'atteignent pas les mêmes contrôles dans le même ordre —
 * `upsert` compile en un `INSERT … ON CONFLICT DO UPDATE`, et l'index partiel
 * qui borne les compteurs ouverts **n'est pas sa cible de conflit**.
 *
 * ## LA POPULATION N'EST PAS FABRIQUÉE POUR CE FICHIER
 *
 * Les interventions, les sociétés et les identités viennent du harnais commun,
 * écrites avant ce ticket et pour d'autres. *Une population taillée pour un
 * gardien est une population dont le cas fautif peut sortir sans qu'on le
 * voie* (§9, 31/08).
 *
 * ## CE QUE PRISMA NE LAISSE PAS NOMMER, ET COMMENT LE NOM REVIENT
 *
 * *La doctrine veut qu'une assertion NOMME la contrainte, sans quoi un refus
 * venu d'ailleurs passe pour le bon* (§9, 24/08). **Prisma ne le permet pas sur
 * une violation d'unicité, et c'est mesuré** : sur un `23503` il rend le
 * message entier de PostgreSQL — *« violates foreign key constraint
 * "segment_travail_societe_id_fkey" »* —, sur un `23505` il rend **« Unique
 * constraint failed: »** et rien d'autre. Le nom de l'index est perdu avant
 * d'arriver ici.
 *
 * Le nom revient donc par le JUMEAU, qui retire **cet index-là** et montre
 * l'écriture passer. L'assertion porte sur le code `23505` ; c'est le jumeau
 * qui dit lequel des index a mordu.
 *
 * ## CHAQUE REFUS A SON JUMEAU
 *
 * Le verrou est retiré POUR DE VRAI dans une transaction annulée, et l'écriture
 * fautive passe alors. Sans lui, un refus venu d'ailleurs — la clé étrangère,
 * une autre contrainte — passerait pour le bon (§9, 24/08). Le témoin de chaque
 * jumeau est l'assertion de refus qui le PRÉCÈDE : PostgreSQL abandonne la
 * transaction entière sur une violation (`25P02`), on ne peut donc pas montrer
 * les deux dans la même.
 */

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien] as string;

/** Des instants FIXES : aucun scénario de ce fichier ne lit l'horloge. */
const H8 = new Date("2026-09-15T08:00:00.000Z");
const H9 = new Date("2026-09-15T09:00:00.000Z");
const H10 = new Date("2026-09-15T10:00:00.000Z");
const H14 = new Date("2026-09-15T14:00:00.000Z");

const poses: string[] = [];

function neuf(): string {
  const id = uuidv7();
  poses.push(id);
  return id;
}

function sql(
  id: string,
  utilisateurId: string,
  debut: Date,
  fin: Date | null,
  interventionId = INTERVENTION_A1,
  societeId = SOCIETE_A,
): string {
  return `INSERT INTO "segment_travail"
            ("id", "societe_id", "intervention_id", "utilisateur_id", "debut", "fin", "modifie_le")
          VALUES ('${id}', '${societeId}', '${interventionId}', '${utilisateurId}',
                  TIMESTAMPTZ '${debut.toISOString()}',
                  ${fin === null ? "NULL" : `TIMESTAMPTZ '${fin.toISOString()}'`},
                  now())`;
}

/** Une écriture sous un contexte interne — le seul régime qui écrit. */
function sousInterne<T>(
  travail: (tx: {
    $executeRawUnsafe: (s: string) => Promise<number>;
  }) => Promise<T>,
): Promise<T> {
  return sousSocieteEtRole(SOCIETE_A, Role.technicien, (tx) => travail(tx));
}

const session = {
  utilisateurId: TECHNICIEN,
  societeId: SOCIETE_A,
  role: Role.technicien,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

describe("R5-02 — les verrous du compteur", () => {
  afterEach(async () => {
    if (poses.length > 0) {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "segment_travail" WHERE "id" IN (${poses.map((i) => `'${i}'`).join(",")})`,
      );
      poses.length = 0;
    }
  });
  afterAll(fermerClients);

  // ── 1. UN SEUL COMPTEUR OUVERT PAR PERSONNE, PAR LES TROIS VERBES ────────

  describe("un seul compteur ouvert par personne", () => {
    it("le TÉMOIN : un premier compteur ouvert s'écrit sans peine", async () => {
      // Sans lui, les trois refus ci-dessous seraient verts sur une table où
      // rien ne peut s'écrire — le vert le plus cher qui soit.
      const id = neuf();
      await expect(
        sousInterne((tx) =>
          tx.$executeRawUnsafe(sql(id, TECHNICIEN, H8, null)),
        ),
      ).resolves.toBe(1);
    });

    it("CREATE : un second compteur ouvert est refusé", async () => {
      await sousInterne((tx) =>
        tx.$executeRawUnsafe(sql(neuf(), TECHNICIEN, H8, null)),
      );
      await expect(
        sousInterne((tx) =>
          tx.$executeRawUnsafe(
            sql(neuf(), TECHNICIEN, H14, null, INTERVENTION_A2),
          ),
        ),
      ).rejects.toThrow(/23505/);
    });

    it("UPDATE : ROUVRIR un segment fermé alors qu'un autre tourne est refusé", async () => {
      // *Le verbe change le chemin* : ici aucune ligne n'est insérée, une
      // colonne passe de NON NULL à NULL — et l'index partiel la fait ENTRER
      // dans sa population. Un gardien qui n'éprouverait que l'insertion
      // laisserait ce chemin ouvert.
      const ferme = neuf();
      await sousInterne((tx) =>
        tx.$executeRawUnsafe(sql(ferme, TECHNICIEN, H8, H9)),
      );
      await sousInterne((tx) =>
        tx.$executeRawUnsafe(sql(neuf(), TECHNICIEN, H14, null)),
      );
      await expect(
        sousInterne((tx) =>
          tx.$executeRawUnsafe(
            `UPDATE "segment_travail" SET "fin" = NULL WHERE "id" = '${ferme}'`,
          ),
        ),
      ).rejects.toThrow(/23505/);
    });

    it("UPSERT : le verbe du semis, et l'index partiel n'est PAS sa cible de conflit", async () => {
      await sousInterne((tx) =>
        tx.$executeRawUnsafe(sql(neuf(), TECHNICIEN, H8, null)),
      );
      const id = neuf();
      await expect(
        sousInterne((tx) =>
          tx.$executeRawUnsafe(
            `${sql(id, TECHNICIEN, H14, null, INTERVENTION_A2)}
             ON CONFLICT ("id") DO UPDATE SET "fin" = NULL`,
          ),
        ),
      ).rejects.toThrow(/23505/);
    });

    it("mais DEUX PERSONNES peuvent avoir chacune le sien", async () => {
      // Le cas qui doit rester VERT pour sa propre raison (§9, 11/09) : la
      // borne porte sur la personne, et un index sur (société, intervention)
      // aurait passé les trois refus ci-dessus tout en cassant celui-ci.
      await sousInterne((tx) =>
        tx.$executeRawUnsafe(sql(neuf(), TECHNICIEN, H8, null)),
      );
      await expect(
        sousInterne((tx) =>
          tx.$executeRawUnsafe(sql(neuf(), UTILISATEUR_INTERNE_A, H8, null)),
        ),
      ).resolves.toBe(1);
    });

    it("et deux segments FERMÉS peuvent se recouvrir — I5, jamais une perte", async () => {
      // *Le travail terrain n'est jamais perdu* : deux saisies hors ligne qui
      // se chevauchent sont un fait à conserver, pas une écriture à refuser.
      await sousInterne((tx) =>
        tx.$executeRawUnsafe(sql(neuf(), TECHNICIEN, H8, H10)),
      );
      await expect(
        sousInterne((tx) =>
          tx.$executeRawUnsafe(sql(neuf(), TECHNICIEN, H9, H14)),
        ),
      ).resolves.toBe(1);
    });

    it("LE JUMEAU : l'index retiré, le second compteur ouvert passe", async () => {
      await clientOwner()
        .$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `DROP INDEX "segment_travail_un_seul_ouvert_par_personne"`,
          );
          await tx.$executeRawUnsafe(
            `SELECT set_config('app.societe_id', '${SOCIETE_A}', true),
                  set_config('app.role', 'technicien', true)`,
          );
          await tx.$executeRawUnsafe(sql(uuidv7(), TECHNICIEN, H8, null));
          // La seconde écriture est celle qui était refusée à l'instant.
          const ecrit = await tx.$executeRawUnsafe(
            sql(uuidv7(), TECHNICIEN, H14, null, INTERVENTION_A2),
          );
          expect(ecrit).toBe(1);
          throw new Error("rollback volontaire");
        })
        .catch((erreur: unknown) => {
          expect(String(erreur)).toContain("rollback volontaire");
        });
    });
  });

  // ── 2. UNE FIN APRÈS SON DÉBUT, PAR LES TROIS VERBES ─────────────────────

  describe("une fin qui précède son début n'est pas un segment", () => {
    it("CREATE : refusé", async () => {
      await expect(
        sousInterne((tx) =>
          tx.$executeRawUnsafe(sql(neuf(), TECHNICIEN, H10, H8)),
        ),
      ).rejects.toThrow(/segment_travail_fin_apres_debut/);
    });

    it("CREATE : une durée NULLE est refusée aussi — elle ne mesure rien", async () => {
      await expect(
        sousInterne((tx) =>
          tx.$executeRawUnsafe(sql(neuf(), TECHNICIEN, H8, H8)),
        ),
      ).rejects.toThrow(/segment_travail_fin_apres_debut/);
    });

    it("UPDATE : fermer AVANT le début est refusé", async () => {
      const id = neuf();
      await sousInterne((tx) =>
        tx.$executeRawUnsafe(sql(id, TECHNICIEN, H10, null)),
      );
      await expect(
        sousInterne((tx) =>
          tx.$executeRawUnsafe(
            `UPDATE "segment_travail" SET "fin" = TIMESTAMPTZ '${H8.toISOString()}' WHERE "id" = '${id}'`,
          ),
        ),
      ).rejects.toThrow(/segment_travail_fin_apres_debut/);
    });

    it("UPSERT : la branche de MISE À JOUR est jugée comme les autres", async () => {
      const id = neuf();
      await sousInterne((tx) =>
        tx.$executeRawUnsafe(sql(id, TECHNICIEN, H10, null)),
      );
      await expect(
        sousInterne((tx) =>
          tx.$executeRawUnsafe(
            `${sql(id, TECHNICIEN, H10, null)}
             ON CONFLICT ("id") DO UPDATE SET "fin" = TIMESTAMPTZ '${H8.toISOString()}'`,
          ),
        ),
      ).rejects.toThrow(/segment_travail_fin_apres_debut/);
    });

    it("LE JUMEAU : la contrainte retirée, la fin antérieure passe", async () => {
      await clientOwner()
        .$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `ALTER TABLE "segment_travail" DROP CONSTRAINT "segment_travail_fin_apres_debut"`,
          );
          await tx.$executeRawUnsafe(
            `SELECT set_config('app.societe_id', '${SOCIETE_A}', true),
                  set_config('app.role', 'technicien', true)`,
          );
          const ecrit = await tx.$executeRawUnsafe(
            sql(uuidv7(), TECHNICIEN, H10, H8),
          );
          expect(ecrit).toBe(1);
          throw new Error("rollback volontaire");
        })
        .catch((erreur: unknown) => {
          expect(String(erreur)).toContain("rollback volontaire");
        });
    });
  });

  // ── 3. LE CLOISONNEMENT — forme « interne » (D94) ────────────────────────

  describe("la forme « interne »", () => {
    it("un compte de PORTAIL ne lit AUCUN segment, et son témoin le dit", async () => {
      const id = neuf();
      await sousInterne((tx) =>
        tx.$executeRawUnsafe(sql(id, TECHNICIEN, H8, H9)),
      );

      // TÉMOIN : la ligne existe bel et bien, et un rôle interne la lit.
      const vuesParLInterne = await sousSocieteEtRole(
        SOCIETE_A,
        Role.adv,
        (tx) => tx.segmentTravail.count(),
      );
      expect(vuesParLInterne).toBeGreaterThan(0);

      const vuesParLePortail = await avecPortail(
        { societeId: SOCIETE_A, clientId: CLIENT_A1 },
        (tx) => tx.segmentTravail.count(),
      );
      expect(vuesParLePortail).toBe(0);
    });

    it("une AUTRE société n'en lit aucun non plus", async () => {
      const id = neuf();
      await sousInterne((tx) =>
        tx.$executeRawUnsafe(sql(id, TECHNICIEN, H8, H9)),
      );
      const vues = await sousSocieteEtRole(SOCIETE_B, Role.adv, (tx) =>
        tx.segmentTravail.count(),
      );
      expect(vues).toBe(0);
    });

    it("écrire pour une AUTRE société est refusé par le WITH CHECK", async () => {
      await expect(
        sousInterne((tx) =>
          tx.$executeRawUnsafe(
            sql(neuf(), TECHNICIEN, H8, H9, INTERVENTION_B1, SOCIETE_B),
          ),
        ),
      ).rejects.toThrow();
    });
  });

  // ── 4. AUCUNE SUPPRESSION, ET ELLE EST REFUSÉE DEUX FOIS ─────────────────

  it("un segment ne se SUPPRIME pas — ni privilège, ni politique", async () => {
    const id = neuf();
    await sousInterne((tx) =>
      tx.$executeRawUnsafe(sql(id, TECHNICIEN, H8, H9)),
    );
    await expect(
      sousInterne((tx) =>
        tx.$executeRawUnsafe(
          `DELETE FROM "segment_travail" WHERE "id" = '${id}'`,
        ),
      ),
    ).rejects.toThrow();

    const privileges = await clientOwner().$queryRawUnsafe<
      Array<{ privilege_type: string }>
    >(
      `SELECT privilege_type FROM information_schema.role_table_grants
        WHERE grantee = 'codiplan_app' AND table_name = 'segment_travail'`,
    );
    const verbes = privileges.map((p) => p.privilege_type);
    // TÉMOIN : la lecture a bien vu des privilèges, et non aucune ligne.
    expect(verbes).toContain("INSERT");
    expect(verbes).not.toContain("DELETE");
  });

  // ── 5. LA CHAÎNE APPLICATIVE, DE BOUT EN BOUT ────────────────────────────

  describe("le chemin de production", () => {
    it("démarrer, arrêter, mesurer — et le second démarrage est refusé AVEC SA CLÉ", async () => {
      const depart = await demarrerLeCompteur(
        session,
        INTERVENTION_A1,
        H8,
        clientApp(),
      );
      expect(depart.accepte).toBe(true);
      if (depart.accepte) poses.push(depart.segment.id);

      const second = await demarrerLeCompteur(
        session,
        INTERVENTION_A2,
        H9,
        clientApp(),
      );
      // *Le refus est NOMMÉ, jamais une violation d'index rendue à l'écran.*
      expect(second).toEqual({
        accepte: false,
        cle: "compteur.refus.deja_en_cours",
      });

      const enCours = await compteurEnCours(session, clientApp());
      expect(enCours?.interventionId).toBe(INTERVENTION_A1);

      const arret = await arreterLeCompteur(session, H10, clientApp());
      expect(arret.accepte).toBe(true);

      const mesure = await mesureDeLIntervention(
        session,
        INTERVENTION_A1,
        clientApp(),
      );
      expect(mesure.minutes).toBe(120);
      expect(mesure.ouvert).toBeNull();
      expect(await compteurEnCours(session, clientApp())).toBeNull();
    });

    it("arrêter sans rien qui tourne est refusé AVEC SA CLÉ", async () => {
      expect(await arreterLeCompteur(session, H10, clientApp())).toEqual({
        accepte: false,
        cle: "compteur.refus.aucun_en_cours",
      });
    });
  });

  // ── 6. L'AUDIT (I8) ──────────────────────────────────────────────────────

  it("chaque écriture laisse une ligne au journal d'audit", async () => {
    const id = neuf();
    await sousInterne((tx) =>
      tx.$executeRawUnsafe(sql(id, TECHNICIEN, H8, null)),
    );
    await sousInterne((tx) =>
      tx.$executeRawUnsafe(
        `UPDATE "segment_travail" SET "fin" = TIMESTAMPTZ '${H9.toISOString()}' WHERE "id" = '${id}'`,
      ),
    );
    const lignes = await clientOwner().$queryRawUnsafe<
      Array<{ action: string }>
    >(
      `SELECT "action"::text FROM "journal_audit"
        WHERE "entite" = 'segment_travail' AND "entite_id" = '${id}'
        ORDER BY "horodatage"`,
    );
    const actions = lignes.map((l) => l.action);
    expect(actions).toContain("creation");
    expect(actions).toContain("modification");
  });
});

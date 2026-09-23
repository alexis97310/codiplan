import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";

import { clientOwner, fermerClients, sousSocieteEtRole } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * R3-14 — CE QUE LA BASE GARDE D'UN BLOCAGE D'AGENDA, ET QU'UN ÉCRAN NE PEUT
 * PAS GARDER À SA PLACE.
 *
 * **CODIPLAN n'est pas un outil de gestion des ressources humaines.** La
 * décision du 14/09/2026 a retiré à `absence` tout ce qui n'était pas une
 * période — nature, motif, champ libre, statut —, et deux verrous survivent à
 * ce dégraissage parce qu'aucun des deux ne lisait ce qui a disparu :
 *
 *   1. **un technicien bloque SON agenda**, jamais celui d'un autre ;
 *   2. **on ne pose pas une intervention sur un agenda bloqué** — l'autre bout
 *      de RG-PLA-06, que le ticket avait mesuré tenu *en TypeScript seulement*.
 *
 * Les deux verrous que la décision emporte sont nommés ici plutôt que
 * silencieusement absents : `absence_sans_nature` n'a plus rien à refuser, la
 * colonne ayant disparu ; `absence_decision_reservee_a_l_encadrement` n'a plus
 * de statut à surveiller. *Une garantie retirée se lit mieux qu'elle ne se
 * devine.*
 *
 * ## Sous quel rôle, et pourquoi cela décide de ce qui est mesuré
 *
 * Le premier verrou lit `app.role` et `app.utilisateur_id` ; le second lit
 * `absence` sous les politiques de l'appelant. **Tout se joue donc sous un
 * contexte posé**, qui est le seul état dans lequel l'application écrit. Sous
 * le propriétaire nu, `app.role` est vide — le défaut est le REFUS pour le
 * premier, et l'ABSTENTION pour le second, qui ne voit rien.
 *
 * ## Le témoin de chaque jumeau vit HORS de sa transaction
 *
 * *Un jumeau devrait montrer le refus avant de retirer le verrou.* PostgreSQL
 * l'interdit dans la même transaction : une violation abandonne la transaction
 * entière (`25P02`, mesuré le 14/09/2026). Le témoin est donc l'assertion de
 * refus qui PRÉCÈDE chaque jumeau, sur la même ligne et par le même chemin.
 */

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien] as string;

/** Une journée civile fixe — aucun de ces scénarios ne lit l'horloge. */
const DU = "2026-11-02";
const AU = "2026-11-06";
/** Un jour DANS la période bloquée, et un jour hors d'elle. */
const BLOQUE = new Date("2026-11-03T00:00:00.000Z");
const LIBRE = new Date("2026-11-16T00:00:00.000Z");

const posees: string[] = [];
const interventions: string[] = [];

function insertion(utilisateurId: string): { sql: string; id: string } {
  const id = uuidv7();
  posees.push(id);
  return {
    id,
    sql: `INSERT INTO "absence" ("id", "societe_id", "utilisateur_id", "du", "au", "modifie_le")
          VALUES ('${id}', '${SOCIETE_A}', '${utilisateurId}', DATE '${DU}', DATE '${AU}', now())`,
  };
}

/** Pose un blocage sur le technicien, par le chemin applicatif. */
async function bloquerLAgenda(): Promise<string> {
  const { sql, id } = insertion(TECHNICIEN);
  await sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) =>
    tx.$executeRawUnsafe(sql),
  );
  return id;
}

/** Le propriétaire, AVEC un contexte posé — sans quoi il ne voit ni ne sait. */
function sousProprietaire<T>(
  role: string,
  utilisateurId: string,
  travail: (tx: {
    $executeRawUnsafe: (sql: string) => Promise<number>;
  }) => Promise<T>,
): Promise<T> {
  return clientOwner().$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.societe_id', '${SOCIETE_A}', true),
              set_config('app.role', '${role}', true),
              set_config('app.utilisateur_id', '${utilisateurId}', true)`,
    );
    return travail(tx);
  });
}

describe("R3-14 — les verrous du blocage d'agenda", () => {
  afterEach(async () => {
    if (posees.length > 0) {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "absence" WHERE "id" IN (${posees.map((id) => `'${id}'`).join(",")})`,
      );
      posees.length = 0;
    }
    if (interventions.length > 0) {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "intervention" WHERE "id" IN (${interventions.map((id) => `'${id}'`).join(",")})`,
      );
      interventions.length = 0;
    }
  });

  afterAll(fermerClients);

  // ── 0. CE QUE LA DÉCISION A RETIRÉ, MESURÉ PLUTÔT QUE SUPPOSÉ ─────────────

  describe("ce que la décision du 14/09 a retiré de la base", () => {
    it("ni `motif`, ni `precision`, ni `statut` — la table ne porte qu'une période", async () => {
      // *La preuve par la BASE, jamais par le schéma Prisma* : c'est l'état
      // final qui compte, pas le texte qui l'installe (§9, 26/08, forme 3).
      const colonnes = await clientOwner().$queryRawUnsafe<
        Array<{ column_name: string }>
      >(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'absence'
          ORDER BY column_name`,
      );
      const noms = colonnes.map((c) => c.column_name);
      // TÉMOIN : la lecture a bien vu une table, et non zéro colonne.
      expect(noms).toContain("du");
      expect(noms).toContain("au");
      expect(noms).not.toContain("motif");
      expect(noms).not.toContain("precision");
      expect(noms).not.toContain("statut");
    });

    it("les deux types énumérés ont disparu avec leurs colonnes", async () => {
      const types = await clientOwner().$queryRawUnsafe<
        Array<{ typname: string }>
      >(
        `SELECT typname FROM pg_type
          WHERE typname IN ('MotifAbsence', 'StatutAbsence', 'StatutIntervention')`,
      );
      const noms = types.map((t) => t.typname);
      // TÉMOIN : la requête sait trouver un type qui existe. *Une liste vide
      // ressemble toujours à un sans-faute* (§9, 30/08).
      expect(noms).toContain("StatutIntervention");
      expect(noms).not.toContain("MotifAbsence");
      expect(noms).not.toContain("StatutAbsence");
    });
  });

  // ── 1. UN TECHNICIEN BLOQUE SON PROPRE AGENDA ────────────────────────────

  describe("un technicien bloque SON agenda, jamais celui d'un autre", () => {
    it("il bloque le sien — le cas qui doit rester vert", async () => {
      // *Le cas qui doit rester vert POUR SA PROPRE RAISON* (§9, 11/09) : sans
      // lui, un verrou qui refuserait TOUTE écriture sous le rôle `technicien`
      // passerait le refus ci-dessous sans qu'on s'en aperçoive.
      const { sql } = insertion(TECHNICIEN);
      await expect(
        sousProprietaire(Role.technicien, TECHNICIEN, (tx) =>
          tx.$executeRawUnsafe(sql),
        ),
      ).resolves.toBe(1);
    });

    it("il ne bloque PAS celui d'un autre, et le verrou est NOMMÉ", async () => {
      const { sql } = insertion(UTILISATEUR_INTERNE_A);
      await expect(
        sousProprietaire(Role.technicien, TECHNICIEN, (tx) =>
          tx.$executeRawUnsafe(sql),
        ),
      ).rejects.toThrow(/absence_declaree_pour_soi/);
    });

    it("l'ADV bloque l'agenda d'un tiers — le verrou ne vise que le technicien", async () => {
      // C'est l'ADV qui enregistre l'appel du matin. *Un verrou qui viserait
      // tout le monde interdirait le cas ordinaire.*
      const { sql } = insertion(TECHNICIEN);
      await expect(
        sousProprietaire(Role.adv, UTILISATEUR_INTERNE_A, (tx) =>
          tx.$executeRawUnsafe(sql),
        ),
      ).resolves.toBe(1);
    });

    it("JUMEAU — le déclencheur retiré, le technicien bloque l'agenda d'autrui", async () => {
      const premier = insertion(UTILISATEUR_INTERNE_A);
      await expect(
        sousProprietaire(Role.technicien, TECHNICIEN, (tx) =>
          tx.$executeRawUnsafe(premier.sql),
        ),
      ).rejects.toThrow(/absence_declaree_pour_soi/);

      const second = insertion(UTILISATEUR_INTERNE_A);
      await expect(
        sousProprietaire(Role.technicien, TECHNICIEN, async (tx) => {
          await tx.$executeRawUnsafe(
            `DROP TRIGGER "declaree_pour_soi" ON "absence"`,
          );
          const pose = await tx.$executeRawUnsafe(second.sql);
          expect(pose).toBe(1);
          throw new Annulation("rollback voulu");
        }),
      ).rejects.toThrow("rollback voulu");
    });
  });

  // ── 2. LE VERROU DE CHEVAUCHEMENT TRAITE LE BLOCAGE COMME UNE OCCUPATION ──
  //
  // **ÉPROUVÉ SUR LES TROIS VERBES DE PRISMA, ET C'EST LE SUJET DU §9 DU
  // 14/09.** Un gardien de base se lit sur deux axes, et le second s'oublie :
  // *quelles lignes regarde-t-il, et PAR QUEL VERBE les écrit-on ?*
  // `create`, `update` et `upsert` ne compilent pas vers le même SQL, et
  // `upsert` est le seul à produire un `INSERT … ON CONFLICT DO UPDATE` dont la
  // ligne candidate porte un identifiant NEUF. C'est lui qui a fait tomber le
  // semis le 14/09 sur `plage_sans_chevauchement` ; c'est lui qu'on écrit ici
  // plutôt que de supposer que les trois se valent.

  describe("on ne pose pas sur un agenda bloqué — les TROIS verbes", () => {
    function squelette(id: string) {
      interventions.push(id);
      return {
        id,
        societe_id: SOCIETE_A,
        client_id: CLIENT_A1,
        site_id: SITE_A1_S1,
        agence_id: AGENCE_A,
        type: "curatif" as const,
        statut: "planifiee" as const,
        // `duree_estimee_min` EST POSÉE (PARCOURS-1, 23/09/2026) —
        // `intervention_planifiee_a_sa_duree` l'exige désormais pour
        // `planifiee`, fixtures comprises.
        duree_estimee_min: 60,
        technicien_id: TECHNICIEN,
      };
    }

    it("CREATE — une intervention posée sur un jour bloqué est refusée", async () => {
      await bloquerLAgenda();
      await expect(
        sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) =>
          tx.intervention.create({
            data: { ...squelette(uuidv7()), date_planifiee: BLOQUE },
          }),
        ),
      ).rejects.toThrow(/intervention_pas_sur_blocage_agenda/);
    });

    it("CREATE hors de la période — le cas qui doit rester vert", async () => {
      // *Un verrou qui refuserait TOUTE pose passerait le scénario ci-dessus
      // sans qu'on s'en aperçoive, et le planning entier serait bloqué.*
      await bloquerLAgenda();
      const posee = await sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) =>
        tx.intervention.create({
          data: { ...squelette(uuidv7()), date_planifiee: LIBRE },
        }),
      );
      expect(posee.date_planifiee).not.toBeNull();
    });

    it("UPDATE — déplacer une intervention SUR un jour bloqué est refusé", async () => {
      await bloquerLAgenda();
      const id = uuidv7();
      await sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) =>
        tx.intervention.create({
          data: { ...squelette(id), date_planifiee: LIBRE },
        }),
      );
      await expect(
        sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) =>
          tx.intervention.update({
            where: { id },
            data: { date_planifiee: BLOQUE },
          }),
        ),
      ).rejects.toThrow(/intervention_pas_sur_blocage_agenda/);
    });

    it("UPDATE qui DÉPLANIFIE — la date part, et le verrou laisse passer", async () => {
      // *C'est elle qui répare l'état, pas elle qui le crée.* Un verrou qui
      // refuserait la déplanification rendrait impossible le geste même que le
      // blocage exige.
      await bloquerLAgenda();
      const id = uuidv7();
      await sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) =>
        tx.intervention.create({
          data: { ...squelette(id), date_planifiee: LIBRE },
        }),
      );
      const rendue = await sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) =>
        tx.intervention.update({
          where: { id },
          data: { date_planifiee: null, statut: "a_planifier" },
        }),
      );
      expect(rendue.date_planifiee).toBeNull();
    });

    it("UPSERT sans conflit — la branche CREATE est gardée", async () => {
      await bloquerLAgenda();
      const id = uuidv7();
      await expect(
        sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) =>
          tx.intervention.upsert({
            where: { id },
            create: { ...squelette(id), date_planifiee: BLOQUE },
            update: { date_planifiee: BLOQUE },
          }),
        ),
      ).rejects.toThrow(/intervention_pas_sur_blocage_agenda/);
    });

    it("UPSERT avec conflit — c'est la branche UPDATE qui est jugée, et elle l'est", async () => {
      // **LE SCÉNARIO QUE `BEFORE` AURAIT MANQUÉ OU FAUSSÉ.** La ligne existe,
      // le bloc `create` ne sera pas exécuté — et pourtant PostgreSQL lève les
      // déclencheurs `BEFORE INSERT` sur la candidate, qui porte les valeurs du
      // bloc `create`. En `AFTER`, seuls les événements de la MISE À JOUR sont
      // levés, sur la ligne RÉELLE : c'est bien la date du bloc `update` qui
      // est jugée.
      await bloquerLAgenda();
      const id = uuidv7();
      await sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) =>
        tx.intervention.create({
          data: { ...squelette(id), date_planifiee: LIBRE },
        }),
      );
      await expect(
        sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) =>
          tx.intervention.upsert({
            where: { id },
            create: { ...squelette(id), date_planifiee: LIBRE },
            update: { date_planifiee: BLOQUE },
          }),
        ),
      ).rejects.toThrow(/intervention_pas_sur_blocage_agenda/);
    });

    it("UPSERT avec conflit vers un jour LIBRE — le vert pour sa propre raison", async () => {
      // **LE CAS QUI DÉPARTAGE `AFTER` DE `BEFORE`.** Le bloc `create` porte une
      // date BLOQUÉE ; la branche réellement exécutée est celle du bloc
      // `update`, qui porte une date libre. Un `BEFORE INSERT` jugerait la
      // candidate et REFUSERAIT une écriture qui n'a pas lieu. *Un refus sur
      // une écriture qui n'existe pas est aussi faux qu'une acceptation sur une
      // écriture interdite.*
      await bloquerLAgenda();
      const id = uuidv7();
      await sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) =>
        tx.intervention.create({
          data: { ...squelette(id), date_planifiee: LIBRE },
        }),
      );
      const apres = await sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) =>
        tx.intervention.upsert({
          where: { id },
          create: { ...squelette(id), date_planifiee: BLOQUE },
          update: { duree_estimee_min: 90 },
        }),
      );
      expect(apres.duree_estimee_min).toBe(90);
    });

    it("JUMEAU — le déclencheur retiré, la pose sur le jour bloqué PASSE", async () => {
      await bloquerLAgenda();
      const id = uuidv7();
      await expect(
        sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) =>
          tx.intervention.create({
            data: { ...squelette(id), date_planifiee: BLOQUE },
          }),
        ),
      ).rejects.toThrow(/intervention_pas_sur_blocage_agenda/);

      const autre = uuidv7();
      await expect(
        clientOwner().$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `SELECT set_config('app.societe_id', '${SOCIETE_A}', true)`,
          );
          await tx.$executeRawUnsafe(
            `DROP TRIGGER "pas_sur_blocage_agenda" ON "intervention"`,
          );
          const pose = await tx.intervention.create({
            data: { ...squelette(autre), date_planifiee: BLOQUE },
          });
          expect(pose.date_planifiee).not.toBeNull();
          throw new Annulation("rollback voulu");
        }),
      ).rejects.toThrow("rollback voulu");
    });
  });
});

/** Sentinelle d'annulation : elle fait retomber la transaction, sans erreur. */
class Annulation extends Error {}

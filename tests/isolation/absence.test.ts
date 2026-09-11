import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { deciderAbsence, declarerAbsence } from "@/lib/absences/depot";
import { schemaCreationAbsence } from "@/lib/absences/saisie";
import { uuidv7 } from "@/lib/db/uuid";
import { deplacerIntervention } from "@/lib/interventions/depot";
import { schemaDeplacement } from "@/lib/interventions/saisie";

import { avecPortail, clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * L'ABSENCE — RG-PLA-06, et la forme « interne » décidée à la naissance
 * (L3-04, D94).
 *
 * ## Ce que ce fichier mesure, et que rien d'autre ne mesurerait
 *
 * **La forme « interne », sur une table qui vient de naître.** D94 l'a créée
 * pour `document_recu` — *une table de forme « société » est lisible par un
 * compte de portail, sa clause ne lisant pas `app.client_id`* — et il a écrit
 * ce qu'il laissait ouvert : la question des tables DÉJÀ existantes. Celle-ci
 * n'existait pas, et la trancher à sa création est le seul moment où elle ne
 * coûte rien.
 *
 * > *« Votre technicien habituel est en arrêt du 14 au 28 » est une donnée de
 * > santé par déduction, et ce n'est pas au client de la lire.*
 *
 * **Le quatrième contrôle à la pose.** Une absence validée bloque le créneau,
 * et elle le bloque **au DÉPLACEMENT comme à la pose** — c'est la leçon de
 * L3-02, apprise la veille : *une règle tenue par un chemin sur deux n'est pas
 * tenue.*
 *
 * **Et la déplanification, dans la MÊME transaction que la validation.** Une
 * absence validée dont les interventions seraient restées posées ferait
 * affirmer au planning qu'un absent travaille.
 */

afterAll(fermerClients);

const SESSION = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien];

/** Un lundi de la plage 08:00–12:00 du calendrier de l'agence A. */
const LUNDI = new Date("2026-09-14T00:00:00.000Z");
const LUNDI_SUIVANT = new Date("2026-09-21T00:00:00.000Z");

let interventionId = "";
const absencesPosees: string[] = [];

async function declarer(
  du: string,
  au: string,
  motif = "conge",
): Promise<string> {
  const saisie = schemaCreationAbsence.parse({
    utilisateur_id: TECHNICIEN,
    du: new Date(`${du}T00:00:00.000Z`),
    au: new Date(`${au}T00:00:00.000Z`),
    motif,
    precision: motif === "autre" ? "détaché chez le constructeur" : null,
  });
  const resultat = await declarerAbsence(SESSION, saisie, clientApp());
  if (!resultat.accepte) {
    throw new Error(`déclaration refusée : ${resultat.cle}`);
  }
  absencesPosees.push(resultat.fiche.id);
  return resultat.fiche.id;
}

function deplacement(jour: Date) {
  return schemaDeplacement.parse({
    intervention_id: interventionId,
    date_planifiee: jour,
    debut_minutes: 9 * 60,
    duree_min: 60,
    technicien_id: TECHNICIEN,
  });
}

beforeEach(async () => {
  interventionId = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "type", "statut", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
             'planifiee', now())`,
    interventionId,
    SOCIETE_A,
    CLIENT_A1,
    SITE_A1_S1,
    AGENCE_A,
  );
});

afterEach(async () => {
  for (const id of absencesPosees.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "absence" WHERE "id" = $1::uuid`,
      id,
    );
  }
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
    interventionId,
  );
});

describe("l'absence, sous le rôle applicatif", () => {
  describe("le cloisonnement — forme « interne » (D94)", () => {
    it("TÉMOIN — la politique mord : sans contexte, zéro absence", async () => {
      // *Sans lui, tout ce qui suit serait vert sur une base où la RLS ne
      // s'applique pas* (§9, 07/09). Il porte sur le MÉCANISME : la ligne
      // existe, et l'assertion suivante la rend sous un contexte interne.
      await declarer("2026-09-14", "2026-09-18");
      const vues = await clientApp().$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM "absence"`,
      );
      expect(vues).toHaveLength(0);
    });

    it("un rôle INTERNE lit les absences de sa société", async () => {
      const id = await declarer("2026-09-14", "2026-09-18");
      const vues = await clientApp().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.societe_id',$1,true), set_config('app.role',$2,true)",
          SOCIETE_A,
          Role.adv,
        );
        return tx.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT "id" FROM "absence"`,
        );
      });
      expect(vues.map((v) => v.id)).toContain(id);
    });

    it("UN COMPTE PORTAIL N'EN LIT AUCUNE — et c'est tout le ticket", async () => {
      // **Le discriminant est `app.client_id`**, posé pour un compte de portail
      // et pour lui seul (D70). Sous la forme « société », ce compte aurait lu
      // la ligne : sa clause ne regarde pas le client, et *« votre technicien
      // habituel est en arrêt du 14 au 28 » se déduit d'une simple liste.*
      await declarer("2026-09-14", "2026-09-18");
      const vues = await avecPortail(
        {
          societeId: SOCIETE_A,
          clientId: CLIENT_A1,
          perimetreSites: [SITE_A1_S1],
        },
        (tx) =>
          tx.$queryRawUnsafe<Array<{ id: string }>>(
            `SELECT "id" FROM "absence"`,
          ),
      );
      expect(vues).toHaveLength(0);
    });

    it("JUMEAU — rendez-lui la clause de société seule, et le compte portail la lit", async () => {
      // *Le RETRAIT est ici le geste dangereux* : la forme « société » passe
      // tous les gardiens et ne casse rien de visible. Le jumeau le montre en
      // acte, dans une transaction annulée — le DDL est transactionnel en
      // PostgreSQL, la politique revient au `ROLLBACK`.
      const id = await declarer("2026-09-14", "2026-09-18");
      let vuesSansDiscriminant: Array<{ id: string }> = [];
      await clientOwner()
        .$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `DROP POLICY "cloisonnement_interne" ON "absence"`,
          );
          await tx.$executeRawUnsafe(
            `CREATE POLICY "cloisonnement_societe" ON "absence"
               USING ("societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid)
               WITH CHECK ("societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid)`,
          );
          await tx.$executeRawUnsafe(
            "SELECT set_config('app.societe_id',$1,true), set_config('app.role',$2,true)," +
              " set_config('app.client_id',$3,true), set_config('app.perimetre_sites',$4,true)",
            SOCIETE_A,
            Role.client,
            CLIENT_A1,
            SITE_A1_S1,
          );
          vuesSansDiscriminant = await tx.$queryRawUnsafe<
            Array<{ id: string }>
          >(`SELECT "id" FROM "absence"`);
          throw new Annulation();
        })
        .catch((erreur: unknown) => {
          if (!(erreur instanceof Annulation)) throw erreur;
        });
      // La lecture s'est faite sous le PROPRIÉTAIRE, qui subit `FORCE` : c'est
      // bien la politique qui a rendu la ligne, et elle l'a rendue parce que la
      // clause de société ne lit pas `app.client_id`.
      expect(vuesSansDiscriminant.map((v) => v.id)).toContain(id);
    });
  });

  describe("RG-PLA-06 — une absence VALIDÉE bloque le créneau", () => {
    it("TÉMOIN — sans absence, le déplacement passe", async () => {
      // *Sans lui, un refus venu d'ailleurs — jour fermé, habilitation,
      // chevauchement — passerait pour un refus d'absence.*
      const resultat = await deplacerIntervention(
        SESSION,
        deplacement(LUNDI),
        clientApp(),
      );
      expect(resultat.accepte).toBe(true);
    });

    it("une absence DEMANDÉE ne bloque RIEN — le vert pour sa propre raison", async () => {
      // §9 du 11/09. Le voisin qui lui ressemble est le refus ci-dessous : même
      // personne, même période, **un seul mot de différence**. *Un booléen
      // `validee` n'aurait pas su distinguer « pas encore tranchée » de
      // « refusée », et le planning aurait bloqué sur une demande qu'on venait
      // de refuser.*
      await declarer("2026-09-14", "2026-09-18");
      const resultat = await deplacerIntervention(
        SESSION,
        deplacement(LUNDI),
        clientApp(),
      );
      expect(resultat.accepte).toBe(true);
    });

    it("une absence VALIDÉE refuse le déplacement, et le motif est NOMMÉ", async () => {
      const id = await declarer("2026-09-14", "2026-09-18");
      await deciderAbsence(
        SESSION,
        { absence_id: id, decision: "validee" },
        clientApp(),
      );
      const resultat = await deplacerIntervention(
        SESSION,
        deplacement(LUNDI),
        clientApp(),
      );
      expect(resultat).toEqual({
        accepte: false,
        cle: "intervention.refus.absence",
      });
    });

    it("LES BORNES SONT COMPRISES — le dernier jour est absent, le lendemain non", async () => {
      // *Une borne ouverte aurait fait travailler quelqu'un le dernier jour de
      // son arrêt* — la faute qu'on ne voit qu'en production, sur une seule
      // journée, et qu'on met un mois à croire. Le scénario la mesure des deux
      // côtés de la borne.
      const id = await declarer("2026-09-14", "2026-09-14");
      await deciderAbsence(
        SESSION,
        { absence_id: id, decision: "validee" },
        clientApp(),
      );
      const leJourMeme = await deplacerIntervention(
        SESSION,
        deplacement(LUNDI),
        clientApp(),
      );
      expect(leJourMeme.accepte).toBe(false);

      const laSemaineSuivante = await deplacerIntervention(
        SESSION,
        deplacement(LUNDI_SUIVANT),
        clientApp(),
      );
      expect(laSemaineSuivante.accepte).toBe(true);
    });
  });

  describe("RG-PLA-06 — la validation rend les interventions à la file", () => {
    it("elle déplanifie ce qui était posé dans la période, et le NOMME", async () => {
      // La date et le créneau partent ; **le technicien reste**. *Une
      // intervention qui perd son affectation perd l'information qui permet de
      // la reposer au même endroit.*
      const pose = await deplacerIntervention(
        SESSION,
        deplacement(LUNDI),
        clientApp(),
      );
      expect(pose.accepte).toBe(true);

      const id = await declarer("2026-09-14", "2026-09-18");
      const decidee = await deciderAbsence(
        SESSION,
        { absence_id: id, decision: "validee" },
        clientApp(),
      );
      expect(decidee.accepte).toBe(true);
      expect(decidee.accepte && decidee.fiche.deplanifiees).toEqual([
        interventionId,
      ]);

      const [ligne] = await clientOwner().$queryRawUnsafe<
        Array<{
          date_planifiee: Date | null;
          creneau_debut: Date | null;
          technicien_id: string | null;
          statut: string;
        }>
      >(
        `SELECT "date_planifiee", "creneau_debut", "technicien_id", "statut"
         FROM "intervention" WHERE "id" = $1::uuid`,
        interventionId,
      );
      expect(ligne.date_planifiee).toBeNull();
      expect(ligne.creneau_debut).toBeNull();
      expect(ligne.statut).toBe("a_planifier");
      // **Ce qui reste**, et c'est la moitié qu'on oublie d'éprouver.
      expect(ligne.technicien_id).toBe(TECHNICIEN);
    });

    it("un REFUS ne déplanifie rien", async () => {
      const pose = await deplacerIntervention(
        SESSION,
        deplacement(LUNDI),
        clientApp(),
      );
      expect(pose.accepte).toBe(true);

      const id = await declarer("2026-09-14", "2026-09-18");
      const decidee = await deciderAbsence(
        SESSION,
        { absence_id: id, decision: "refusee" },
        clientApp(),
      );
      expect(decidee.accepte && decidee.fiche.deplanifiees).toEqual([]);

      const [ligne] = await clientOwner().$queryRawUnsafe<
        Array<{ date_planifiee: Date | null }>
      >(
        `SELECT "date_planifiee" FROM "intervention" WHERE "id" = $1::uuid`,
        interventionId,
      );
      expect(ligne.date_planifiee).not.toBeNull();
    });

    it("UNE DÉCISION NE SE REPREND PAS", async () => {
      // *Refuser après coup ne rendrait pas leurs créneaux aux interventions
      // déjà rendues à la file*, et revalider redéplanifierait ce qui l'a été.
      const id = await declarer("2026-09-14", "2026-09-18");
      await deciderAbsence(
        SESSION,
        { absence_id: id, decision: "validee" },
        clientApp(),
      );
      const seconde = await deciderAbsence(
        SESSION,
        { absence_id: id, decision: "refusee" },
        clientApp(),
      );
      expect(seconde).toEqual({
        accepte: false,
        cle: "absence.refus.deja_tranchee",
      });
    });
  });
});

/** Sentinelle d'annulation : elle fait retomber la transaction, sans erreur. */
class Annulation extends Error {}

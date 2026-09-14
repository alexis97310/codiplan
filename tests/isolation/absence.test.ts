import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { declarerAbsence, leverLeBlocage } from "@/lib/absences/depot";
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
 * LE BLOCAGE D'AGENDA — RG-PLA-06, et la forme « interne » décidée à la
 * naissance (L3-04, R3-14, D94).
 *
 * ## Ce que ce fichier mesure, et que rien d'autre ne mesurerait
 *
 * **La forme « interne », sur une table qui vient de naître.** D94 l'a créée
 * pour `document_recu` — *une table de forme « société » est lisible par un
 * compte de portail, sa clause ne lisant pas `app.client_id`* — et il a écrit
 * ce qu'il laissait ouvert : la question des tables DÉJÀ existantes. Celle-ci
 * n'existait pas, et la trancher à sa création est le seul moment où elle ne
 * coûte rien. *Elle le reste après le dégraissage du 14/09 : savoir que telle
 * personne n'est pas là du 2 au 6 reste une information sur une personne
 * nommée, même dépouillée de sa cause.*
 *
 * **Le quatrième contrôle à la pose.** Un agenda bloqué refuse le créneau, et
 * il le refuse **au DÉPLACEMENT comme à la pose** — c'est la leçon de L3-02,
 * apprise la veille : *une règle tenue par un chemin sur deux n'est pas tenue.*
 *
 * **Et la déplanification, dans la MÊME transaction que la POSE.** Tant qu'un
 * statut existait, c'était la validation qui déplanifiait ; R3-14 a retiré le
 * circuit d'approbation — *CODIPLAN n'est pas un outil de gestion des
 * ressources humaines* —, et **le blocage est immédiat**. Un blocage dont les
 * interventions seraient restées posées ferait affirmer au planning qu'une
 * personne indisponible travaille.
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

type Pose = Awaited<ReturnType<typeof declarerAbsence>>;

/**
 * POSER un blocage par le chemin applicatif, et rendre CE QU'IL A PRODUIT.
 *
 * *Le blocage est immédiat* : cette seule fonction porte désormais la
 * déplanification et l'alerte, là où il fallait deux gestes avant R3-14. Les
 * scénarios lisent donc son retour plutôt que celui d'une décision ultérieure.
 *
 * AUCUNE NATURE, AUCUN ÉTAT : le schéma ne les accepte plus, et les colonnes
 * n'existent plus. Les lignes qui en portaient ici ont été retirées plutôt que
 * laissées — Zod écarte en silence une clé inconnue, si bien qu'un `motif`
 * resté dans cet appel aurait eu l'air d'être écrit sans l'être.
 */
async function bloquer(du: string, au: string): Promise<Pose> {
  const saisie = schemaCreationAbsence.parse({
    utilisateur_id: TECHNICIEN,
    du: new Date(`${du}T00:00:00.000Z`),
    au: new Date(`${au}T00:00:00.000Z`),
  });
  const resultat = await declarerAbsence(SESSION, saisie, clientApp());
  if (resultat.accepte) {
    absencesPosees.push(resultat.fiche.absence.id);
  }
  return resultat;
}

/** Poser un blocage et rendre son identifiant — quand le reste est indifférent. */
async function declarer(du: string, au: string): Promise<string> {
  const resultat = await bloquer(du, au);
  if (!resultat.accepte) {
    throw new Error(`blocage refusé : ${resultat.cle}`);
  }
  return resultat.fiche.absence.id;
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

  describe("RG-PLA-06 — un agenda bloqué refuse le créneau", () => {
    it("TÉMOIN — sans blocage, le déplacement passe", async () => {
      // *Sans lui, un refus venu d'ailleurs — jour fermé, habilitation,
      // chevauchement — passerait pour un refus de blocage.*
      const resultat = await deplacerIntervention(
        SESSION,
        deplacement(LUNDI),
        clientApp(),
      );
      expect(resultat.accepte).toBe(true);
    });

    it("un blocage refuse le déplacement DÈS SA POSE, et le motif est NOMMÉ", async () => {
      // **Il n'y a plus de moitié qui ne bloque pas encore.** Avant R3-14, ce
      // scénario demandait une seconde écriture — la validation ; le statut
      // ayant disparu avec le circuit d'approbation, la pose suffit.
      await declarer("2026-09-14", "2026-09-18");
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

    it("LES BORNES SONT COMPRISES — le dernier jour est bloqué, le lendemain non", async () => {
      // *Une borne ouverte aurait fait travailler quelqu'un le dernier jour de
      // son indisponibilité* — la faute qu'on ne voit qu'en production, sur une
      // seule journée, et qu'on met un mois à croire. Le scénario la mesure des
      // deux côtés de la borne, et la seconde moitié est aussi **le cas qui
      // doit rester vert POUR SA PROPRE RAISON** (§9, 11/09) : un verrou qui
      // refuserait tout passerait la première sans qu'on s'en aperçoive.
      await declarer("2026-09-14", "2026-09-14");
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

  describe("RG-PLA-06 — la POSE rend les interventions à la file", () => {
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

      const blocage = await bloquer("2026-09-14", "2026-09-18");
      expect(blocage.accepte).toBe(true);
      expect(blocage.accepte && blocage.fiche.deplanifiees).toEqual([
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

    it("un blocage HORS de la période ne déplanifie rien", async () => {
      // *Le cas qui doit rester vert POUR SA PROPRE RAISON* (§9, 11/09) : une
      // déplanification qui emporterait tout passerait le scénario ci-dessus
      // sans qu'on s'en aperçoive.
      const pose = await deplacerIntervention(
        SESSION,
        deplacement(LUNDI),
        clientApp(),
      );
      expect(pose.accepte).toBe(true);

      const blocage = await bloquer("2026-10-05", "2026-10-09");
      expect(blocage.accepte && blocage.fiche.deplanifiees).toEqual([]);

      const [ligne] = await clientOwner().$queryRawUnsafe<
        Array<{ date_planifiee: Date | null }>
      >(
        `SELECT "date_planifiee" FROM "intervention" WHERE "id" = $1::uuid`,
        interventionId,
      );
      expect(ligne.date_planifiee).not.toBeNull();
    });

    it("LEVER LE BLOCAGE NE REND PAS LES CRÉNEAUX, et c'est écrit", async () => {
      // *Ressusciter un créneau depuis le journal d'audit serait une seconde
      // source d'un fait que la table ne porte plus.* Ce scénario mesure ce que
      // la levée ne fait PAS — la moitié qu'un écran laisserait croire.
      await deplacerIntervention(SESSION, deplacement(LUNDI), clientApp());
      const blocage = await bloquer("2026-09-14", "2026-09-18");
      expect(blocage.accepte && blocage.fiche.deplanifiees).toEqual([
        interventionId,
      ]);

      const id = blocage.accepte ? blocage.fiche.absence.id : "";
      const levee = await leverLeBlocage(
        SESSION,
        { absence_id: id },
        clientApp(),
      );
      expect(levee.accepte).toBe(true);

      const [ligne] = await clientOwner().$queryRawUnsafe<
        Array<{ date_planifiee: Date | null; statut: string }>
      >(
        `SELECT "date_planifiee", "statut" FROM "intervention" WHERE "id" = $1::uuid`,
        interventionId,
      );
      expect(ligne.date_planifiee).toBeNull();
      expect(ligne.statut).toBe("a_planifier");
    });

    it("UN BLOCAGE INCONNU EST « INTROUVABLE », et rien de plus", async () => {
      // *Les distinguer ferait un oracle* (D35, D50).
      const levee = await leverLeBlocage(
        SESSION,
        { absence_id: uuidv7() },
        clientApp(),
      );
      expect(levee).toEqual({
        accepte: false,
        cle: "absence.refus.inconnue",
      });
    });
  });

  /*
   * ═══ L'ALERTE DE RUPTURE DE SERVICE (L3-04a, RG-PLA-06, D106) ═══════════
   *
   * La règle est éprouvée sans base dans
   * `tests/unit/absences/rupture-de-service.test.ts`. Ce qui se mesure ICI est
   * ce que la règle ne peut pas dire toute seule : **l'effectif est bien
   * compté en base, sous le contexte cloisonné, sur les agences réellement
   * touchées** — et il l'est DANS la transaction qui a déplanifié.
   *
   * *C'est la frontière que personne ne traverse qui casse* (§9, 08/09) : la
   * règle a ses scénarios, le dépôt a les siens, et le maillon entre les deux
   * est l'endroit où un défaut vivrait.
   */
  describe("l'alerte de rupture de service", () => {
    const techniciensPoses: string[] = [];

    async function poserUnTechnicien(utilisateurId: string): Promise<void> {
      const id = uuidv7();
      const pose = await clientOwner().$executeRawUnsafe(
        `INSERT INTO "technicien" ("id","societe_id","utilisateur_id","agence_id","modifie_le")
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, now())
         ON CONFLICT DO NOTHING`,
        id,
        SOCIETE_A,
        utilisateurId,
        AGENCE_A,
      );
      if (pose > 0) {
        techniciensPoses.push(id);
      }
    }

    afterEach(async () => {
      for (const id of techniciensPoses.splice(0)) {
        await clientOwner().$executeRawUnsafe(
          `DELETE FROM "technicien" WHERE "id" = $1::uuid`,
          id,
        );
      }
    });

    it("UN SEUL technicien actif dans l'agence — l'alerte NOMME l'agence et les interventions", async () => {
      await poserUnTechnicien(TECHNICIEN);
      const pose = await deplacerIntervention(
        SESSION,
        deplacement(LUNDI),
        clientApp(),
      );
      expect(pose.accepte).toBe(true);

      const blocage = await bloquer("2026-09-14", "2026-09-18");

      expect(blocage.accepte).toBe(true);
      expect(blocage.accepte && blocage.fiche.ruptures).toEqual([
        {
          etat: "rupture",
          agenceId: AGENCE_A,
          interventions: [interventionId],
        },
      ]);
    });

    it("LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON — à DEUX, aucune alerte", async () => {
      // *Une alerte qui se déclencherait toujours serait verte sur le scénario
      // précédent et décrirait un avertissement qu'on apprend à ne plus lire*
      // (§9, 11/09). Le second technicien est un COLLÈGUE, jamais l'absent.
      await poserUnTechnicien(TECHNICIEN);
      await poserUnTechnicien(UTILISATEUR_PAR_ROLE[Role.adv]);
      const pose = await deplacerIntervention(
        SESSION,
        deplacement(LUNDI),
        clientApp(),
      );
      expect(pose.accepte).toBe(true);

      const blocage = await bloquer("2026-09-14", "2026-09-18");

      expect(blocage.accepte).toBe(true);
      // L'intervention est bien rendue — le TÉMOIN que l'alerte avait de quoi
      // se déclencher, et qu'elle s'est tue pour la bonne raison.
      expect(blocage.accepte && blocage.fiche.deplanifiees).toEqual([
        interventionId,
      ]);
      expect(blocage.accepte && blocage.fiche.ruptures).toEqual([
        { etat: "effectif_suffisant", agenceId: AGENCE_A, effectif: 2 },
      ]);
    });

    it("un blocage qui ne déplanifie RIEN ne rompt rien", async () => {
      await poserUnTechnicien(TECHNICIEN);
      const pose = await deplacerIntervention(
        SESSION,
        deplacement(LUNDI),
        clientApp(),
      );
      expect(pose.accepte).toBe(true);

      const blocage = await bloquer("2026-10-05", "2026-10-09");

      expect(blocage.accepte && blocage.fiche.ruptures).toEqual([]);
    });

    it("AUCUN CRÉNEAU N'EST PROPOSÉ — mesuré sur ce que la POSE REND", async () => {
      // *Un moteur qui propose sur un effectif d'un ne propose rien* (D106), et
      // l'acceptation de L3-04a demande que ce soit MESURÉ. La mesure porte ici
      // sur le chemin réel, pas sur la règle seule : rien dans ce que la
      // transaction rend ne ressemble à une proposition.
      await poserUnTechnicien(TECHNICIEN);
      await deplacerIntervention(SESSION, deplacement(LUNDI), clientApp());
      const blocage = await bloquer("2026-09-14", "2026-09-18");

      expect(blocage.accepte).toBe(true);
      if (!blocage.accepte) return;
      expect(Object.keys(blocage.fiche).sort()).toEqual([
        "absence",
        "deplanifiees",
        "ruptures",
      ]);
    });
  });

  /*
   * ═══ L'AUTRE BOUT DE RG-PLA-06 EST MESURÉ AILLEURS ══════════════════════
   *
   * Le déclencheur `intervention_pas_sur_blocage_agenda` — *on ne pose pas une
   * intervention sur un agenda bloqué* — vit dans
   * `tests/isolation/blocage-agenda-verrous.test.ts`, avec son jumeau et **les
   * trois verbes de Prisma** : `create`, `update` et `upsert`.
   *
   * *Le mesurer ici aussi serait une seconde lecture d'un même critère* (§9,
   * 01/09), et la plus faible des deux : ce fichier écrit par
   * `$executeRawUnsafe`, qui ne passe par aucun des trois verbes dont le §9 du
   * 14/09 dit qu'ils n'atteignent pas les déclencheurs dans le même ordre.
   */
});

/** Sentinelle d'annulation : elle fait retomber la transaction, sans erreur. */
class Annulation extends Error {}

import { afterAll, describe, expect, it } from "vitest";

import { type ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import {
  listerNotifications,
  marquerLue,
  poserNotification,
} from "@/lib/notifications/depot";

import { avecPortail, clientApp, fermerClients, sousSociete } from "./setup/db";
import {
  CLIENT_A1,
  INTERVENTION_A1,
  SITE_A1_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_INTERNE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * LA NOTIFICATION EST FERMÉE AU PORTAIL (9J09-NOTIFICATIONS-SCHEMA, D229).
 *
 * Même motif que `tests/isolation/lot-dimport.test.ts` (D100) : la table est
 * de forme « interne », et c'est la BASE qui le prononce, pas seulement
 * l'absence d'écran. Ce fichier traverse le chemin de PRODUCTION
 * (`lib/notifications/depot.ts`, donc `avecContexteApplicatif`), comme
 * `chaine-import.test.ts` le fait pour le lot d'import — une notification
 * posée par le code réel n'est pas plus lisible qu'une ligne posée à la main.
 */

afterAll(fermerClients);

function session(
  utilisateurId: string,
  societeId: string,
  role: Role,
  clientId: string | null = null,
): ContexteSession {
  return {
    utilisateurId,
    societeId,
    role,
    secondFacteurValide: true,
    adresseIp: null,
    clientId,
  };
}

/** Rôle ADV : niveau « complet » sur `annuler_intervention` (matrice §5.2). */
const INTERNE_ADV = session(UTILISATEUR_INTERNE_A, SOCIETE_A, Role.adv);

/** Rôle technicien : AUCUN niveau sur `annuler_intervention` — ni ●, ni ○. */
const INTERNE_TECHNICIEN = session(
  UTILISATEUR_PAR_ROLE[Role.technicien],
  SOCIETE_A,
  Role.technicien,
);

/** Compte portail de A1 — `app.client_id` posé. */
const PORTAIL_A1 = session(
  UTILISATEUR_PAR_ROLE[Role.client],
  SOCIETE_A,
  Role.client,
  CLIENT_A1,
);

/**
 * LE SECOND ADV DE LA SOCIÉTÉ A — un compte DIFFÉRENT d'`INTERNE_ADV`, même
 * rôle, même capacité (`UTILISATEUR_PAR_ROLE[Role.adv]` est habilité sur
 * SOCIETE_A, comme `UTILISATEUR_INTERNE_A` ; voir `setup/fixtures.ts`).
 * Indispensable au témoin de non-vacuité de « lu par personne » (9J10A) :
 * sans un second ACTEUR réel sur la MÊME société, rien ne distingue « lu par
 * tous » de « lu par UNE personne ».
 */
const INTERNE_ADV_2 = session(
  UTILISATEUR_PAR_ROLE[Role.adv],
  SOCIETE_A,
  Role.adv,
);

/** Un compte interne de l'AUTRE société — `UTILISATEUR_INTERNE_B` (adv, B). */
const INTERNE_B = session(UTILISATEUR_INTERNE_B, SOCIETE_B, Role.adv);

async function poserUnePourA1(): Promise<string> {
  return poserNotification(
    INTERNE_ADV,
    "signature_absente_ou_refusee",
    { cible: "intervention", intervention_id: INTERVENTION_A1 },
    "annuler_intervention",
    undefined,
    clientApp(),
  );
}

describe("le TÉMOIN PRÉALABLE — la politique est en vigueur et elle mord", () => {
  it("un utilisateur interne lit SA société et pas celle de l'autre", async () => {
    const id = await poserUnePourA1();

    const vueParA = await sousSociete(SOCIETE_A, (tx) =>
      tx.notification.findMany({ select: { id: true } }),
    );
    expect(vueParA.map((n) => n.id)).toContain(id);

    const vueParB = await sousSociete(SOCIETE_B, (tx) =>
      tx.notification.findMany({ select: { id: true } }),
    );
    expect(vueParB.map((n) => n.id)).not.toContain(id);
  });

  it("un compte portail n'en lit RIEN à la table — la fermeture EST la forme « interne »", async () => {
    const id = await poserUnePourA1();

    const vuesParLePortail = await avecPortail(
      {
        societeId: SOCIETE_A,
        clientId: CLIENT_A1,
        perimetreSites: [SITE_A1_S1],
      },
      (tx) => tx.notification.findMany({ select: { id: true } }),
    );
    expect(vuesParLePortail.map((n) => n.id)).not.toContain(id);

    // LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON (§9, 11/09) : le MÊME
    // compte, au MÊME instant, lit bien SON parc. Ce n'est pas la session qui
    // est muette, c'est la table qui est fermée.
    const machines = await avecPortail(
      {
        societeId: SOCIETE_A,
        clientId: CLIENT_A1,
        perimetreSites: [SITE_A1_S1],
      },
      (tx) => tx.machine.findMany({ select: { id: true } }),
    );
    expect(machines.length).toBeGreaterThan(0);
  });
});

describe("listerNotifications — filtre par CAPACITÉ, jamais par rôle en dur", () => {
  it("un compte interne AVEC la capacité requise la lit", async () => {
    const id = await poserUnePourA1();

    const vues = await listerNotifications(INTERNE_ADV, clientApp());
    expect(vues.map((n) => n.id)).toContain(id);
  });

  it("un compte interne SANS la capacité requise ne la lit pas — la même ligne, deux rôles", async () => {
    const id = await poserUnePourA1();

    const vueParAdv = await listerNotifications(INTERNE_ADV, clientApp());
    expect(vueParAdv.map((n) => n.id)).toContain(id);

    const vueParTechnicien = await listerNotifications(
      INTERNE_TECHNICIEN,
      clientApp(),
    );
    expect(vueParTechnicien.map((n) => n.id)).not.toContain(id);
  });

  it("un compte portail n'en lit AUCUNE, quel que soit son client — épreuve directe de D229", async () => {
    await poserUnePourA1();

    const vuesParLePortail = await listerNotifications(PORTAIL_A1, clientApp());
    expect(vuesParLePortail).toEqual([]);
  });
});

describe("marquerLue — la date de la PREMIÈRE lecture, jamais réécrite", () => {
  it("pose la date une fois, dans notification_lecture, et la seconde marque ne la déplace pas", async () => {
    const id = await poserUnePourA1();

    await marquerLue(INTERNE_ADV, id, clientApp());
    const premiere = await sousSociete(SOCIETE_A, (tx) =>
      tx.notificationLecture.findUniqueOrThrow({
        where: {
          notification_id_utilisateur_id: {
            notification_id: id,
            utilisateur_id: UTILISATEUR_INTERNE_A,
          },
        },
        select: { lue_le: true },
      }),
    );
    expect(premiere.lue_le).not.toBeNull();

    await marquerLue(INTERNE_ADV, id, clientApp());
    const seconde = await sousSociete(SOCIETE_A, (tx) =>
      tx.notificationLecture.findUniqueOrThrow({
        where: {
          notification_id_utilisateur_id: {
            notification_id: id,
            utilisateur_id: UTILISATEUR_INTERNE_A,
          },
        },
        select: { lue_le: true },
      }),
    );
    expect(seconde.lue_le).toEqual(premiere.lue_le);
  });
});

/**
 * « LU PAR PERSONNE » (9J10A-NOTIFICATION-LUE-PAR-PERSONNE) — décision
 * d'Alexis du 05/11/2026 : chacun garde la sienne jusqu'à ce qu'il la lise
 * lui-même, même sur une notification COLLECTIVE.
 */
describe("marquerLue — lu par personne, jamais par tous", () => {
  it("une notification COLLECTIVE lue par A reste NON LUE pour B, sur la même société", async () => {
    const id = await poserUnePourA1();

    await marquerLue(INTERNE_ADV, id, clientApp());

    const vueParA = await listerNotifications(INTERNE_ADV, clientApp());
    expect(vueParA.find((n) => n.id === id)?.lueLe).not.toBeNull();

    const vueParB = await listerNotifications(INTERNE_ADV_2, clientApp());
    expect(vueParB.find((n) => n.id === id)?.lueLe).toBeNull();
  });

  it("A ne peut PAS marquer lue la notification PERSONNELLE de B — rien n'est écrit (M2)", async () => {
    const id = await poserNotification(
      INTERNE_ADV,
      "signature_absente_ou_refusee",
      { cible: "intervention", intervention_id: INTERVENTION_A1 },
      "annuler_intervention",
      UTILISATEUR_PAR_ROLE[Role.adv],
      clientApp(),
    );

    // A (`INTERNE_ADV`) tente de marquer lue la notification de B.
    await marquerLue(INTERNE_ADV, id, clientApp());

    const ligneDeA = await sousSociete(SOCIETE_A, (tx) =>
      tx.notificationLecture.findUnique({
        where: {
          notification_id_utilisateur_id: {
            notification_id: id,
            utilisateur_id: UTILISATEUR_INTERNE_A,
          },
        },
      }),
    );
    expect(ligneDeA).toBeNull();

    // Et la notification reste bien visible et lisible par B, SON
    // destinataire — ce n'est pas la ligne qui est fermée, c'est l'accès
    // d'A qui l'est.
    await marquerLue(INTERNE_ADV_2, id, clientApp());
    const ligneDeB = await sousSociete(SOCIETE_A, (tx) =>
      tx.notificationLecture.findUnique({
        where: {
          notification_id_utilisateur_id: {
            notification_id: id,
            utilisateur_id: UTILISATEUR_PAR_ROLE[Role.adv],
          },
        },
      }),
    );
    expect(ligneDeB?.lue_le).not.toBeNull();
  });

  it("une AUTRE société ne lit ni n'écrit aucune ligne de lecture", async () => {
    const id = await poserUnePourA1();
    await marquerLue(INTERNE_ADV, id, clientApp());

    // Lecture : la société B ne voit AUCUNE ligne de lecture de la société A
    // — la filiation échoue, faute de notification visible sous son contexte.
    const vuesParB = await sousSociete(SOCIETE_B, (tx) =>
      tx.notificationLecture.findMany({ where: { notification_id: id } }),
    );
    expect(vuesParB).toEqual([]);

    // Écriture : la société B ne peut pas y poser de ligne non plus —
    // `marquerLue` sous son propre contexte ne trouve même pas la
    // notification (RLS de `notification`, forme « interne »), donc
    // n'écrit rien, sans erreur bavarde.
    await marquerLue(INTERNE_B, id, clientApp());
    const toujoursAucune = await sousSociete(SOCIETE_B, (tx) =>
      tx.notificationLecture.findMany({ where: { notification_id: id } }),
    );
    expect(toujoursAucune).toEqual([]);
  });
});

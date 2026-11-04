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
  it("pose la date une fois, et la seconde marque ne la déplace pas", async () => {
    const id = await poserUnePourA1();

    await marquerLue(INTERNE_ADV, id, clientApp());
    const premiere = await sousSociete(SOCIETE_A, (tx) =>
      tx.notification.findUniqueOrThrow({
        where: { id },
        select: { lue_le: true },
      }),
    );
    expect(premiere.lue_le).not.toBeNull();

    await marquerLue(INTERNE_ADV, id, clientApp());
    const seconde = await sousSociete(SOCIETE_A, (tx) =>
      tx.notification.findUniqueOrThrow({
        where: { id },
        select: { lue_le: true },
      }),
    );
    expect(seconde.lue_le).toEqual(premiere.lue_le);
  });
});

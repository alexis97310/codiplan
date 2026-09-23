import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { declarerAbsence } from "@/lib/absences/depot";
import { schemaCreationAbsence } from "@/lib/absences/saisie";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { affecterTechnicien } from "@/lib/interventions/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * RG-PLA-06 SUR LA TROISIÈME VOIE — « AFFECTER » (PLANNING-1, 22/09/2026).
 *
 * ## Le défaut mesuré
 *
 * `tests/isolation/absence.test.ts` prouve qu'un agenda bloqué refuse le
 * créneau *au DÉPLACEMENT comme à la pose* — « une règle tenue par un chemin
 * sur deux n'est pas tenue ». Il y avait un TROISIÈME chemin qui écrit
 * `technicien_id` sur une intervention DATÉE : `affecterTechnicien`, la voie
 * « Affecter » de la fiche. Il ne portait pas le contrôle. Le déclencheur
 * `intervention_pas_sur_blocage_agenda` refusait bien — la règle tenait en
 * base —, mais par une EXCEPTION, jamais par un motif nommé : l'écran ne
 * pouvait rien afficher d'autre qu'une erreur. *Le contrôle applicatif
 * EXPLIQUE ; le déclencheur GARDE* (`lib/interventions/depot.ts`), et sur
 * cette voie il n'y avait personne pour expliquer.
 *
 * Mesuré avant la correction : l'appel REJETTE avec
 * `intervention_pas_sur_blocage_agenda` au lieu de rendre
 * `{ accepte: false, cle: "intervention.refus.absence" }`.
 *
 * ## Le témoin
 *
 * La même affectation, le technicien n'étant pas bloqué, est ACCEPTÉE : sans
 * lui, un refus venu d'ailleurs — habilitation, statut — passerait pour le
 * refus qu'on mesure (§9, 30/08).
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

/** Un lundi ouvert du calendrier de l'agence A — comme `absence.test.ts`. */
const LUNDI = "2026-09-14";

let interventionId = "";
const absencesPosees: string[] = [];

async function bloquer(du: string, au: string): Promise<void> {
  const resultat = await declarerAbsence(
    SESSION,
    schemaCreationAbsence.parse({
      utilisateur_id: TECHNICIEN,
      du: new Date(`${du}T00:00:00.000Z`),
      au: new Date(`${au}T00:00:00.000Z`),
    }),
    clientApp(),
  );
  if (!resultat.accepte) {
    throw new Error(`blocage refusé : ${resultat.cle}`);
  }
  absencesPosees.push(resultat.fiche.absence.id);
}

beforeEach(async () => {
  // Une intervention DATÉE du lundi, SANS technicien : c'est celle qu'on
  // affecte. Le déclencheur ne juge que les lignes datées ET affectées —
  // l'écrire sans technicien passe, et l'affectation est le geste jugé.
  interventionId = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "type", "statut", "date_planifiee", "duree_estimee_min", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
             'planifiee', $6::date, 60, now())`,
    interventionId,
    SOCIETE_A,
    CLIENT_A1,
    SITE_A1_S1,
    AGENCE_A,
    LUNDI,
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

describe("RG-PLA-06 — affecter un technicien dont l'agenda est bloqué ce jour-là", () => {
  it("TÉMOIN — sans blocage, la même affectation est acceptée", async () => {
    const resultat = await affecterTechnicien(
      SESSION,
      interventionId,
      TECHNICIEN,
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
  });

  it("est REFUSÉE par le dépôt, avec le motif NOMMÉ — jamais une exception", async () => {
    await bloquer(LUNDI, LUNDI);
    const resultat = await affecterTechnicien(
      SESSION,
      interventionId,
      TECHNICIEN,
      clientApp(),
    );
    expect(resultat).toEqual({
      accepte: false,
      cle: "intervention.refus.absence",
    });
  });

  it("et rien n'est écrit : le technicien n'est pas posé sur la ligne", async () => {
    await bloquer(LUNDI, LUNDI);
    await affecterTechnicien(SESSION, interventionId, TECHNICIEN, clientApp());
    const lignes = await clientOwner().$queryRawUnsafe<
      Array<{ technicien_id: string | null }>
    >(
      `SELECT "technicien_id" FROM "intervention" WHERE "id" = $1::uuid`,
      interventionId,
    );
    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.technicien_id).toBeNull();
  });

  it("le LENDEMAIN du blocage, l'affectation passe — la borne est comprise, pas élargie", async () => {
    await bloquer("2026-09-12", "2026-09-13");
    const resultat = await affecterTechnicien(
      SESSION,
      interventionId,
      TECHNICIEN,
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
  });
});

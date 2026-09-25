import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { compterInterventionsAVenirParTechnicien } from "@/lib/techniciens/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  AGENCE_B,
  CLIENT_A1,
  CLIENT_B1,
  SITE_A1_S1,
  SITE_B1_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_INTERNE_B,
} from "./setup/fixtures";

/**
 * `compterInterventionsAVenirParTechnicien` (ÉQUIPE-1, SAV-24) — le cloisonnement
 * du compte qui alimente l'avertissement de désactivation.
 *
 * ## LA MÊME IDENTITÉ, DEUX SOCIÉTÉS
 *
 * `technicien_id` sur `intervention` n'est qu'une IDENTITÉ (voir l'en-tête de
 * `lib/techniciens/depot.ts`) — une personne peut légitimement porter des
 * interventions dans DEUX sociétés. `UTILISATEUR_EQU1` porte une intervention
 * à venir dans CHACUNE des deux sociétés du harnais : si le compte de la
 * société A voyait celle de la société B (ou l'inverse), ce serait une fuite
 * de cloisonnement (I1), pas seulement un mauvais nombre.
 *
 * ## DES INTERVENTIONS DÉDIÉES, JAMAIS `INTERVENTION_A1`
 *
 * Le harnais partagé date ses fixtures sans garantie envers « aujourd'hui » ;
 * ce scénario a besoin d'une date PASSÉE et d'une date FUTURE certaines, avec
 * cinq jours de marge de chaque côté pour ne dépendre d'aucun fuseau.
 */

function joursDepuisAujourdhui(delta: number): Date {
  const maintenant = new Date();
  const jour = new Date(
    Date.UTC(
      maintenant.getUTCFullYear(),
      maintenant.getUTCMonth(),
      maintenant.getUTCDate(),
    ),
  );
  jour.setUTCDate(jour.getUTCDate() + delta);
  return jour;
}

const DATE_FUTURE = joursDepuisAujourdhui(5);
const DATE_PASSEE = joursDepuisAujourdhui(-5);

const UTILISATEUR_EQU1 = uuidv7();
const UTILISATEUR_EQU1_SANS_INTERVENTION = uuidv7();

const EQU1_A_FUTURE = uuidv7();
const EQU1_A_PASSEE = uuidv7();
const EQU1_A_CLOTUREE = uuidv7();
const EQU1_B_FUTURE = uuidv7();

const POSEES = [EQU1_A_FUTURE, EQU1_A_PASSEE, EQU1_A_CLOTUREE, EQU1_B_FUTURE];

const CONTEXTE_A = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const CONTEXTE_B = {
  utilisateurId: UTILISATEUR_INTERNE_B,
  societeId: SOCIETE_B,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

function insertion(
  id: string,
  societeId: string,
  clientId: string,
  siteId: string,
  agenceId: string,
  statut: string,
  datePlanifiee: Date,
): Promise<number> {
  return clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention"
       ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
        "statut", "technicien_id", "date_planifiee", "duree_estimee_min", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
             $6::"StatutIntervention", $7::uuid, $8::date, 60, now())`,
    id,
    societeId,
    clientId,
    siteId,
    agenceId,
    statut,
    UTILISATEUR_EQU1,
    datePlanifiee,
  );
}

beforeAll(async () => {
  await insertion(
    EQU1_A_FUTURE,
    SOCIETE_A,
    CLIENT_A1,
    SITE_A1_S1,
    AGENCE_A,
    "planifiee",
    DATE_FUTURE,
  );
  await insertion(
    EQU1_A_PASSEE,
    SOCIETE_A,
    CLIENT_A1,
    SITE_A1_S1,
    AGENCE_A,
    "planifiee",
    DATE_PASSEE,
  );
  await insertion(
    EQU1_A_CLOTUREE,
    SOCIETE_A,
    CLIENT_A1,
    SITE_A1_S1,
    AGENCE_A,
    "cloturee",
    DATE_FUTURE,
  );
  await insertion(
    EQU1_B_FUTURE,
    SOCIETE_B,
    CLIENT_B1,
    SITE_B1_S1,
    AGENCE_B,
    "planifiee",
    DATE_FUTURE,
  );
});

afterAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "id" IN (${POSEES.map((i) => `'${i}'`).join(",")})`,
  );
  await fermerClients();
});

describe("compterInterventionsAVenirParTechnicien (ÉQUIPE-1)", () => {
  it("compte, pour la société A, la seule intervention à venir de A — jamais celle de B", async () => {
    const comptes = await compterInterventionsAVenirParTechnicien(
      CONTEXTE_A,
      [UTILISATEUR_EQU1],
      clientApp(),
    );
    expect(comptes.get(UTILISATEUR_EQU1)).toBe(1);
  });

  it("compte, pour la société B, la seule intervention à venir de B — jamais celle de A", async () => {
    const comptes = await compterInterventionsAVenirParTechnicien(
      CONTEXTE_B,
      [UTILISATEUR_EQU1],
      clientApp(),
    );
    expect(comptes.get(UTILISATEUR_EQU1)).toBe(1);
  });

  it("exclut la date passée et le statut clôturée — seule la ligne planifiée à venir compte", async () => {
    // Si le filtre de date ou de statut disparaissait, ce compte passerait à 3
    // (les trois lignes de la société A) au lieu de 1.
    const comptes = await compterInterventionsAVenirParTechnicien(
      CONTEXTE_A,
      [UTILISATEUR_EQU1],
      clientApp(),
    );
    expect(comptes.get(UTILISATEUR_EQU1)).toBe(1);
  });

  it("un technicien sans intervention à venir reçoit 0, jamais une absence de mesure", async () => {
    const comptes = await compterInterventionsAVenirParTechnicien(
      CONTEXTE_A,
      [UTILISATEUR_EQU1, UTILISATEUR_EQU1_SANS_INTERVENTION],
      clientApp(),
    );
    expect(comptes.get(UTILISATEUR_EQU1_SANS_INTERVENTION)).toBe(0);
  });

  it("une liste vide rend une table vide sans requête", async () => {
    expect(
      await compterInterventionsAVenirParTechnicien(
        CONTEXTE_A,
        [],
        clientApp(),
      ),
    ).toEqual(new Map());
  });
});

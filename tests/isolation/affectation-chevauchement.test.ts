import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { instantAMinutes, lireCleJour } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { affecterTechnicien } from "@/lib/interventions/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  FUSEAU_SOCIETE_A,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * 9L02-AFFECTER-CHEVAUCHEMENT (RG-PLA-03, D99) — « Changer de technicien »
 * refuse le chevauchement, par le MÊME verdict que la pose et le
 * déplacement, et exige un technicien ACTIF de la société active.
 *
 * `verdictChevauchement` avait deux appelants — `verdictALaPose`, pour la
 * pose et le déplacement — et `affecterTechnicien`, la voie « Changer de
 * technicien » de la fiche, n'en faisait pas partie : *une règle tenue par un
 * chemin sur deux n'est pas tenue* (§9, 01/09), exactement comme
 * `tests/isolation/pose-habilitation.test.ts` et
 * `tests/isolation/affectation-agenda-bloque.test.ts` l'ont déjà mesuré pour
 * RG-PLA-04 et RG-PLA-06. `technicien_id` ne porte par ailleurs aucune clé
 * étrangère (I10 n'en a jamais promis sur cette colonne) : rien n'empêchait
 * d'y poser un identifiant hors société, ou celui d'une personne qui n'est
 * pas technicien.
 */

afterAll(fermerClients);

const SESSION = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.adv],
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien];

/** UN LUNDI, dans la plage 08:00–12:00 du calendrier de l'agence A. */
const JOUR_LUNDI = lireCleJour("2026-09-14");
const LUNDI = new Date("2026-09-14T00:00:00.000Z");
const DUREE_MIN = 60;

const interventionsPosees: string[] = [];
let technicienInactifId = "";
let technicienInactifLiaisonId = "";

/** L'intervention qu'on affecte — DATÉE, SANS technicien, prête à juger. */
async function creerInterventionAAffecter(
  debutMinutes: number,
  dureeMin: number,
): Promise<string> {
  const id = uuidv7();
  const debut = instantAMinutes(JOUR_LUNDI, debutMinutes, FUSEAU_SOCIETE_A);
  const fin = new Date(debut.getTime() + dureeMin * 60_000);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "type", "statut", "duree_estimee_min", "date_planifiee",
       "creneau_debut", "creneau_fin", "description", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
             'planifiee', $6, $7, $8, $9, '9L02-a-affecter', now())`,
    id,
    SOCIETE_A,
    CLIENT_A1,
    SITE_A1_S1,
    AGENCE_A,
    dureeMin,
    LUNDI,
    debut,
    fin,
  );
  interventionsPosees.push(id);
  return id;
}

/** Une voisine déjà POSÉE sur le technicien, pour fabriquer un chevauchement. */
async function creerVoisinePosee(
  debutMinutes: number,
  dureeMin: number,
): Promise<string> {
  const id = uuidv7();
  const debut = instantAMinutes(JOUR_LUNDI, debutMinutes, FUSEAU_SOCIETE_A);
  const fin = new Date(debut.getTime() + dureeMin * 60_000);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "type", "statut", "duree_estimee_min", "date_planifiee",
       "creneau_debut", "creneau_fin", "technicien_id", "description",
       "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
             'planifiee', $6, $7, $8, $9, $10::uuid, '9L02-voisine', now())`,
    id,
    SOCIETE_A,
    CLIENT_A1,
    SITE_A1_S1,
    AGENCE_A,
    dureeMin,
    LUNDI,
    debut,
    fin,
    TECHNICIEN,
  );
  interventionsPosees.push(id);
  return id;
}

afterEach(async () => {
  for (const id of interventionsPosees.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
      id,
    );
  }
  if (technicienInactifId !== "") {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "utilisateur_societe" WHERE "id" = $1::uuid`,
      technicienInactifLiaisonId,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "utilisateur" WHERE "id" = $1::uuid`,
      technicienInactifId,
    );
    technicienInactifId = "";
    technicienInactifLiaisonId = "";
  }
});

describe("RG-PLA-03 à l'affectation — le chevauchement décide comme à la pose", () => {
  it("TÉMOIN — sans voisine, l'affectation passe", async () => {
    const id = await creerInterventionAAffecter(9 * 60, DUREE_MIN);
    const resultat = await affecterTechnicien(
      SESSION,
      id,
      TECHNICIEN,
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
  });

  it("LE CHEVAUCHEMENT — le technicien tient déjà ce créneau, l'affectation est refusée", async () => {
    await creerVoisinePosee(9 * 60, DUREE_MIN);
    const id = await creerInterventionAAffecter(9 * 60, DUREE_MIN);
    const resultat = await affecterTechnicien(
      SESSION,
      id,
      TECHNICIEN,
      clientApp(),
    );
    expect(resultat).toEqual({
      accepte: false,
      cle: "intervention.refus.chevauchement",
    });
    // ET RIEN N'EST ÉCRIT.
    const [ligne] = await clientOwner().$queryRawUnsafe<
      Array<{ technicien_id: string | null }>
    >(`SELECT "technicien_id" FROM "intervention" WHERE "id" = $1::uuid`, id);
    expect(ligne.technicien_id).toBeNull();
  });

  it("DEUX CRÉNEAUX QUI SE TOUCHENT NE SE CHEVAUCHENT PAS — l'affectation passe", async () => {
    // Voisine 08:00–09:00, intervention visée 09:00–10:00 : la borne de fin
    // de l'une est la borne de début de l'autre (même règle qu'à la pose).
    await creerVoisinePosee(8 * 60, DUREE_MIN);
    const id = await creerInterventionAAffecter(9 * 60, DUREE_MIN);
    const resultat = await affecterTechnicien(
      SESSION,
      id,
      TECHNICIEN,
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
  });
});

describe("l'affectation exige un technicien ACTIF de la société active", () => {
  it("TÉMOIN — le bon identifiant, technicien actif de la société, passe", async () => {
    const id = await creerInterventionAAffecter(9 * 60, DUREE_MIN);
    const resultat = await affecterTechnicien(
      SESSION,
      id,
      TECHNICIEN,
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
  });

  it("UN NON-TECHNICIEN de la société active est refusé", async () => {
    const id = await creerInterventionAAffecter(9 * 60, DUREE_MIN);
    const resultat = await affecterTechnicien(
      SESSION,
      id,
      UTILISATEUR_PAR_ROLE[Role.adv],
      clientApp(),
    );
    expect(resultat).toEqual({
      accepte: false,
      cle: "intervention.refus.technicien_introuvable",
    });
    const [ligne] = await clientOwner().$queryRawUnsafe<
      Array<{ technicien_id: string | null }>
    >(`SELECT "technicien_id" FROM "intervention" WHERE "id" = $1::uuid`, id);
    expect(ligne.technicien_id).toBeNull();
  });

  it("UN IDENTIFIANT D'UNE AUTRE SOCIÉTÉ est refusé", async () => {
    const id = await creerInterventionAAffecter(9 * 60, DUREE_MIN);
    const resultat = await affecterTechnicien(
      SESSION,
      id,
      UTILISATEUR_INTERNE_B,
      clientApp(),
    );
    expect(resultat).toEqual({
      accepte: false,
      cle: "intervention.refus.technicien_introuvable",
    });
  });

  it("UN TECHNICIEN INACTIF est refusé", async () => {
    technicienInactifId = uuidv7();
    technicienInactifLiaisonId = uuidv7();
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "utilisateur" ("id", "nom", "email", "actif", "modifie_le")
       VALUES ($1::uuid, '9L02 — Technicien inactif', $2, false, now())`,
      technicienInactifId,
      `9l02-inactif-${technicienInactifId}@iso.test`,
    );
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "utilisateur_societe" ("id", "utilisateur_id", "societe_id", "role")
       VALUES ($1::uuid, $2::uuid, $3::uuid, 'technicien'::"Role")`,
      technicienInactifLiaisonId,
      technicienInactifId,
      SOCIETE_A,
    );
    const id = await creerInterventionAAffecter(9 * 60, DUREE_MIN);
    const resultat = await affecterTechnicien(
      SESSION,
      id,
      technicienInactifId,
      clientApp(),
    );
    expect(resultat).toEqual({
      accepte: false,
      cle: "intervention.refus.technicien_introuvable",
    });
  });
});

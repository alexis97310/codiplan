import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import {
  deplacerIntervention,
  transmettreIntervention,
} from "@/lib/interventions/depot";
import { schemaDeplacement } from "@/lib/interventions/saisie";

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
 * D123 d'Alexis (19/10/2026, Projet ; constat 2 de l'audit fonctionnel 9F5,
 * D217) — « avertir, laisser faire » : une date déjà passée devient une
 * porte « à confirmer », à la pose ET à la transmission individuelle,
 * jamais un silence.
 *
 * **Un LUNDI réel du calendrier (08:00–12:00 à l'agence A), désormais
 * PASSÉ** — exactement la date que `tests/isolation/pose-habilitation.test.ts`
 * emploie pour RG-PLA-04 : elle sert ici la même raison, à l'écart de toute
 * question de jour fermé ou d'heure hors ouverture, pour isoler LA SEULE
 * règle que ce fichier éprouve.
 */
const LUNDI = new Date("2026-09-14T00:00:00.000Z");
const DEBUT_MINUTES = 9 * 60;

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

let interventionId = "";

function deplacement(confirmer: boolean) {
  return schemaDeplacement.parse({
    intervention_id: interventionId,
    date_planifiee: LUNDI,
    debut_minutes: DEBUT_MINUTES,
    duree_min: 60,
    technicien_id: TECHNICIEN,
    confirmer_date_passee: confirmer,
  });
}

beforeEach(async () => {
  interventionId = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "type", "statut", "technicien_id", "date_planifiee",
       "creneau_debut", "duree_estimee_min", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
             'planifiee', $6::uuid, $7::date, $8::timestamptz, 60, now())`,
    interventionId,
    SOCIETE_A,
    CLIENT_A1,
    SITE_A1_S1,
    AGENCE_A,
    TECHNICIEN,
    LUNDI,
    new Date("2026-09-14T09:00:00.000Z"),
  );
});

afterEach(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
    interventionId,
  );
});

describe("la pose refuse une date passée, confirmable (D123, D217)", () => {
  it("SANS confirmation — refus NOMMÉ, confirmable, rien n'est écrit", async () => {
    const resultat = await deplacerIntervention(
      SESSION,
      deplacement(false),
      clientApp(),
    );
    expect(resultat).toEqual({
      accepte: false,
      cle: "intervention.refus.date_passee",
      confirmable: true,
    });
    const ligne = await clientOwner().intervention.findFirstOrThrow({
      where: { id: interventionId },
      select: { creneau_debut: true },
    });
    // RIEN N'EST ÉCRIT — l'heure d'origine (09:00) reste, jamais remplacée.
    expect(ligne.creneau_debut?.toISOString()).toBe("2026-09-14T09:00:00.000Z");
  });

  it("CONFIRMÉE — acceptée, avec son avertissement nommé", async () => {
    const resultat = await deplacerIntervention(
      SESSION,
      deplacement(true),
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
    expect(resultat.accepte && resultat.avertissements).toContain(
      "intervention.avertissement.date_passee",
    );
  });
});

describe("la transmission individuelle refuse une date passée, confirmable (D123, D217)", () => {
  it("SANS confirmation — refus NOMMÉ, confirmable, le statut ne bouge pas", async () => {
    const resultat = await transmettreIntervention(
      SESSION,
      interventionId,
      false,
      clientApp(),
    );
    expect(resultat).toEqual({
      accepte: false,
      cle: "intervention.refus.date_passee",
      confirmable: true,
    });
    const ligne = await clientOwner().intervention.findFirstOrThrow({
      where: { id: interventionId },
      select: { statut: true },
    });
    expect(ligne.statut).toBe("planifiee");
  });

  it("CONFIRMÉE — transmise, Affectée, avec son avertissement nommé", async () => {
    const resultat = await transmettreIntervention(
      SESSION,
      interventionId,
      true,
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
    expect(resultat.accepte && resultat.avertissements).toContain(
      "intervention.avertissement.date_passee",
    );
    const ligne = await clientOwner().intervention.findFirstOrThrow({
      where: { id: interventionId },
      select: { statut: true },
    });
    expect(ligne.statut).toBe("affectee");
  });
});

import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import {
  attribuerHabilitation,
  creerExigence,
  creerHabilitation,
  exigencesDuSite,
  retirerAttribution,
} from "@/lib/habilitations/depot";
import {
  affecterTechnicien,
  lireFicheIntervention,
} from "@/lib/interventions/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * ÉQUIPE-2 — LE VERROU EST CODÉ, ET IL EST DÉSORMAIS ALIMENTABLE.
 *
 * ## Le trou que ce fichier mesure
 *
 * `lib/habilitations/affectation.ts` applique RG-PLA-04 depuis L1-04, et
 * `lib/interventions/depot.ts` l'appelle réellement — `pose-habilitation.test.ts`
 * le prouve déjà, par des `INSERT` bruts sur `habilitation`,
 * `site_habilitation_requise` et `technicien_habilitation`. **Ce fichier ne
 * rejoue pas cette preuve : il prouve que le CHEMIN D'ÉCRITURE APPLICATIF —
 * `lib/habilitations/depot.ts`, ÉQUIPE-2 — alimente le MÊME verrou.** Avant ce
 * lot, aucune fonction ne savait écrire ces trois tables hors du seed ; les
 * scénarios ci-dessous créent le référentiel, l'attribution et l'exigence par
 * les fonctions du dépôt, jamais par une ligne SQL à la main, puis vérifient
 * que `lib/interventions/depot.ts` — non modifié par ce lot — en tient
 * compte.
 *
 * ## Chaque refus porte son JUMEAU (§9, 24/08)
 *
 * Un refus prouve que le verrou mordait le jour où on l'a écrit. Le jumeau
 * retire le verrou visé — l'habilitation est attribuée — et montre que la
 * même écriture passe alors : *si un gardien ne rougit pas quand on retire
 * une habilitation, il ne garde rien.*
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

const SESSION_B = { ...SESSION, societeId: SOCIETE_B };

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien];

/** Un motif d'unicité par test, pour ne jamais heurter un code déjà pris. */
function code(prefixe: string): string {
  return `${prefixe}-${uuidv7().slice(-8)}`;
}

/**
 * LES LIGNES DE CE FICHIER, ET ELLES SEULES — même discipline que
 * `pose-habilitation.test.ts` : la base d'isolation est PARTAGÉE, et un
 * `DELETE` qui balaierait au-delà de ce que ce fichier a écrit ferait tomber
 * des scénarios qui n'y sont pour rien.
 */
let interventionId = "";
let habilitationIds: string[] = [];
let exigenceIds: string[] = [];
let attributionIds: string[] = [];

beforeEach(async () => {
  interventionId = uuidv7();
  habilitationIds = [];
  exigenceIds = [];
  attributionIds = [];
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
  // Dans l'ordre des clés étrangères.
  for (const id of attributionIds) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "technicien_habilitation" WHERE "id" = $1::uuid`,
      id,
    );
  }
  for (const id of exigenceIds) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "site_habilitation_requise" WHERE "id" = $1::uuid`,
      id,
    );
  }
  for (const id of habilitationIds) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "habilitation" WHERE "id" = $1::uuid`,
      id,
    );
  }
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
    interventionId,
  );
});

/** Le technicien affecté DIRECTEMENT — bord de test, jamais un chemin produit. */
async function affecterDeForce(): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `UPDATE "intervention" SET "technicien_id" = $1::uuid WHERE "id" = $2::uuid`,
    TECHNICIEN,
    interventionId,
  );
}

describe("le référentiel, l'attribution et l'exigence ALIMENTENT le vrai chemin de refus", () => {
  it("un technicien SANS l'habilitation exigée est refusé, et le refus nomme le CODE — jamais un UUID", async () => {
    const habilitationCode = code("BR");
    const habilitation = await creerHabilitation(
      SESSION,
      {
        code: habilitationCode,
        libelle: "Habilitation électrique",
        duree_validite_mois: null,
      },
      clientApp(),
    );
    expect(habilitation.accepte).toBe(true);
    if (!habilitation.accepte) return;
    habilitationIds.push(habilitation.id);

    const exigence = await creerExigence(
      SESSION,
      { site_id: SITE_A1_S1, habilitation_id: habilitation.id, bloquant: true },
      clientApp(),
    );
    expect(exigence.accepte).toBe(true);
    if (!exigence.accepte) return;
    exigenceIds.push(exigence.id);

    // LE REFUS, par le vrai chemin d'affectation.
    const refus = await affecterTechnicien(
      SESSION,
      interventionId,
      TECHNICIEN,
      clientApp(),
    );
    expect(refus).toEqual({
      accepte: false,
      cle: "intervention.refus.habilitation",
    });

    // ET LE DÉTAIL, lu par le même chemin que la fiche d'intervention — le
    // CODE voyage, jamais l'identifiant technique (D73).
    await affecterDeForce();
    const fiche = await lireFicheIntervention(
      SESSION,
      interventionId,
      clientApp(),
    );
    expect(fiche?.habilitations?.bloquee).toBe(true);
    expect(fiche?.habilitations?.bloquantes).toEqual([
      {
        habilitation_id: habilitation.id,
        code: habilitationCode,
        motif: "absente",
      },
    ]);
    const codeVu = fiche?.habilitations?.bloquantes[0]?.code;
    expect(codeVu).not.toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    // LE JUMEAU : l'habilitation ATTRIBUÉE par le dépôt, la même affectation
    // passe. Sans lui, ce refus pourrait venir d'ailleurs (§9, 24/08).
    const attribution = await attribuerHabilitation(
      SESSION,
      {
        utilisateur_id: TECHNICIEN,
        habilitation_id: habilitation.id,
        date_obtention: new Date("2020-01-01T00:00:00.000Z"),
        date_expiration: null,
      },
      clientApp(),
    );
    expect(attribution.accepte).toBe(true);
    if (attribution.accepte) attributionIds.push(attribution.id);

    const accepte = await affecterTechnicien(
      SESSION,
      interventionId,
      TECHNICIEN,
      clientApp(),
    );
    expect(accepte.accepte).toBe(true);
  });

  it("une habilitation EXPIRÉE refuse au même titre qu'une habilitation jamais eue", async () => {
    const habilitationCode = code("CACES");
    const habilitation = await creerHabilitation(
      SESSION,
      { code: habilitationCode, libelle: "CACES", duree_validite_mois: null },
      clientApp(),
    );
    expect(habilitation.accepte).toBe(true);
    if (!habilitation.accepte) return;
    habilitationIds.push(habilitation.id);

    const exigence = await creerExigence(
      SESSION,
      { site_id: SITE_A1_S1, habilitation_id: habilitation.id, bloquant: true },
      clientApp(),
    );
    expect(exigence.accepte).toBe(true);
    if (!exigence.accepte) return;
    exigenceIds.push(exigence.id);

    // Attribuée, mais EXPIRÉE depuis longtemps.
    const attribution = await attribuerHabilitation(
      SESSION,
      {
        utilisateur_id: TECHNICIEN,
        habilitation_id: habilitation.id,
        date_obtention: new Date("2019-01-01T00:00:00.000Z"),
        date_expiration: new Date("2020-01-01T00:00:00.000Z"),
      },
      clientApp(),
    );
    expect(attribution.accepte).toBe(true);
    if (attribution.accepte) attributionIds.push(attribution.id);

    const refus = await affecterTechnicien(
      SESSION,
      interventionId,
      TECHNICIEN,
      clientApp(),
    );
    expect(refus).toEqual({
      accepte: false,
      cle: "intervention.refus.habilitation",
    });

    await affecterDeForce();
    const fiche = await lireFicheIntervention(
      SESSION,
      interventionId,
      clientApp(),
    );
    expect(fiche?.habilitations?.bloquantes).toEqual([
      {
        habilitation_id: habilitation.id,
        code: habilitationCode,
        motif: "expiree",
        expiraitLe: new Date("2020-01-01T00:00:00.000Z"),
      },
    ]);

    // LE JUMEAU : la MÊME habilitation, RETIRÉE puis réattribuée sans
    // échéance — par le dépôt, jamais par une ligne SQL — et la même
    // affectation passe.
    if (attribution.accepte) {
      const retrait = await retirerAttribution(
        SESSION,
        attribution.id,
        clientApp(),
      );
      expect(retrait.accepte).toBe(true);
    }
    const renouvellement = await attribuerHabilitation(
      SESSION,
      {
        utilisateur_id: TECHNICIEN,
        habilitation_id: habilitation.id,
        date_obtention: new Date("2019-01-01T00:00:00.000Z"),
        date_expiration: null,
      },
      clientApp(),
    );
    expect(renouvellement.accepte).toBe(true);
    if (renouvellement.accepte) attributionIds.push(renouvellement.id);

    const accepte = await affecterTechnicien(
      SESSION,
      interventionId,
      TECHNICIEN,
      clientApp(),
    );
    expect(accepte.accepte).toBe(true);
  });

  it("le refus liste TOUTES les habilitations manquantes, pas seulement la première", async () => {
    const codeUn = code("H1");
    const codeDeux = code("H2");
    const habilitationUn = await creerHabilitation(
      SESSION,
      { code: codeUn, libelle: "Première exigence", duree_validite_mois: null },
      clientApp(),
    );
    const habilitationDeux = await creerHabilitation(
      SESSION,
      {
        code: codeDeux,
        libelle: "Seconde exigence",
        duree_validite_mois: null,
      },
      clientApp(),
    );
    expect(habilitationUn.accepte).toBe(true);
    expect(habilitationDeux.accepte).toBe(true);
    if (!habilitationUn.accepte || !habilitationDeux.accepte) return;
    habilitationIds.push(habilitationUn.id, habilitationDeux.id);

    const exigenceUn = await creerExigence(
      SESSION,
      {
        site_id: SITE_A1_S1,
        habilitation_id: habilitationUn.id,
        bloquant: true,
      },
      clientApp(),
    );
    const exigenceDeux = await creerExigence(
      SESSION,
      {
        site_id: SITE_A1_S1,
        habilitation_id: habilitationDeux.id,
        bloquant: true,
      },
      clientApp(),
    );
    expect(exigenceUn.accepte).toBe(true);
    expect(exigenceDeux.accepte).toBe(true);
    if (!exigenceUn.accepte || !exigenceDeux.accepte) return;
    exigenceIds.push(exigenceUn.id, exigenceDeux.id);

    await affecterDeForce();
    const fiche = await lireFicheIntervention(
      SESSION,
      interventionId,
      clientApp(),
    );
    expect(fiche?.habilitations?.bloquantes).toHaveLength(2);
    expect(fiche?.habilitations?.bloquantes.map((b) => b.code).sort()).toEqual(
      [codeDeux, codeUn].sort(),
    );

    // LE JUMEAU : les DEUX attribuées, plus rien ne bloque.
    const attributionUn = await attribuerHabilitation(
      SESSION,
      {
        utilisateur_id: TECHNICIEN,
        habilitation_id: habilitationUn.id,
        date_obtention: new Date("2020-01-01T00:00:00.000Z"),
        date_expiration: null,
      },
      clientApp(),
    );
    const attributionDeux = await attribuerHabilitation(
      SESSION,
      {
        utilisateur_id: TECHNICIEN,
        habilitation_id: habilitationDeux.id,
        date_obtention: new Date("2020-01-01T00:00:00.000Z"),
        date_expiration: null,
      },
      clientApp(),
    );
    if (attributionUn.accepte) attributionIds.push(attributionUn.id);
    if (attributionDeux.accepte) attributionIds.push(attributionDeux.id);

    const ficheApres = await lireFicheIntervention(
      SESSION,
      interventionId,
      clientApp(),
    );
    expect(ficheApres?.habilitations?.bloquee).toBe(false);
    expect(ficheApres?.habilitations?.bloquantes).toEqual([]);
  });
});

describe("une exigence de site ne peut pas désigner l'habilitation d'une AUTRE société", () => {
  it("l'écriture est refusée, et rien n'est posé", async () => {
    const habilitationDeB = await creerHabilitation(
      SESSION_B,
      {
        code: code("HORS-SOCIETE"),
        libelle: "Habilitation de B",
        duree_validite_mois: null,
      },
      clientApp(),
    );
    expect(habilitationDeB.accepte).toBe(true);
    if (!habilitationDeB.accepte) return;
    habilitationIds.push(habilitationDeB.id);

    const tentative = await creerExigence(
      SESSION,
      {
        site_id: SITE_A1_S1,
        habilitation_id: habilitationDeB.id,
        bloquant: true,
      },
      clientApp(),
    );
    expect(tentative).toEqual({
      accepte: false,
      motif: "habilitation_hors_societe",
    });

    const exigences = await exigencesDuSite(SESSION, SITE_A1_S1, clientApp());
    expect(
      exigences.some((e) => e.habilitation_id === habilitationDeB.id),
    ).toBe(false);
  });
});

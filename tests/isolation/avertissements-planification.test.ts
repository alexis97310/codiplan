import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";
import { marquerVuParTechnicien } from "@/lib/interventions/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  CLIENT_B1,
  SITE_A1_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * AVERTISSEMENTS-1 (24/09/2026) — DEUX INVARIANTS QUE LES TESTS UNITAIRES NE
 * PEUVENT PAS ÉPROUVER.
 *
 * `destinataireClient` (`tests/unit/avertissements/destinataire.test.ts`) est
 * PURE : elle ne prouve que sa propre logique de tri, jamais que la lecture
 * qui l'alimente — `tx.contact.findMany` dans `envoyerAuClient`, sous
 * `avecContexteApplicatif` — respecte le cloisonnement. C'est cette lecture-là
 * qui est éprouvée ici, à la même forme, sous la même politique RLS (I1) :
 * une requête filtrée côté application ET une politique en base, jamais l'une
 * sans l'autre.
 *
 * Le second invariant — le badge ne s'efface que sous l'identité du technicien
 * affecté — est un garde-fou APPLICATIF (`marquerVuParTechnicien`), pas une
 * politique RLS : `intervention` reste lisible par toute la société sous sa
 * forme « parc ». Rien d'autre que le `WHERE technicien_id = ...` de la
 * fonction ne le protège, et c'est exactement ce qu'un test d'isolation
 * éprouve.
 */

afterAll(fermerClients);

describe("AUCUN CONTACT D'UNE AUTRE SOCIÉTÉ NE PEUT ÊTRE CHOISI", () => {
  const contactBId = uuidv7();

  beforeEach(async () => {
    // Un donneur d'ordre bien réel, chez un client de la société B — même
    // forme que `envoyerAuClient` interroge : `client_id` + `site_id` nul.
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "contact"
         ("id", "societe_id", "client_id", "site_id", "nom", "roles", "canaux", "email", "actif")
       VALUES ($1::uuid, $2::uuid, $3::uuid, NULL, 'Donneur d''ordre B',
               ARRAY['donneur_ordre'], ARRAY['email'], 'do@b1.test', true)`,
      contactBId,
      SOCIETE_B,
      CLIENT_B1,
    );
  });

  afterEach(async () => {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "contact" WHERE "id" = $1::uuid`,
      contactBId,
    );
  });

  it("TÉMOIN — sous la société B, ce contact EST visible", async () => {
    const vus = await avecContexteRls(
      clientApp(),
      {
        societeId: SOCIETE_B,
        role: Role.adv,
        auteurId: UTILISATEUR_PAR_ROLE[Role.adv],
      },
      (tx) =>
        tx.contact.findMany({
          where: { client_id: CLIENT_B1, OR: [{ site_id: null }] },
          select: { id: true },
        }),
    );
    expect(vus.map((v) => v.id)).toContain(contactBId);
  });

  it("sous la société A, la MÊME requête — même forme que envoyerAuClient — ne le voit pas", async () => {
    // Exactement la forme de la requête de `envoyerAuClient`
    // (`lib/avertissements/planification.ts`) : `client_id` du client visé,
    // `site_id` du site ou nul. Rien ne l'empêche applicativement de nommer
    // `CLIENT_B1` — c'est la politique RLS de `contact`, et elle seule, qui
    // doit mordre ici (I1).
    const vus = await avecContexteRls(
      clientApp(),
      {
        societeId: SOCIETE_A,
        role: Role.adv,
        auteurId: UTILISATEUR_PAR_ROLE[Role.adv],
      },
      (tx) =>
        tx.contact.findMany({
          where: {
            client_id: CLIENT_B1,
            OR: [{ site_id: SITE_A1_S1 }, { site_id: null }],
          },
          select: { id: true },
        }),
    );
    expect(vus).toHaveLength(0);
  });
});

describe("LE BADGE NE S'EFFACE QUE SOUS L'IDENTITÉ DU TECHNICIEN AFFECTÉ", () => {
  const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien];
  const AUTRE = UTILISATEUR_PAR_ROLE[Role.adv];
  let interventionId = "";

  const SESSION_TECHNICIEN = {
    utilisateurId: TECHNICIEN,
    societeId: SOCIETE_A,
    role: Role.technicien,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };

  const SESSION_AUTRE = {
    utilisateurId: AUTRE,
    societeId: SOCIETE_A,
    role: Role.adv,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };

  beforeEach(async () => {
    interventionId = uuidv7();
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
         "agence_id", "type", "statut", "technicien_id", "date_planifiee",
         "duree_estimee_min", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'planifiee', $6::uuid, '2026-09-14'::date, 60, now())`,
      interventionId,
      SOCIETE_A,
      CLIENT_A1,
      SITE_A1_S1,
      AGENCE_A,
      TECHNICIEN,
    );
  });

  afterEach(async () => {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
      interventionId,
    );
  });

  async function vuLe(): Promise<Date | null> {
    const [ligne] = await clientOwner().$queryRawUnsafe<
      { vue_technicien_le: Date | null }[]
    >(
      `SELECT "vue_technicien_le" FROM "intervention" WHERE "id" = $1::uuid`,
      interventionId,
    );
    return ligne?.vue_technicien_le ?? null;
  }

  it("un autre rôle qui appelle la fonction ne pose RIEN", async () => {
    await marquerVuParTechnicien(SESSION_AUTRE, interventionId, clientApp());
    expect(await vuLe()).toBeNull();
  });

  it("le technicien AFFECTÉ, lui, pose l'instant", async () => {
    await marquerVuParTechnicien(
      SESSION_TECHNICIEN,
      interventionId,
      clientApp(),
    );
    expect(await vuLe()).not.toBeNull();
  });

  it("une fois posé, un autre rôle ne l'efface ni ne le rejoue", async () => {
    await marquerVuParTechnicien(
      SESSION_TECHNICIEN,
      interventionId,
      clientApp(),
    );
    const premiere = await vuLe();
    await marquerVuParTechnicien(SESSION_AUTRE, interventionId, clientApp());
    expect(await vuLe()).toEqual(premiere);
  });
});

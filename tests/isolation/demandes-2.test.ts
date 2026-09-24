import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { creerIntervention } from "@/lib/interventions/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  DEMANDE_A1,
  DEMANDE_A2,
  DEMANDE_B1,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * LE LIEN DEMANDE → INTERVENTION (68-DEMANDES-2, SAV-11).
 *
 * ## Ce que ce fichier confronte, et qui n'est éprouvé nulle part ailleurs
 *
 * `creerIntervention` (`lib/interventions/depot.ts`) accepte désormais un
 * `demande_id` facultatif, et exige — quand il est donné — que la demande
 * désignée soit de la MÊME société ET du MÊME site que l'intervention à
 * naître. La société n'est jamais comparée explicitement : la lecture SOUS LE
 * CONTEXTE CLOISONNÉ rend `null` pour une demande d'une autre société (I1),
 * exactement comme pour une demande inexistante — les deux cas se refusent
 * pareil (D50). Le site, lui, SE COMPARE : c'est la seule vraie comparaison
 * que ce lot ajoute.
 *
 * `DEMANDE_A1` est du client A1 sur `SITE_A1_S1` — la combinaison qui doit
 * ACCEPTER ; `DEMANDE_A2` est du MÊME client mais sur `SITE_A1_S2` — même
 * société, autre site, donc REFUSÉE ; `DEMANDE_B1` est d'une autre société —
 * invisible sous ce contexte, donc REFUSÉE elle aussi, par le même chemin.
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

async function nombreDInterventionsAvecDemande(
  demandeId: string,
): Promise<number> {
  const [ligne] = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT count(*) AS n FROM "intervention" WHERE "demande_id" = '${demandeId}'`,
  );
  return Number(ligne?.n ?? 0);
}

describe("créer une intervention DEPUIS une demande (68-DEMANDES-2)", () => {
  it("une demande du MÊME client et du MÊME site est acceptée, et le lien est écrit", async () => {
    const id = uuidv7();
    try {
      const resultat = await creerIntervention(
        SESSION,
        {
          id,
          client_id: CLIENT_A1,
          site_id: SITE_A1_S1,
          machine_ids: [],
          type: "curatif",
          priorite: "p3",
          mode_valorisation: "temps_passe",
          description: "Épreuve 68-DEMANDES-2 — lien accepté",
          contact_id: null,
          reference_client: null,
          demande_id: DEMANDE_A1,
        },
        clientApp(),
      );
      expect(resultat.accepte).toBe(true);

      const [ligne] = await clientOwner().$queryRawUnsafe<
        Array<{ demande_id: string | null }>
      >(`SELECT "demande_id" FROM "intervention" WHERE "id" = '${id}'`);
      expect(ligne?.demande_id).toBe(DEMANDE_A1);
    } finally {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "intervention" WHERE "id" = '${id}'`,
      );
    }
  });

  it("une demande du MÊME client mais d'un AUTRE site est refusée, et rien n'est écrit", async () => {
    const id = uuidv7();
    const avant = await nombreDInterventionsAvecDemande(DEMANDE_A2);

    const resultat = await creerIntervention(
      SESSION,
      {
        id,
        client_id: CLIENT_A1,
        site_id: SITE_A1_S1,
        machine_ids: [],
        type: "curatif",
        priorite: "p3",
        mode_valorisation: "temps_passe",
        description: "Épreuve 68-DEMANDES-2 — autre site",
        contact_id: null,
        reference_client: null,
        // DEMANDE_A2 est du site A1_S2, jamais A1_S1 (fixture, `global.ts`).
        demande_id: DEMANDE_A2,
      },
      clientApp(),
    );
    expect(resultat).toEqual({
      accepte: false,
      cle: "intervention.refus.demande_invalide",
    });

    // RIEN N'A ÉTÉ ÉCRIT — ni l'intervention refusée, ni un rattachement fautif
    // sur la demande visée.
    const [aucune] = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*) AS n FROM "intervention" WHERE "id" = '${id}'`,
    );
    expect(Number(aucune?.n ?? 0)).toBe(0);
    expect(await nombreDInterventionsAvecDemande(DEMANDE_A2)).toBe(avant);
  });

  it("une demande d'une AUTRE société est invisible sous ce contexte, et refusée pareil — jamais un oracle", async () => {
    const id = uuidv7();

    const resultat = await creerIntervention(
      SESSION,
      {
        id,
        client_id: CLIENT_A1,
        site_id: SITE_A1_S1,
        machine_ids: [],
        type: "curatif",
        priorite: "p3",
        mode_valorisation: "temps_passe",
        description: "Épreuve 68-DEMANDES-2 — autre société",
        contact_id: null,
        reference_client: null,
        demande_id: DEMANDE_B1,
      },
      clientApp(),
    );
    // MÊME REFUS que « autre site » ci-dessus (D50) : distinguer « demande
    // d'une autre société » d'« autre site » renseignerait sur l'existence
    // d'une demande que ce contexte ne doit jamais voir.
    expect(resultat).toEqual({
      accepte: false,
      cle: "intervention.refus.demande_invalide",
    });

    const [aucune] = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*) AS n FROM "intervention" WHERE "id" = '${id}'`,
    );
    expect(Number(aucune?.n ?? 0)).toBe(0);
  });

  it("sans demande_id, rien ne change — le champ reste NULL", async () => {
    const id = uuidv7();
    try {
      const resultat = await creerIntervention(
        SESSION,
        {
          id,
          client_id: CLIENT_A1,
          site_id: SITE_A1_S1,
          machine_ids: [],
          type: "curatif",
          priorite: "p3",
          mode_valorisation: "temps_passe",
          description: "Épreuve 68-DEMANDES-2 — sans demande",
          contact_id: null,
          reference_client: null,
          demande_id: null,
        },
        clientApp(),
      );
      expect(resultat.accepte).toBe(true);
      const [ligne] = await clientOwner().$queryRawUnsafe<
        Array<{ demande_id: string | null }>
      >(`SELECT "demande_id" FROM "intervention" WHERE "id" = '${id}'`);
      expect(ligne?.demande_id).toBeNull();
    } finally {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "intervention" WHERE "id" = '${id}'`,
      );
    }
  });
});

import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { creerIntervention } from "@/lib/interventions/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
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
 * Une demande JETABLE du client A1 sur `SITE_A1_S1` — la combinaison qui doit
 * ACCEPTER (R8, 9DX-RETOUCHES-11 : plus `DEMANDE_A1`, une fixture partagée) ;
 * `DEMANDE_A2` est du MÊME client mais sur `SITE_A1_S2` — même société, autre
 * site, donc REFUSÉE ; `DEMANDE_B1` est d'une autre société — invisible sous
 * ce contexte, donc REFUSÉE elle aussi, par le même chemin.
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

/**
 * Une demande JETABLE, posée directement au statut visé — par `INSERT`,
 * jamais par les transitions légales : le déclencheur `demande_cycle_de_vie`
 * (migration `20260913140000_demande_l2_06`) ne garde que l'`UPDATE`, et une
 * ligne neuve peut donc naître dans l'état qu'IN-42 doit confronter, sans
 * emprunter `DEMANDE_A1`/`DEMANDE_A2` (réservées à l'épreuve « site »). Même
 * SITE que `creerIntervention` ci-dessous (`SITE_A1_S1`) : seul le STATUT
 * doit faire la différence.
 *
 * **`"qualifiee"` (R8, 9DX-RETOUCHES-11)** — l'épreuve « même client, même
 * site » qualifiait `DEMANDE_A1`, une fixture PARTAGÉE (`global.ts`), pour la
 * faire passer dans l'état qu'`creerIntervention` exige (IN-42) : une
 * épreuve n'écrit jamais dans une fixture partagée. Une demande jetable déjà
 * `qualifiee` à la naissance rend cette écriture inutile.
 */
async function demandeJetable(
  statut: "nouvelle" | "qualifiee" | "transformee" | "close_sans_suite",
): Promise<string> {
  const id = uuidv7();
  if (statut === "close_sans_suite") {
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "demande" ("id", "societe_id", "source", "client_id", "site_id",
         "agence_id", "description", "statut", "motif_cloture", "depose_le",
         "compteur_accuse_le", "close_le", "modifie_le")
       VALUES ('${id}', '${SOCIETE_A}', 'appel', '${CLIENT_A1}', '${SITE_A1_S1}',
         '${AGENCE_A}', 'Épreuve IN-42 — ${statut}', '${statut}', 'doublon',
         now(), now(), now(), now())`,
    );
    return id;
  }
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "demande" ("id", "societe_id", "source", "client_id", "site_id",
       "agence_id", "description", "statut", "depose_le", "compteur_accuse_le",
       "modifie_le")
     VALUES ('${id}', '${SOCIETE_A}', 'appel', '${CLIENT_A1}', '${SITE_A1_S1}',
       '${AGENCE_A}', 'Épreuve IN-42 — ${statut}', '${statut}', now(), now(), now())`,
  );
  return id;
}

describe("créer une intervention DEPUIS une demande (68-DEMANDES-2)", () => {
  it("une demande du MÊME client et du MÊME site est acceptée, et le lien est écrit", async () => {
    const id = uuidv7();
    // R8 (9DX-RETOUCHES-11) — demande JETABLE, déjà `qualifiee` à la
    // naissance : aucune écriture sur la fixture partagée `DEMANDE_A1`.
    const demandeId = await demandeJetable("qualifiee");
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
          demande_id: demandeId,
          duree_min: null,
        },
        clientApp(),
      );
      expect(resultat.accepte).toBe(true);

      const [ligne] = await clientOwner().$queryRawUnsafe<
        Array<{ demande_id: string | null }>
      >(`SELECT "demande_id" FROM "intervention" WHERE "id" = '${id}'`);
      expect(ligne?.demande_id).toBe(demandeId);
    } finally {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "intervention" WHERE "id" = '${id}'`,
      );
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "demande" WHERE "id" = '${demandeId}'`,
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
        duree_min: null,
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
        duree_min: null,
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
          duree_min: null,
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

describe("IN-42 (D164) — seule une demande QUALIFIÉE devient une intervention", () => {
  it("une demande encore NOUVELLE (jamais qualifiée) est refusée, et rien n'est écrit", async () => {
    const demandeId = await demandeJetable("nouvelle");
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
          description: "Épreuve IN-42 — nouvelle",
          contact_id: null,
          reference_client: null,
          demande_id: demandeId,
          duree_min: null,
        },
        clientApp(),
      );
      expect(resultat).toEqual({
        accepte: false,
        cle: "intervention.refus.demande_non_qualifiee",
      });

      const [aucune] = await clientOwner().$queryRawUnsafe<
        Array<{ n: bigint }>
      >(`SELECT count(*) AS n FROM "intervention" WHERE "id" = '${id}'`);
      expect(Number(aucune?.n ?? 0)).toBe(0);
    } finally {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "demande" WHERE "id" = '${demandeId}'`,
      );
    }
  });

  it("une demande déjà TRANSFORMÉE est refusée, et rien n'est écrit", async () => {
    const demandeId = await demandeJetable("transformee");
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
          description: "Épreuve IN-42 — transformée",
          contact_id: null,
          reference_client: null,
          demande_id: demandeId,
          duree_min: null,
        },
        clientApp(),
      );
      expect(resultat).toEqual({
        accepte: false,
        cle: "intervention.refus.demande_deja_traitee",
      });

      const [aucune] = await clientOwner().$queryRawUnsafe<
        Array<{ n: bigint }>
      >(`SELECT count(*) AS n FROM "intervention" WHERE "id" = '${id}'`);
      expect(Number(aucune?.n ?? 0)).toBe(0);
    } finally {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "demande" WHERE "id" = '${demandeId}'`,
      );
    }
  });

  it("une demande CLOSE SANS SUITE est refusée, et rien n'est écrit", async () => {
    const demandeId = await demandeJetable("close_sans_suite");
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
          description: "Épreuve IN-42 — close sans suite",
          contact_id: null,
          reference_client: null,
          demande_id: demandeId,
          duree_min: null,
        },
        clientApp(),
      );
      expect(resultat).toEqual({
        accepte: false,
        cle: "intervention.refus.demande_deja_traitee",
      });

      const [aucune] = await clientOwner().$queryRawUnsafe<
        Array<{ n: bigint }>
      >(`SELECT count(*) AS n FROM "intervention" WHERE "id" = '${id}'`);
      expect(Number(aucune?.n ?? 0)).toBe(0);
    } finally {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "demande" WHERE "id" = '${demandeId}'`,
      );
    }
  });
});

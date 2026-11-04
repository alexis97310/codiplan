import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { avecContexteRls } from "@/lib/db/rls";
import { historiqueStatutDeLIntervention } from "@/lib/interventions/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  DEMANDE_A1,
  DEMANDE_B1,
  INTERVENTION_A1,
  INTERVENTION_B1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_INTERNE_B,
} from "./setup/fixtures";

/**
 * L'HISTORIQUE DES CHANGEMENTS DE STATUT, ÉPROUVÉ SUR LES VRAIES TABLES
 * (9J08A-HISTORIQUE-DES-ETATS).
 *
 * Forme « filiation » (D103), sur le modèle exact d'`intervention_pause`
 * (`tests/isolation/intervention-pause.test.ts`) : ce fichier confronte le
 * déclencheur et les politiques RLS aux vraies tables, jamais un mock.
 */

afterAll(fermerClients);

const SESSION_A = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const SESSION_B = {
  utilisateurId: UTILISATEUR_INTERNE_B,
  societeId: SOCIETE_B,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const jetables: { interventions: string[]; demandes: string[] } = {
  interventions: [],
  demandes: [],
};

afterEach(async () => {
  for (const id of jetables.interventions.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = '${id}'`,
    );
  }
  for (const id of jetables.demandes.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "demande" WHERE "id" = '${id}'`,
    );
  }
});

/** Une intervention jetable, dérivée d'une fixture de la société donnée. */
async function interventionJetable(depuis: string): Promise<string> {
  const id = uuidv7();
  jetables.interventions.push(id);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id","societe_id","client_id","site_id","agence_id",
       "type","statut","date_planifiee","duree_estimee_min","modifie_le")
     SELECT '${id}', "societe_id", "client_id", "site_id", "agence_id",
            'curatif', 'planifiee', DATE '2026-09-14', 60, now()
       FROM "intervention" WHERE "id" = '${depuis}'`,
  );
  return id;
}

/** Une demande jetable, dérivée d'une fixture de la société donnée. */
async function demandeJetable(depuis: string): Promise<string> {
  const id = uuidv7();
  jetables.demandes.push(id);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "demande" ("id","societe_id","source","client_id","site_id","agence_id",
       "description","depose_le","compteur_accuse_le","modifie_le")
     SELECT '${id}', "societe_id", 'appel', "client_id", "site_id", "agence_id",
            'Demande jetable', now(), now(), now()
       FROM "demande" WHERE "id" = '${depuis}'`,
  );
  return id;
}

describe("le TÉMOIN PRÉALABLE — RLS en vigueur sur les deux tables", () => {
  it.each(["intervention_statut_historique", "demande_statut_historique"])(
    "les deux drapeaux sont posés sur %s",
    async (table) => {
      const [etat] = await clientOwner().$queryRawUnsafe<
        Array<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>
      >(
        `SELECT "relrowsecurity", "relforcerowsecurity" FROM "pg_class"
        WHERE "relname" = $1 AND "relnamespace" = 'public'::regnamespace`,
        table,
      );
      expect(etat?.relrowsecurity).toBe(true);
      expect(etat?.relforcerowsecurity).toBe(true);
    },
  );
});

describe("intervention_statut_historique — une ligne par changement RÉEL", () => {
  it("la création pose une ligne, statut_avant NULL", async () => {
    const id = await interventionJetable(INTERVENTION_A1);
    const historique = await historiqueStatutDeLIntervention(
      SESSION_A,
      id,
      clientApp(),
    );
    expect(historique).toHaveLength(1);
    expect(historique?.[0]?.statutAvant).toBeNull();
    expect(historique?.[0]?.statutApres).toBe("planifiee");
  });

  it("un changement de statut ajoute exactement une ligne", async () => {
    const id = await interventionJetable(INTERVENTION_A1);
    await clientOwner().$executeRawUnsafe(
      `UPDATE "intervention" SET "statut" = 'affectee' WHERE "id" = '${id}'`,
    );
    const historique = await historiqueStatutDeLIntervention(
      SESSION_A,
      id,
      clientApp(),
    );
    expect(historique).toHaveLength(2);
    expect(historique?.[1]?.statutAvant).toBe("planifiee");
    expect(historique?.[1]?.statutApres).toBe("affectee");
  });

  it("un UPDATE qui pose LA MÊME valeur n'ajoute AUCUNE ligne", async () => {
    const id = await interventionJetable(INTERVENTION_A1);
    await clientOwner().$executeRawUnsafe(
      `UPDATE "intervention" SET "statut" = 'planifiee' WHERE "id" = '${id}'`,
    );
    const historique = await historiqueStatutDeLIntervention(
      SESSION_A,
      id,
      clientApp(),
    );
    expect(historique).toHaveLength(1);
  });

  it("un UPDATE d'une AUTRE colonne n'ajoute aucune ligne", async () => {
    const id = await interventionJetable(INTERVENTION_A1);
    await clientOwner().$executeRawUnsafe(
      `UPDATE "intervention" SET "duree_estimee_min" = 90 WHERE "id" = '${id}'`,
    );
    const historique = await historiqueStatutDeLIntervention(
      SESSION_A,
      id,
      clientApp(),
    );
    expect(historique).toHaveLength(1);
  });

  it("une société ne lit jamais l'historique d'une intervention d'une autre société", async () => {
    const idB = await interventionJetable(INTERVENTION_B1);
    const depuisA = await historiqueStatutDeLIntervention(
      SESSION_A,
      idB,
      clientApp(),
    );
    expect(depuisA).toBeNull();

    const depuisB = await historiqueStatutDeLIntervention(
      SESSION_B,
      idB,
      clientApp(),
    );
    expect(depuisB).toHaveLength(1);
  });

  it("le rôle applicatif ne peut ni modifier ni supprimer une ligne", async () => {
    const id = await interventionJetable(INTERVENTION_A1);
    await expect(
      avecContexteRls(
        clientApp(),
        { societeId: SOCIETE_A, role: Role.adv },
        (tx) =>
          tx.$executeRawUnsafe(
            `UPDATE "intervention_statut_historique" SET "statut_apres" = 'cloturee' WHERE "intervention_id" = '${id}'`,
          ),
      ),
    ).rejects.toThrow(/permission denied/);

    await expect(
      avecContexteRls(
        clientApp(),
        { societeId: SOCIETE_A, role: Role.adv },
        (tx) =>
          tx.$executeRawUnsafe(
            `DELETE FROM "intervention_statut_historique" WHERE "intervention_id" = '${id}'`,
          ),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("demande_statut_historique — même régime", () => {
  async function historiqueDeLaDemande(
    societeId: string,
    demandeId: string,
  ): Promise<
    ReadonlyArray<{ statut_avant: string | null; statut_apres: string }>
  > {
    return avecContexteRls(clientApp(), { societeId, role: Role.adv }, (tx) =>
      tx.$queryRawUnsafe(
        `SELECT "statut_avant", "statut_apres" FROM "demande_statut_historique"
            WHERE "demande_id" = '${demandeId}' ORDER BY "change_le"`,
      ),
    );
  }

  it("la création pose une ligne, un changement en ajoute une seconde", async () => {
    const id = await demandeJetable(DEMANDE_A1);
    await clientOwner().$executeRawUnsafe(
      `UPDATE "demande" SET "statut" = 'qualifiee' WHERE "id" = '${id}'`,
    );
    const historique = await historiqueDeLaDemande(SOCIETE_A, id);
    expect(historique).toHaveLength(2);
    expect(historique[0]?.statut_avant).toBeNull();
    expect(historique[0]?.statut_apres).toBe("nouvelle");
    expect(historique[1]?.statut_avant).toBe("nouvelle");
    expect(historique[1]?.statut_apres).toBe("qualifiee");
  });

  it("un UPDATE sans changement réel n'ajoute aucune ligne", async () => {
    const id = await demandeJetable(DEMANDE_A1);
    await clientOwner().$executeRawUnsafe(
      `UPDATE "demande" SET "statut" = 'nouvelle' WHERE "id" = '${id}'`,
    );
    const historique = await historiqueDeLaDemande(SOCIETE_A, id);
    expect(historique).toHaveLength(1);
  });

  it("une société ne lit jamais l'historique d'une demande d'une autre société", async () => {
    const idB = await demandeJetable(DEMANDE_B1);
    const depuisA = await historiqueDeLaDemande(SOCIETE_A, idB);
    expect(depuisA).toHaveLength(0);
    const depuisB = await historiqueDeLaDemande(SOCIETE_B, idB);
    expect(depuisB).toHaveLength(1);
  });

  it("le rôle applicatif ne peut ni modifier ni supprimer une ligne", async () => {
    const id = await demandeJetable(DEMANDE_A1);
    await expect(
      avecContexteRls(
        clientApp(),
        { societeId: SOCIETE_A, role: Role.adv },
        (tx) =>
          tx.$executeRawUnsafe(
            `UPDATE "demande_statut_historique" SET "statut_apres" = 'transformee' WHERE "demande_id" = '${id}'`,
          ),
      ),
    ).rejects.toThrow(/permission denied/);

    await expect(
      avecContexteRls(
        clientApp(),
        { societeId: SOCIETE_A, role: Role.adv },
        (tx) =>
          tx.$executeRawUnsafe(
            `DELETE FROM "demande_statut_historique" WHERE "demande_id" = '${id}'`,
          ),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

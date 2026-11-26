import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { deposerDemande } from "@/lib/demandes/depot";
import { creerIntervention } from "@/lib/interventions/depot";
import { engendrerJetonQr } from "@/lib/machines/qr";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  MODELE_A,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * 9L45-EPREUVES-CAPTURES-9I8C-9I8F1 — le trou nommé dans la passation de
 * 9I8F1-REPRISE-9I8F (« Ce que je n'ai PAS fait ») : `resoudreEtatMachineDuFormulaire`
 * (`lib/machines/garde-statut.ts`) était éprouvée directement contre la vraie
 * base, mais jamais `deposerDemande` NI `creerIntervention` de bout en bout —
 * le risque résiduel nommé était le CÂBLAGE (l'ordre des appels avant/après
 * la création), relu à la main mais jamais confronté à une vraie écriture.
 *
 * Machine JETABLE (statut `remplacee` posé à la création, jamais par
 * `changerStatutMachine`, qui le refuserait) sur SITE_A1_S1/CLIENT_A1 — le
 * site et le client déjà réutilisés par `tests/isolation/demande.test.ts` et
 * `tests/isolation/intervention-machines.test.ts`, jamais `MACHINE_A1`, pour
 * ne rien muter d'une fixture partagée relue par d'autres fichiers.
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

async function surUneMachineSortieJetable(
  travail: (machineId: string) => Promise<void>,
): Promise<void> {
  const machineId = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "machine" ("id", "societe_id", "modele_id", "client_id", "site_id",
       "qr_token", "numero_serie", "statut", "modifie_le")
     VALUES ('${machineId}', '${SOCIETE_A}', '${MODELE_A}', '${CLIENT_A1}', '${SITE_A1_S1}',
       '${engendrerJetonQr()}', '9L45-SORTIE-${machineId.slice(0, 8)}', 'remplacee', now())`,
  );
  try {
    await travail(machineId);
  } finally {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention_machine" WHERE "machine_id" = '${machineId}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" IN (
         SELECT "intervention_id" FROM "intervention_machine" WHERE "machine_id" = '${machineId}'
       )`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "demande" WHERE "machine_id" = '${machineId}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "machine" WHERE "id" = '${machineId}'`,
    );
  }
}

describe("deposerDemande — une machine SORTIE DU PARC, un « en_service » forgé", () => {
  it("la demande est créée ; la machine reste `remplacee`, jamais réactivée", async () => {
    await surUneMachineSortieJetable(async (machineId) => {
      const id = uuidv7();
      const pose = await deposerDemande(
        SESSION,
        {
          id,
          source: "appel",
          client_id: CLIENT_A1,
          site_id: SITE_A1_S1,
          machine_id: machineId,
          contact_id: null,
          description: "9L45 — demande sur machine sortie du parc",
          urgence: "p3",
          machine_arretee: false,
          etat_machine: "en_service",
          date_souhaitee: null,
        },
        clientApp(),
      );
      expect(pose.accepte).toBe(true);
      if (!pose.accepte) return;
      expect(pose.fiche.machine_id).toBe(machineId);

      const [machine] = await clientOwner().$queryRawUnsafe<
        Array<{ statut: string }>
      >(`SELECT "statut" FROM "machine" WHERE "id" = $1::uuid`, machineId);
      expect(machine?.statut).toBe("remplacee");

      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "demande" WHERE "id" = '${id}'`,
      );
    });
  });
});

describe("creerIntervention — une machine SORTIE DU PARC, un « en_service » forgé", () => {
  it("l'intervention est créée, la machine rattachée ; la machine reste `remplacee`, jamais réactivée", async () => {
    await surUneMachineSortieJetable(async (machineId) => {
      const id = uuidv7();
      const resultat = await creerIntervention(
        SESSION,
        {
          id,
          client_id: CLIENT_A1,
          site_id: SITE_A1_S1,
          machine_ids: [machineId],
          type: "preventif_contrat",
          priorite: "p3",
          mode_valorisation: "temps_passe",
          description: "9L45 — intervention sur machine sortie du parc",
          contact_id: null,
          reference_client: null,
          demande_id: null,
          duree_min: null,
          etat_machine: "en_service",
        },
        clientApp(),
      );
      expect(resultat.accepte).toBe(true);
      if (!resultat.accepte) return;
      expect(resultat.fiche.machines.map((m) => m.machine_id)).toEqual([
        machineId,
      ]);

      const [machine] = await clientOwner().$queryRawUnsafe<
        Array<{ statut: string }>
      >(`SELECT "statut" FROM "machine" WHERE "id" = $1::uuid`, machineId);
      expect(machine?.statut).toBe("remplacee");

      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "intervention" WHERE "id" = '${id}'`,
      );
    });
  });
});

import { afterAll, describe, expect, it } from "vitest";

import { avecPortail, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_B1,
  MACHINE_A1,
  MACHINE_A2,
  SITE_A1_S1,
  SOCIETE_A,
  SOCIETE_B,
} from "./setup/fixtures";

/**
 * Accès portail (L0-05 obligatoire, D10).
 *
 * Un compte portail ne voit que les données de SON client, et seulement ses
 * sites lorsqu'un périmètre est défini. La table `machine` est le porteur de
 * test ; les vraies tables métier suivront le même contrat aux lots 1 et 2.
 */
function machinesVisibles(
  societeId: string,
  clientId: string,
  perimetreSites?: readonly string[],
) {
  return avecPortail({ societeId, clientId, perimetreSites }, (tx) =>
    tx.$queryRawUnsafe<Array<{ id: string; client_id: string }>>(
      `SELECT "id", "client_id" FROM "machine" ORDER BY "id"`,
    ),
  );
}

describe("cloisonnement portail", () => {
  afterAll(fermerClients);

  it("un compte portail ne voit que les machines de son client", async () => {
    // Le client A1 possède A1 et A2 ; A2 (autre client de la même société) est
    // exclu. Ici A1 et A2 appartiennent au même client A1 : contrôle que seules
    // les machines du client rattaché remontent (aucune d'un autre client).
    const machines = await machinesVisibles(SOCIETE_A, CLIENT_A1);
    expect(machines.every((m) => m.client_id === CLIENT_A1)).toBe(true);
    const ids = machines.map((m) => m.id);
    expect(ids).toEqual([MACHINE_A1, MACHINE_A2]);
  });

  it("un compte portail respecte son périmètre de sites", async () => {
    // Périmètre restreint au site S1 : seule la machine de ce site est visible,
    // celle du site S2 (même client) est masquée.
    const machines = await machinesVisibles(SOCIETE_A, CLIENT_A1, [SITE_A1_S1]);
    const ids = machines.map((m) => m.id);
    expect(ids).toEqual([MACHINE_A1]);
    expect(ids).not.toContain(MACHINE_A2);
  });

  it("un compte portail d'une autre société ne voit aucune machine de la société A", async () => {
    // Le portail du client B1 (société B) ne voit rien du parc de la société A.
    const machines = await machinesVisibles(SOCIETE_B, CLIENT_B1);
    expect(machines.every((m) => m.client_id === CLIENT_B1)).toBe(true);
    expect(machines.map((m) => m.id)).not.toContain(MACHINE_A1);
  });
});

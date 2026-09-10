import { afterAll, describe, expect, it } from "vitest";

import { avecPortail, fermerClients } from "./setup/db";
import { exigence } from "./setup/contrat";
import {
  CLIENT_A1,
  CLIENT_A2,
  CLIENT_B1,
  MACHINE_A1,
  MACHINE_A2,
  MACHINE_A3,
  SITE_A1_S1,
  SITE_A1_S2,
  SOCIETE_A,
  SOCIETE_B,
} from "./setup/fixtures";

/**
 * Accès portail (L0-05 obligatoire, D10).
 *
 * Un compte portail ne voit que les données de SON client, et seulement ses
 * sites lorsqu'un périmètre est défini. Les trois tables du parc sont
 * éprouvées — `client`, `site` et `machine` —, et non la seule `machine` :
 * chacune porte sa politique, et une politique qu'aucun scénario ne traverse
 * n'est éprouvée par personne.
 *
 * **Les titres passent par `exigence()`** (ticket R0-a, écart É14) : le gardien
 * `tests/unit/db/contrat-isolation.test.ts` les compte, et refuse que le
 * décompte baisse. Les vraies tables des lots 1 et 2 devront honorer ce même
 * contrat.
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

  it(
    exigence(
      "portail_autre_client",
      "un compte portail ne voit que les machines de son client",
    ),
    async () => {
      // Le client A1 possède A1 et A2 ; A2 (autre client de la même société) est
      // exclu. Ici A1 et A2 appartiennent au même client A1 : contrôle que seules
      // les machines du client rattaché remontent (aucune d'un autre client).
      const machines = await machinesVisibles(SOCIETE_A, CLIENT_A1);
      expect(machines.every((m) => m.client_id === CLIENT_A1)).toBe(true);
      const ids = machines.map((m) => m.id);
      // TROIS depuis le lot 8 : `MACHINE_A3` est une machine du MÊME client
      // sur le site S2 (D93). Le filtre éprouvé ici est celui du CLIENT, que le
      // périmètre de sites ne remplace pas — le compte n'est pas restreint.
      expect(ids.sort()).toEqual([MACHINE_A1, MACHINE_A2, MACHINE_A3].sort());
    },
  );

  it(
    exigence(
      "portail_autre_client",
      "un compte portail ne voit pas l'autre CLIENT de sa propre société",
    ),
    async () => {
      // La table `client` elle-même, et le cas que le scénario précédent ne peut
      // pas atteindre : A1 et A2 sont deux clients de LA MÊME société. Le filtre
      // société les laisserait tous deux visibles ; seul `app.client_id` les
      // sépare. C'est la politique de `client` — jusqu'ici traversée par aucun
      // scénario portail — qui est éprouvée ici.
      const clients = await avecPortail(
        { societeId: SOCIETE_A, clientId: CLIENT_A1 },
        (tx) =>
          tx.$queryRawUnsafe<Array<{ id: string }>>(
            `SELECT "id" FROM "client" ORDER BY "id"`,
          ),
      );
      expect(clients.map((c) => c.id)).toEqual([CLIENT_A1]);
      expect(clients.map((c) => c.id)).not.toContain(CLIENT_A2);
    },
  );

  it(
    exigence(
      "perimetre_sites",
      "un compte portail respecte son périmètre de sites",
    ),
    async () => {
      // Périmètre restreint au site S1 : seule la machine de ce site est visible,
      // celle du site S2 (même client) est masquée.
      const machines = await machinesVisibles(SOCIETE_A, CLIENT_A1, [
        SITE_A1_S1,
      ]);
      const ids = machines.map((m) => m.id);
      expect(ids).toEqual([MACHINE_A1]);
      expect(ids).not.toContain(MACHINE_A2);
    },
  );

  it(
    exigence(
      "perimetre_sites",
      "un compte portail ne voit pas les SITES hors de son périmètre",
    ),
    async () => {
      // La table `site`, et le périmètre appliqué à elle-même plutôt qu'aux
      // machines qu'elle porte : S1 et S2 appartiennent au même client, seul le
      // périmètre les sépare.
      const sites = await avecPortail(
        {
          societeId: SOCIETE_A,
          clientId: CLIENT_A1,
          perimetreSites: [SITE_A1_S1],
        },
        (tx) =>
          tx.$queryRawUnsafe<Array<{ id: string }>>(
            `SELECT "id" FROM "site" ORDER BY "id"`,
          ),
      );
      expect(sites.map((s) => s.id)).toEqual([SITE_A1_S1]);
      expect(sites.map((s) => s.id)).not.toContain(SITE_A1_S2);
    },
  );

  it(
    exigence(
      "portail_autre_client",
      "un compte portail d'une autre société ne voit aucune machine de la société A",
    ),
    async () => {
      // Le portail du client B1 (société B) ne voit rien du parc de la société A.
      const machines = await machinesVisibles(SOCIETE_B, CLIENT_B1);
      expect(machines.every((m) => m.client_id === CLIENT_B1)).toBe(true);
      expect(machines.map((m) => m.id)).not.toContain(MACHINE_A1);
    },
  );

  it(
    exigence(
      "portail_autre_client",
      "un compte portail ne peut pas ÉCRIRE chez un autre client (WITH CHECK)",
    ),
    async () => {
      // Lecture, écriture et suppression : L0-05 les exige toutes les trois, et
      // le portail n'était éprouvé qu'en lecture. `WITH CHECK` porte la même
      // clause que `USING` — c'est ici qu'on le vérifie plutôt qu'on le suppose.
      await expect(
        avecPortail({ societeId: SOCIETE_A, clientId: CLIENT_A1 }, (tx) =>
          tx.$executeRawUnsafe(
            `INSERT INTO "site" ("id", "societe_id", "client_id", "libelle")
             VALUES ('aaaaaaaa-0000-7000-8000-0000000055ff', $1::uuid, $2::uuid, 'Site pirate')`,
            SOCIETE_A,
            CLIENT_A2,
          ),
        ),
      ).rejects.toThrow(/row-level security|violates/i);
    },
  );
});

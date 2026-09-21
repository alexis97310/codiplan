import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { creerIntervention } from "@/lib/interventions/depot";
import { schemaCreation } from "@/lib/interventions/saisie";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * RG-PLA-08 À LA CRÉATION — LE SERVEUR REFUSE CE QUE L'ÉCRAN NE PROPOSE PLUS
 * (PLANNING-1, 22/09/2026).
 *
 * ## Ce que ce fichier mesure, et que rien d'autre ne mesurait
 *
 * Le lot SEMIS-2 (#269, 21/09/2026) a retiré le site d'un client inactif de
 * la liste de `/interventions/nouvelle`, et
 * `tests/e2e/site-client-inactif-masque-a-la-creation.spec.ts` le garde. Mais
 * **la liste d'un écran n'est pas une règle** : `creerIntervention`
 * (`lib/interventions/depot.ts`) acceptait toujours un `site_id` posté
 * directement sur `/api/interventions/creer` — et l'intervention ainsi née
 * n'apparaissait ensuite NULLE PART, ni sur le planning ni dans le registre
 * par défaut (RG-PLA-08, D129), sans qu'aucun message ne le dise. *Deux
 * chemins qui écrivent la même colonne et ne se soumettent pas au même
 * contrôle ne tiennent pas la même règle* (§9, 01/09) — c'est la faute déjà
 * réparée pour RG-PLA-04 entre l'affectation et le déplacement, et pour
 * l'ouverture entre le déplacement et la création (R2-19).
 *
 * `tests/isolation/client-inactif-masque.test.ts` prouve que le planning et
 * le registre TAISENT la ligne ; ce fichier prouve que le dépôt REFUSE de la
 * faire naître, avec un motif nommé — jamais « lieu inconnu », qui accuserait
 * le périmètre alors que le lieu existe et se voit sur la fiche du client.
 *
 * ## Le témoin
 *
 * La même saisie sur le site d'un client ACTIF (`SITE_A1_S1`) est acceptée :
 * sans lui, un refus venu d'ailleurs — agence sans calendrier, machine
 * invalide — passerait pour le refus qu'on mesure (§9, 30/08).
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

const CLIENT_INACTIF = "aaaaaaaa-0000-7000-8000-00000000af11";
const SITE_DU_CLIENT_INACTIF = "aaaaaaaa-0000-7000-8000-00000000af12";

/** Les identifiants d'intervention que ce fichier a pu faire naître. */
const nees: string[] = [];

beforeAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "client" ("id", "societe_id", "code_externe", "raison_sociale", "actif")
     VALUES ($1::uuid, $2::uuid, 'C-INACTIF-CREA', 'Client inactif de la création', false)
     ON CONFLICT ("id") DO NOTHING`,
    CLIENT_INACTIF,
    SOCIETE_A,
  );
  // RATTACHÉ à l'agence A, comme `SITE_A1_S1` : un site sans rattachement
  // serait refusé pour une AUTRE raison (`lieu_sans_rattachement`), et le
  // scénario mesurerait ce refus-là à la place du sien.
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "site" ("id", "societe_id", "client_id", "agence_id", "libelle")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'Site du client inactif — création')
     ON CONFLICT ("id") DO NOTHING`,
    SITE_DU_CLIENT_INACTIF,
    SOCIETE_A,
    CLIENT_INACTIF,
    AGENCE_A,
  );
});

afterAll(async () => {
  for (const id of nees) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
      id,
    );
  }
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "site" WHERE "id" = $1::uuid`,
    SITE_DU_CLIENT_INACTIF,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "client" WHERE "id" = $1::uuid`,
    CLIENT_INACTIF,
  );
});

/** Une saisie SANS date ni technicien : le seul critère en jeu est le client. */
function saisie(clientId: string, siteId: string) {
  const id = uuidv7();
  nees.push(id);
  return schemaCreation.parse({
    id,
    client_id: clientId,
    site_id: siteId,
    type: "curatif",
  });
}

describe("RG-PLA-08 (D129) — créer une intervention chez un client inactif", () => {
  it("TÉMOIN — la même saisie chez un client ACTIF est acceptée", async () => {
    const resultat = await creerIntervention(
      SESSION,
      saisie(CLIENT_A1, SITE_A1_S1),
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
  });

  it("est REFUSÉE par le dépôt, avec un motif qui nomme le client inactif", async () => {
    const resultat = await creerIntervention(
      SESSION,
      saisie(CLIENT_INACTIF, SITE_DU_CLIENT_INACTIF),
      clientApp(),
    );
    expect(resultat).toEqual({
      accepte: false,
      cle: "intervention.refus.client_inactif",
    });
  });

  it("et rien n'est écrit : aucune intervention invisible ne naît en base", async () => {
    const lignes = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*)::bigint AS "n" FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_INACTIF,
    );
    expect(Number(lignes[0]?.n ?? -1)).toBe(0);
  });
});

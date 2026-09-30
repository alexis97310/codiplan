import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { declarerAbsence } from "@/lib/absences/depot";
import { schemaCreationAbsence } from "@/lib/absences/saisie";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  AGENCE_B,
  CLIENT_A1,
  CLIENT_B1,
  SITE_A1_S1,
  SITE_B1_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_INTERNE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * LA TRACE DE DÉPLANIFICATION NE TRAVERSE JAMAIS LES SOCIÉTÉS
 * (9CC-DEPLANIFIEE-1) — témoins de `tests/isolation/absence.test.ts:142-227`,
 * appliqués cette fois à la POSE elle-même plutôt qu'à la seule lecture.
 *
 * ## Ce que ce fichier mesure, et que `absence.test.ts` ne mesure pas
 *
 * `interventionsPoseesSurLaPeriode` lit `intervention` sous le contexte
 * cloisonné, avec le MÊME `technicien_id` que celui qu'une autre société
 * pourrait avoir attribué à une identité par ailleurs distincte (I10 : les
 * identités ne sont pas cloisonnées par société, seules les tables métier le
 * sont). *Un critère qui ne comparait QUE `technicien_id`, sans la politique
 * de société en dessous, dépendrait de la valeur du champ — pas de la
 * société* — et c'est exactement le trou qu'une politique RLS absente ou
 * mal formée laisserait passer sans qu'aucun test qui ne compare qu'une seule
 * société ne le voie.
 *
 * Deux interventions PORTANT LE MÊME `technicien_id`, une par société,
 * posées le même jour : la pose d'un blocage sous SOCIETE_A ne doit déplanifier
 * QUE celle de A. Le TÉMOIN — la même pose, sous SOCIETE_B cette fois — montre
 * que la ligne de B était bien atteignable par le même mécanisme, pour la
 * bonne raison : sans lui, une politique qui ne verrait JAMAIS rien
 * passerait ce scénario aussi silencieusement qu'une politique juste.
 */

afterAll(fermerClients);

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien];

/** Un lundi de la plage 08:00–12:00 du calendrier des agences A et B. */
const LUNDI = new Date("2026-09-14T00:00:00.000Z");

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

let interventionA = "";
let interventionB = "";

async function poserIntervention(
  societeId: string,
  clientId: string,
  siteId: string,
  agenceId: string,
): Promise<string> {
  const id = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "technicien_id", "type", "statut", "date_planifiee",
       "duree_estimee_min", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
             'curatif', 'planifiee', $7::date, 60, now())`,
    id,
    societeId,
    clientId,
    siteId,
    agenceId,
    TECHNICIEN,
    LUNDI,
  );
  return id;
}

async function lireTrace(
  id: string,
): Promise<{ date_planifiee: Date | null; deplanifiee_date: Date | null }> {
  const [ligne] = await clientOwner().$queryRawUnsafe<
    Array<{ date_planifiee: Date | null; deplanifiee_date: Date | null }>
  >(
    `SELECT "date_planifiee", "deplanifiee_date" FROM "intervention" WHERE "id" = $1::uuid`,
    id,
  );
  return ligne;
}

beforeEach(async () => {
  interventionA = await poserIntervention(
    SOCIETE_A,
    CLIENT_A1,
    SITE_A1_S1,
    AGENCE_A,
  );
  interventionB = await poserIntervention(
    SOCIETE_B,
    CLIENT_B1,
    SITE_B1_S1,
    AGENCE_B,
  );
});

afterEach(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "absence" WHERE "utilisateur_id" = $1::uuid`,
    TECHNICIEN,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "id" IN ($1::uuid, $2::uuid)`,
    interventionA,
    interventionB,
  );
});

describe("la pose d'un blocage ne déplanifie que SA société (9CC-DEPLANIFIEE-1)", () => {
  it("une pose sous SOCIETE_A ne touche PAS la ligne de SOCIETE_B, même technicien_id", async () => {
    const blocage = await declarerAbsence(
      SESSION_A,
      schemaCreationAbsence.parse({
        utilisateur_id: TECHNICIEN,
        du: LUNDI,
        au: LUNDI,
      }),
      clientApp(),
    );
    expect(blocage.accepte).toBe(true);
    expect(blocage.accepte && blocage.fiche.deplanifiees).toEqual([
      interventionA,
    ]);

    const ligneA = await lireTrace(interventionA);
    expect(ligneA.date_planifiee).toBeNull();
    expect(ligneA.deplanifiee_date).toEqual(LUNDI);

    const ligneB = await lireTrace(interventionB);
    expect(ligneB.date_planifiee).toEqual(LUNDI);
    expect(ligneB.deplanifiee_date).toBeNull();

    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "absence" WHERE "id" = $1::uuid`,
      blocage.accepte ? blocage.fiche.absence.id : "",
    );
  });

  it("TÉMOIN — la même pose, sous SOCIETE_B, déplanifie SA ligne à elle", async () => {
    // *Sans ce témoin, une politique qui ne verrait jamais rien passerait le
    // scénario précédent aussi silencieusement qu'une politique juste* (§9,
    // 07/09) : il faut montrer que la ligne de B était bien atteignable par
    // le même mécanisme.
    //
    // `absence_technicien_fkey` exige que TECHNICIEN soit rattaché à
    // SOCIETE_B par `utilisateur_societe` (I10 : les identités ne sont pas
    // cloisonnées, seul le RATTACHEMENT l'est) — posé ici et retiré à la fin,
    // même geste que `poserUnTechnicien` dans `absence.test.ts`.
    const rattachementId = uuidv7();
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "utilisateur_societe" ("id", "utilisateur_id", "societe_id", "role")
       VALUES ($1::uuid, $2::uuid, $3::uuid, 'technicien')`,
      rattachementId,
      TECHNICIEN,
      SOCIETE_B,
    );
    try {
      const blocage = await declarerAbsence(
        SESSION_B,
        schemaCreationAbsence.parse({
          utilisateur_id: TECHNICIEN,
          du: LUNDI,
          au: LUNDI,
        }),
        clientApp(),
      );
      expect(blocage.accepte).toBe(true);
      expect(blocage.accepte && blocage.fiche.deplanifiees).toEqual([
        interventionB,
      ]);

      const ligneB = await lireTrace(interventionB);
      expect(ligneB.date_planifiee).toBeNull();
      expect(ligneB.deplanifiee_date).toEqual(LUNDI);

      const ligneA = await lireTrace(interventionA);
      expect(ligneA.date_planifiee).toEqual(LUNDI);
      expect(ligneA.deplanifiee_date).toBeNull();

      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "absence" WHERE "id" = $1::uuid`,
        blocage.accepte ? blocage.fiche.absence.id : "",
      );
    } finally {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "utilisateur_societe" WHERE "id" = $1::uuid`,
        rattachementId,
      );
    }
  });
});

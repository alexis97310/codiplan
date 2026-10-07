import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { listerInterventions } from "@/lib/interventions/depot";
import { schemaRechercheInterventions } from "@/lib/interventions/saisie";

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
} from "./setup/fixtures";

afterAll(fermerClients);

/**
 * LE SUIVI « SOUS GARANTIE, OUVERTES » (TP-UX3-1-REGISTRE-2, choix du pilote
 * C1 du 07/10/2026) — `type = garantie`, `statut` hors
 * `STATUTS_INTERVENTION_FERMES`, éprouvé sur la VRAIE table plutôt que pur :
 * le cloisonnement (I1) ne se mesure que là.
 *
 * Deux fiches DÉDIÉES, une par société, pour que ce fichier ne dépende
 * jamais d'une fiche `garantie` posée par un autre scénario du même run
 * (dont le statut pourrait changer d'ordre d'exécution). Datées loin dans le
 * futur, et non `NULL` — une `date_planifiee` nulle range la fiche dans la
 * FILE D'ATTENTE, que d'autres scénarios du harnais dénombrent sur toute la
 * société.
 */
const GARANTIE_OUVERTE_A = "aaaaaaaa-0000-7000-8000-00000000af09";
const GARANTIE_FERMEE_A = "aaaaaaaa-0000-7000-8000-00000000af0a";
const GARANTIE_OUVERTE_B = "bbbbbbbb-0000-7000-8000-00000000af09";
const DATE_HORS_DE_PORTEE = "2099-02-01";

const INTERNE_A = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const INTERNE_B = {
  ...INTERNE_A,
  utilisateurId: UTILISATEUR_INTERNE_B,
  societeId: SOCIETE_B,
};

async function poserFiche(
  id: string,
  societeId: string,
  clientId: string,
  siteId: string,
  agenceId: string,
  statut: "a_planifier" | "cloturee",
): Promise<void> {
  // `cloturee` exige `statut_facturation` non nul
  // (`intervention_cloture_a_son_statut_facturation`) ; `a_planifier` ne
  // porte aucune autre contrainte (RG-TAR, D120) — la fiche OUVERTE n'a donc
  // besoin que de son type et de son statut.
  const statutFacturation = statut === "cloturee" ? "'non_facturable'" : "NULL";
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention"
       ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "technicien_id", "date_planifiee", "statut_facturation", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'garantie', '${statut}', NULL, $6::date, ${statutFacturation}, now())
     ON CONFLICT ("id") DO NOTHING`,
    id,
    societeId,
    clientId,
    siteId,
    agenceId,
    DATE_HORS_DE_PORTEE,
  );
}

beforeAll(async () => {
  await poserFiche(
    GARANTIE_OUVERTE_A,
    SOCIETE_A,
    CLIENT_A1,
    SITE_A1_S1,
    AGENCE_A,
    "a_planifier",
  );
  await poserFiche(
    GARANTIE_FERMEE_A,
    SOCIETE_A,
    CLIENT_A1,
    SITE_A1_S1,
    AGENCE_A,
    "cloturee",
  );
  await poserFiche(
    GARANTIE_OUVERTE_B,
    SOCIETE_B,
    CLIENT_B1,
    SITE_B1_S1,
    AGENCE_B,
    "a_planifier",
  );
});

afterAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "id" IN ($1::uuid, $2::uuid, $3::uuid)`,
    GARANTIE_OUVERTE_A,
    GARANTIE_FERMEE_A,
    GARANTIE_OUVERTE_B,
  );
});

describe("le suivi « Sous garantie, ouvertes » (TP-UX3-1-REGISTRE-2)", () => {
  it("retrouve la garantie OUVERTE, pas la garantie FERMÉE, sur la société active", async () => {
    const criteres = schemaRechercheInterventions.parse({
      suivi: "garantie_ouvertes",
    });
    const ids = (
      await listerInterventions(INTERNE_A, criteres, clientApp())
    ).map((l) => l.id);
    expect(ids).toContain(GARANTIE_OUVERTE_A);
    expect(ids).not.toContain(GARANTIE_FERMEE_A);
  });

  it("ne fait fuir aucune garantie ouverte d'une AUTRE société (I1)", async () => {
    const criteres = schemaRechercheInterventions.parse({
      suivi: "garantie_ouvertes",
    });
    const idsVusDeA = (
      await listerInterventions(INTERNE_A, criteres, clientApp())
    ).map((l) => l.id);
    expect(idsVusDeA).not.toContain(GARANTIE_OUVERTE_B);

    const idsVusDeB = (
      await listerInterventions(INTERNE_B, criteres, clientApp())
    ).map((l) => l.id);
    expect(idsVusDeB).toContain(GARANTIE_OUVERTE_B);
    expect(idsVusDeB).not.toContain(GARANTIE_OUVERTE_A);
  });
});

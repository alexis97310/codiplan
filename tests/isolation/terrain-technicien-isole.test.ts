import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import {
  interventionsEnRetard,
  listerPlanning,
} from "@/lib/interventions/depot";

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
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * 9F2B-TERRAIN-JOURS-EPREUVES, point 1 — « Ma journée » SOUS UN TECHNICIEN.
 *
 * `interventionsEnRetard` (PG-C1a, lu par `app/(mobile)/terrain/page.tsx`) et
 * `listerPlanning` restreints par `restrictionParPersonne` — jamais éprouvés
 * sous un rôle `technicien` jusqu'ici : `tests/isolation/planning-file-a-
 * traiter.test.ts` n'arme qu'un rôle de BUREAU (`Role.adv`, accès « complet »,
 * aucune restriction). Un technicien a un accès « restreint »
 * (`consulter_planning`, §5.2) — c'est CE chemin qui manquait une épreuve.
 *
 * Chaque scénario forge ses propres lignes (préfixe `9F2B-` dans la
 * description), les retire dans un `afterEach` — jamais une fixture
 * partagée.
 */

afterAll(fermerClients);

const TECHNICIEN_A = UTILISATEUR_PAR_ROLE.technicien;
/** Un AUTRE technicien de la société A — aucune contrainte de clé étrangère
 * ne porte sur `technicien_id` (CLAUDE.md §6, marque `(prévu)` : la table
 * `technicien` n'existe pas encore), un second UUID suffit à le désigner. */
const AUTRE_TECHNICIEN_A = uuidv7();

const SESSION_TECHNICIEN_A = {
  utilisateurId: TECHNICIEN_A,
  societeId: SOCIETE_A,
  role: Role.technicien,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const posees: { readonly id: string; readonly societeId: string }[] = [];

async function creer(champs: {
  readonly societeId: string;
  readonly clientId: string;
  readonly siteId: string;
  readonly agenceId: string;
  readonly statut: string;
  readonly datePlanifiee: string | null;
  readonly technicienId: string | null;
}): Promise<string> {
  const id = uuidv7();
  posees.push({ id, societeId: champs.societeId });
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "type", "statut", "priorite", "date_planifiee",
       "duree_estimee_min", "technicien_id", "description", "cree_le",
       "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
             $6::"StatutIntervention", 'p3', $7::date, 60, $8::uuid,
             '9F2B — intervention forgée par l''épreuve d''isolation',
             now(), now())`,
    id,
    champs.societeId,
    champs.clientId,
    champs.siteId,
    champs.agenceId,
    champs.statut,
    champs.datePlanifiee,
    champs.technicienId,
  );
  return id;
}

afterEach(async () => {
  for (const { id, societeId } of posees.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = $1::uuid AND "societe_id" = $2::uuid`,
      id,
      societeId,
    );
  }
});

const HIER = "2026-09-28";
const AUJOURDHUI = new Date("2026-09-29T00:00:00.000Z");
const DEMAIN = "2026-09-30";

describe("interventionsEnRetard sous un technicien — PG-C1a", () => {
  it("rend le retard du technicien lui-même, masque celui d'un autre technicien de A et celui de la société B", async () => {
    const retardPropre = await creer({
      societeId: SOCIETE_A,
      clientId: CLIENT_A1,
      siteId: SITE_A1_S1,
      agenceId: AGENCE_A,
      statut: "affectee",
      datePlanifiee: HIER,
      technicienId: TECHNICIEN_A,
    });
    const retardAutreTechnicienA = await creer({
      societeId: SOCIETE_A,
      clientId: CLIENT_A1,
      siteId: SITE_A1_S1,
      agenceId: AGENCE_A,
      statut: "affectee",
      datePlanifiee: HIER,
      technicienId: AUTRE_TECHNICIEN_A,
    });
    const retardSocieteB = await creer({
      societeId: SOCIETE_B,
      clientId: CLIENT_B1,
      siteId: SITE_B1_S1,
      agenceId: AGENCE_B,
      statut: "affectee",
      datePlanifiee: HIER,
      // Même identité que la session — seule la société doit l'écarter.
      technicienId: TECHNICIEN_A,
    });

    const ids = (
      await interventionsEnRetard(SESSION_TECHNICIEN_A, AUJOURDHUI, clientApp())
    ).map((l) => l.id);

    expect(ids).toContain(retardPropre);
    expect(ids).not.toContain(retardAutreTechnicienA);
    expect(ids).not.toContain(retardSocieteB);
  });
});

describe("listerPlanning sous un technicien — paramètres de /terrain (D141 14C)", () => {
  const DU = AUJOURDHUI;
  const AU = new Date("2026-10-07T00:00:00.000Z");

  it("rend la ligne affectée du technicien lui-même, masque celle d'un autre technicien de A et celle de la société B", async () => {
    const proprePropre = await creer({
      societeId: SOCIETE_A,
      clientId: CLIENT_A1,
      siteId: SITE_A1_S1,
      agenceId: AGENCE_A,
      statut: "affectee",
      datePlanifiee: DEMAIN,
      technicienId: TECHNICIEN_A,
    });
    const autreTechnicienA = await creer({
      societeId: SOCIETE_A,
      clientId: CLIENT_A1,
      siteId: SITE_A1_S1,
      agenceId: AGENCE_A,
      statut: "affectee",
      datePlanifiee: DEMAIN,
      technicienId: AUTRE_TECHNICIEN_A,
    });
    const societeB = await creer({
      societeId: SOCIETE_B,
      clientId: CLIENT_B1,
      siteId: SITE_B1_S1,
      agenceId: AGENCE_B,
      statut: "affectee",
      datePlanifiee: DEMAIN,
      technicienId: TECHNICIEN_A,
    });

    const ids = (
      await listerPlanning(SESSION_TECHNICIEN_A, DU, AU, clientApp(), {
        inclurePlanifiees: false,
        inclureAnnulees: false,
      })
    ).map((l) => l.id);

    expect(ids).toContain(proprePropre);
    expect(ids).not.toContain(autreTechnicienA);
    expect(ids).not.toContain(societeB);
  });
});

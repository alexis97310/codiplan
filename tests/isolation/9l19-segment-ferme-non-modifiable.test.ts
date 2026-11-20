import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";

import { clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * 9L19-GARDES-BASE-CHEVAUCHEMENT-SEGMENTS, point 2 — UN SEGMENT FERMÉ NE SE
 * MODIFIE PLUS.
 *
 * Décision d'Alexis du 10/11/2026. Le compteur fait foi pour le temps
 * (R5-02, D119) ; `temps_mesure_min` n'est recalculé QUE lorsqu'il est écrit
 * (`intervention_temps_mesure_du_compteur`), si bien que modifier un segment
 * déjà fermé sans y toucher désynchronise silencieusement le temps mesuré de
 * ce que les segments portent réellement. Seule la fermeture d'un segment
 * OUVERT reste permise — le seul `UPDATE` que l'application écrit
 * (`arreterLeCompteur`, `depot-compteur.ts`).
 */

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien] as string;

const interventionsPosees: string[] = [];
const segmentsPoses: string[] = [];

afterAll(fermerClients);

afterEach(async () => {
  for (const id of segmentsPoses.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "id" = $1::uuid`,
      id,
    );
  }
  for (const id of interventionsPosees.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
      id,
    );
  }
});

async function poserInterventionJetable(): Promise<string> {
  const id = uuidv7();
  interventionsPosees.push(id);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention"
       ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
        "statut", "duree_estimee_min", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
             'planifiee', 60, now())`,
    id,
    SOCIETE_A,
    CLIENT_A1,
    SITE_A1_S1,
    AGENCE_A,
  );
  return id;
}

/** Un segment OUVERT (fin NULL), posé pour la personne canonique du technicien. */
async function poserSegmentOuvert(interventionId: string): Promise<string> {
  const id = uuidv7();
  segmentsPoses.push(id);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "segment_travail"
       ("id", "societe_id", "intervention_id", "utilisateur_id",
        "nom_technicien_affiche", "debut", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid,
             (SELECT "nom" FROM "utilisateur" WHERE "id" = $4::uuid),
             '2026-09-15 08:00:00+11'::timestamptz, now())`,
    id,
    SOCIETE_A,
    interventionId,
    TECHNICIEN,
  );
  return id;
}

describe("un segment fermé ne se modifie plus", () => {
  it("TÉMOIN — fermer un segment OUVERT passe sans peine", async () => {
    const interventionId = await poserInterventionJetable();
    const segmentId = await poserSegmentOuvert(interventionId);
    await expect(
      clientOwner().$executeRawUnsafe(
        `UPDATE "segment_travail" SET "fin" = '2026-09-15 10:00:00+11'::timestamptz WHERE "id" = $1::uuid`,
        segmentId,
      ),
    ).resolves.toBe(1);
  });

  it("LA FAUTE — modifier un segment déjà FERMÉ est refusé", async () => {
    const interventionId = await poserInterventionJetable();
    const segmentId = await poserSegmentOuvert(interventionId);
    await clientOwner().$executeRawUnsafe(
      `UPDATE "segment_travail" SET "fin" = '2026-09-15 10:00:00+11'::timestamptz WHERE "id" = $1::uuid`,
      segmentId,
    );
    await expect(
      clientOwner().$executeRawUnsafe(
        `UPDATE "segment_travail" SET "debut" = '2026-09-15 07:00:00+11'::timestamptz WHERE "id" = $1::uuid`,
        segmentId,
      ),
    ).rejects.toThrow(/ne se modifie plus/);
    // Tenter de RÉOUVRIR un segment fermé (fin → NULL) est la même faute.
    await expect(
      clientOwner().$executeRawUnsafe(
        `UPDATE "segment_travail" SET "fin" = NULL WHERE "id" = $1::uuid`,
        segmentId,
      ),
    ).rejects.toThrow(/ne se modifie plus/);
  });

  it("LE JUMEAU : le déclencheur retiré, la modification d'un segment fermé passe", async () => {
    const interventionId = await poserInterventionJetable();
    const segmentId = await poserSegmentOuvert(interventionId);
    await clientOwner().$executeRawUnsafe(
      `UPDATE "segment_travail" SET "fin" = '2026-09-15 10:00:00+11'::timestamptz WHERE "id" = $1::uuid`,
      segmentId,
    );
    await clientOwner()
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP TRIGGER "segment_travail_ferme_non_modifiable" ON "segment_travail"`,
        );
        const ecrit = await tx.$executeRawUnsafe(
          `UPDATE "segment_travail" SET "debut" = '2026-09-15 07:00:00+11'::timestamptz WHERE "id" = $1::uuid`,
          segmentId,
        );
        expect(ecrit).toBe(1);
        throw new Error("rollback volontaire");
      })
      .catch((erreur: unknown) => {
        expect(String(erreur)).toContain("rollback volontaire");
      });
  });
});

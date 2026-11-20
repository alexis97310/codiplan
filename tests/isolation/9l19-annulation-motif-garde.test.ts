import { afterAll, afterEach, describe, expect, it } from "vitest";

import { uuidv7 } from "@/lib/db/uuid";

import { clientOwner, fermerClients } from "./setup/db";
import { AGENCE_A, CLIENT_A1, SITE_A1_S1, SOCIETE_A } from "./setup/fixtures";

/**
 * 9L19-GARDES-BASE-CHEVAUCHEMENT-SEGMENTS, point 3 — UNE ANNULATION EXIGE SON
 * MOTIF.
 *
 * Décision d'Alexis du 10/11/2026. `schemaAnnulation` (`lib/interventions/
 * saisie.ts`) l'exige déjà à la saisie — au moins trois caractères, non vide
 * après coupe des espaces. Rien ne le tenait en base : une écriture directe
 * pouvait annuler sans un mot. `intervention_cycle_de_vie` ne garde que
 * l'`UPDATE` (la matrice des transitions) ; cette contrainte, elle, juge
 * aussi l'`INSERT` — une ligne qui NAÎT annulée n'empruntait aucune
 * transition et n'était donc jugée par rien.
 */

const jetables: string[] = [];

afterAll(fermerClients);

afterEach(async () => {
  for (const id of jetables.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
      id,
    );
  }
});

async function poserIntervention(motif: string | null): Promise<string> {
  const id = uuidv7();
  jetables.push(id);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention"
       ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
        "statut", "duree_estimee_min", "motif_annulation", "annulee_le",
        "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
             'annulee', 60, $6, now(), now())`,
    id,
    SOCIETE_A,
    CLIENT_A1,
    SITE_A1_S1,
    AGENCE_A,
    motif,
  );
  return id;
}

describe("une intervention ANNULÉE porte un motif non vide", () => {
  it("TÉMOIN — un motif renseigné passe", async () => {
    await expect(poserIntervention("Client absent")).resolves.toBeTypeOf(
      "string",
    );
  });

  it("SANS MOTIF (NULL) — refusé", async () => {
    await expect(poserIntervention(null)).rejects.toThrow(
      /intervention_annulee_a_son_motif/,
    );
  });

  it("UN MOTIF BLANC (espaces seuls) — refusé", async () => {
    await expect(poserIntervention("   ")).rejects.toThrow(
      /intervention_annulee_a_son_motif/,
    );
  });

  it("LE JUMEAU : la contrainte retirée, l'annulation sans motif passe", async () => {
    await clientOwner()
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `ALTER TABLE "intervention" DROP CONSTRAINT "intervention_annulee_a_son_motif"`,
        );
        const id = uuidv7();
        jetables.push(id);
        const ecrit = await tx.$executeRawUnsafe(
          `INSERT INTO "intervention"
             ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
              "statut", "duree_estimee_min", "annulee_le", "modifie_le")
           VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
                   'annulee', 60, now(), now())`,
          id,
          SOCIETE_A,
          CLIENT_A1,
          SITE_A1_S1,
          AGENCE_A,
        );
        expect(ecrit).toBe(1);
        throw new Error("rollback volontaire");
      })
      .catch((erreur: unknown) => {
        expect(String(erreur)).toContain("rollback volontaire");
      });
  });
});

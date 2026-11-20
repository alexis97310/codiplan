import { afterAll, afterEach, describe, expect, it } from "vitest";

import { uuidv7 } from "@/lib/db/uuid";

import { clientOwner, fermerClients } from "./setup/db";
import { AGENCE_A, CLIENT_A1, SITE_A1_S1, SOCIETE_A } from "./setup/fixtures";

/**
 * 9L19-GARDES-BASE-CHEVAUCHEMENT-SEGMENTS, point 1 — LE CHEVAUCHEMENT D'UN
 * TECHNICIEN, TENU EN BASE PAR UNE CONTRAINTE D'EXCLUSION.
 *
 * Décision d'Alexis du 10/11/2026. Même règle qu'à la pose et au déplacement
 * (`verdictChevauchement`, `lib/interventions/pose.ts`) : deux créneaux qui se
 * TOUCHENT ne se chevauchent pas, et une intervention ANNULÉE ne compte pas.
 *
 * **Une contrainte d'EXCLUSION, et non un déclencheur** — voir l'en-tête de
 * la migration pour la mesure qui l'impose : un déclencheur `SELECT EXISTS`
 * ne ferme pas la course entre deux planificateurs concurrents, une
 * contrainte d'exclusion si.
 */

const TECHNICIEN = uuidv7();

const interventionsPosees: string[] = [];

afterAll(fermerClients);

afterEach(async () => {
  for (const id of interventionsPosees.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
      id,
    );
  }
});

/** Pose une intervention directement, hors cycle de vie (le gardien ne juge que l'INSERT). */
async function poserIntervention(options: {
  debut: string;
  fin: string;
  statut?: string;
}): Promise<string> {
  const id = uuidv7();
  interventionsPosees.push(id);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention"
       ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
        "statut", "duree_estimee_min", "technicien_id", "creneau_debut",
        "creneau_fin", "motif_annulation", "annulee_le", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
             $6::"StatutIntervention", 60, $7::uuid, $8::timestamp,
             $9::timestamp,
             CASE WHEN $6 = 'annulee' THEN '9L19 — épreuve' ELSE NULL END,
             CASE WHEN $6 = 'annulee' THEN now() ELSE NULL END,
             now())`,
    id,
    SOCIETE_A,
    CLIENT_A1,
    SITE_A1_S1,
    AGENCE_A,
    options.statut ?? "planifiee",
    TECHNICIEN,
    options.debut,
    options.fin,
  );
  return id;
}

describe("la contrainte d'exclusion refuse le chevauchement d'un technicien", () => {
  it("TÉMOIN — sans voisine, la pose passe", async () => {
    await expect(
      poserIntervention({
        debut: "2026-09-14 08:00:00",
        fin: "2026-09-14 09:00:00",
      }),
    ).resolves.toBeTypeOf("string");
  });

  it("LE CHEVAUCHEMENT — refusé, et le nom de la contrainte se lit dans le refus", async () => {
    await poserIntervention({
      debut: "2026-09-14 08:00:00",
      fin: "2026-09-14 09:00:00",
    });
    await expect(
      poserIntervention({
        debut: "2026-09-14 08:30:00",
        fin: "2026-09-14 09:30:00",
      }),
    ).rejects.toThrow(/intervention_sans_chevauchement_technicien/);
  });

  it("DEUX CRÉNEAUX QUI SE TOUCHENT NE SE CHEVAUCHENT PAS — les deux posent", async () => {
    await poserIntervention({
      debut: "2026-09-14 08:00:00",
      fin: "2026-09-14 09:00:00",
    });
    await expect(
      poserIntervention({
        debut: "2026-09-14 09:00:00",
        fin: "2026-09-14 10:00:00",
      }),
    ).resolves.toBeTypeOf("string");
  });

  it("UNE INTERVENTION ANNULÉE NE COMPTE PAS — la voisine annulée n'empêche rien", async () => {
    await poserIntervention({
      debut: "2026-09-14 08:00:00",
      fin: "2026-09-14 09:00:00",
      statut: "annulee",
    });
    await expect(
      poserIntervention({
        debut: "2026-09-14 08:30:00",
        fin: "2026-09-14 09:30:00",
      }),
    ).resolves.toBeTypeOf("string");
  });

  it("DEUX POSES CONCURRENTES SUR LE MÊME TECHNICIEN — une seule passe", async () => {
    // La course que la décision du 10/11/2026 ferme : deux planificateurs qui
    // posent au même instant, chacun ignorant l'autre. `Promise.allSettled`
    // lance les deux INSERT en même temps sur deux connexions distinctes du
    // pool ; PostgreSQL sérialise sur l'index d'exclusion, et exactement l'un
    // des deux échoue — jamais zéro, jamais les deux.
    const debut = "2026-09-14 14:00:00";
    const fin = "2026-09-14 15:00:00";
    const resultats = await Promise.allSettled([
      poserIntervention({ debut, fin }),
      poserIntervention({ debut, fin }),
    ]);
    const reussies = resultats.filter((r) => r.status === "fulfilled");
    const echouees = resultats.filter((r) => r.status === "rejected");
    expect(reussies).toHaveLength(1);
    expect(echouees).toHaveLength(1);
    const rejet = echouees[0] as PromiseRejectedResult;
    expect(String(rejet.reason)).toMatch(
      /intervention_sans_chevauchement_technicien/,
    );
  });

  it("LE JUMEAU : la contrainte retirée, le chevauchement passe", async () => {
    await poserIntervention({
      debut: "2026-09-14 08:00:00",
      fin: "2026-09-14 09:00:00",
    });
    await clientOwner()
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `ALTER TABLE "intervention" DROP CONSTRAINT "intervention_sans_chevauchement_technicien"`,
        );
        const id = uuidv7();
        interventionsPosees.push(id);
        const ecrit = await tx.$executeRawUnsafe(
          `INSERT INTO "intervention"
             ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
              "statut", "duree_estimee_min", "technicien_id", "creneau_debut",
              "creneau_fin", "modifie_le")
           VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
                   'planifiee', 60, $6::uuid, '2026-09-14 08:30:00'::timestamp,
                   '2026-09-14 09:30:00'::timestamp, now())`,
          id,
          SOCIETE_A,
          CLIENT_A1,
          SITE_A1_S1,
          AGENCE_A,
          TECHNICIEN,
        );
        expect(ecrit).toBe(1);
        throw new Error("rollback volontaire");
      })
      .catch((erreur: unknown) => {
        expect(String(erreur)).toContain("rollback volontaire");
      });
  });
});

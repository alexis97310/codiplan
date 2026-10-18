import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

/**
 * REJEU SANS DOUBLON SUR LES PHOTOS (9F4H2A-REJEU-SANS-DOUBLON, point 3).
 *
 * `operation_id` DEVIENT l'`id` du document, comme pour le segment de
 * travail ou la signature (`lib/interventions/saisie-differee.ts`) : un
 * renvoi après coupure — la réponse se perd, la file de 9F4H3 reprend —
 * retrouve la ligne déjà posée plutôt que d'en écrire une seconde. Un
 * `operation_id` qui désigne la ligne d'une AUTRE intervention échoue sur
 * l'unicité de `id`, rattrapée en un refus générique.
 */

vi.mock("@/lib/auth/porte", () => ({
  exigerCapacite: vi.fn(),
  motifDuRefus: vi.fn().mockResolvedValue("auth.refus_droit"),
}));

vi.hoisted(() => {
  const base = process.env.TEST_DATABASE_URL;
  if (base === undefined) {
    throw new Error(
      "TEST_DATABASE_URL est requis pour tests/isolation/photo-rejeu-sans-doublon.test.ts.",
    );
  }
  const url = new URL(base);
  url.username = "codiplan_app";
  url.password = "";
  process.env.DATABASE_URL = url.toString();
});

import { type ContexteActif } from "@/lib/auth/contexte";
import { exigerCapacite } from "@/lib/auth/porte";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";

import { POST as postPhotos } from "@/app/api/terrain/[id]/photos/route";

import { clientOwner, fermerClients } from "./setup/db";
import {
  INTERVENTION_A1,
  SOCIETE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

afterAll(fermerClients);

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien];

function contexte(): ContexteActif {
  return {
    utilisateurId: TECHNICIEN,
    societeId: SOCIETE_A,
    role: Role.technicien,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };
}

/** Un JPEG minimal — les trois octets magiques, et rien de plus. */
function requeteAvecPhoto(id: string, operationId?: string): Request {
  const corps = new FormData();
  corps.set(
    "fichier",
    new File([Uint8Array.from([0xff, 0xd8, 0xff, 1, 2, 3, 4])], "r.jpg", {
      type: "image/jpeg",
    }),
  );
  if (operationId !== undefined) {
    corps.set("operation_id", operationId);
  }
  return new Request(`http://localhost/api/terrain/${id}/photos`, {
    method: "POST",
    body: corps,
    headers: { Accept: "application/json" },
  });
}

async function reponseJson(
  reponse: Response,
): Promise<{ readonly ok: boolean; readonly motif: string | null }> {
  return (await reponse.json()) as {
    readonly ok: boolean;
    readonly motif: string | null;
  };
}

const jetables: string[] = [];

/** Une intervention jetable, clonée du décor de `INTERVENTION_A1`. */
async function jetable(technicienId: string): Promise<string> {
  const id = uuidv7();
  jetables.push(id);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id","societe_id","client_id","site_id","agence_id",
       "type","statut","date_planifiee","technicien_id","duree_estimee_min","modifie_le")
     SELECT '${id}', "societe_id", "client_id", "site_id", "agence_id",
            'curatif', 'planifiee', DATE '2026-09-14',
            '${technicienId}', 60, now()
       FROM "intervention" WHERE "id" = '${INTERVENTION_A1}'`,
  );
  return id;
}

afterEach(async () => {
  for (const id of jetables.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "document" WHERE "intervention_id" = '${id}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = '${id}'`,
    );
  }
});

describe("un renvoi du même operation_id, sur la même intervention", () => {
  it("accepté, AUCUNE seconde ligne, même id que la première fois", async () => {
    const id = await jetable(TECHNICIEN);
    const operationId = uuidv7();
    vi.mocked(exigerCapacite).mockResolvedValue(contexte());

    const premiere = await reponseJson(
      await postPhotos(requeteAvecPhoto(id, operationId), {
        params: Promise.resolve({ id }),
      }),
    );
    expect(premiere.ok).toBe(true);

    const seconde = await reponseJson(
      await postPhotos(requeteAvecPhoto(id, operationId), {
        params: Promise.resolve({ id }),
      }),
    );
    expect(seconde.ok).toBe(true);

    const documents = await clientOwner().document.findMany({
      where: { intervention_id: id },
      select: { id: true },
    });
    expect(documents).toHaveLength(1);
    expect(documents[0].id).toBe(operationId);
  });
});

describe("le même operation_id désignant la ligne d'une AUTRE intervention", () => {
  it("refus générique identique, rien d'écrit sur la seconde intervention, la première intacte", async () => {
    const premiereIntervention = await jetable(TECHNICIEN);
    const secondeIntervention = await jetable(TECHNICIEN);
    const operationId = uuidv7();
    vi.mocked(exigerCapacite).mockResolvedValue(contexte());

    const premiere = await reponseJson(
      await postPhotos(requeteAvecPhoto(premiereIntervention, operationId), {
        params: Promise.resolve({ id: premiereIntervention }),
      }),
    );
    expect(premiere.ok).toBe(true);

    const seconde = await reponseJson(
      await postPhotos(requeteAvecPhoto(secondeIntervention, operationId), {
        params: Promise.resolve({ id: secondeIntervention }),
      }),
    );
    expect(seconde.ok).toBe(false);
    expect(seconde.motif).toBe("terrain.photos.refus");

    const documentsSeconde = await clientOwner().document.count({
      where: { intervention_id: secondeIntervention },
    });
    expect(documentsSeconde).toBe(0);
    const documentsPremiere = await clientOwner().document.count({
      where: { intervention_id: premiereIntervention },
    });
    expect(documentsPremiere).toBe(1);
  });
});

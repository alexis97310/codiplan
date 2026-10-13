import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

/**
 * R7 (9DX-RETOUCHES-11), RÉÉCRIT SANS DISQUE PAR 9EWB-PHOTOS-EN-BASE — LE
 * RENFORT REFUSÉ NE LAISSE AUCUN DOCUMENT.
 *
 * `enregistrerObjet` (`lib/documents/stockage.ts`) n'est plus appelé pour
 * une photo depuis D96 : les octets sont écrits par `deposerPhotoIntervention`
 * dans la MÊME transaction que `document`, après son PROPRE contrôle de
 * périmètre — il n'y a donc plus d'octet qui pourrait survivre seul à un
 * refus (R7 ne gardait un fichier orphelin QUE parce que l'ancien magasin
 * était écrit AVANT ce contrôle). La garantie que ce fichier éprouve reste
 * la même qu'au 9DX : un renfort refusé sur l'intervention d'un collègue
 * (D151) ne crée AUCUN document, en traversant la VRAIE route.
 */

vi.mock("@/lib/auth/porte", () => ({
  exigerCapacite: vi.fn(),
  motifDuRefus: vi.fn().mockResolvedValue("auth.refus_droit"),
}));

vi.hoisted(() => {
  const base = process.env.TEST_DATABASE_URL;
  if (base === undefined) {
    throw new Error(
      "TEST_DATABASE_URL est requis pour tests/isolation/photo-orpheline-r7.test.ts.",
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
const COLLEGUE = "aaaaaaaa-0000-7000-8000-0000000009e7";

function contexte(utilisateurId: string): ContexteActif {
  return {
    utilisateurId,
    societeId: SOCIETE_A,
    role: Role.technicien,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };
}

/** Un JPEG minimal — les trois octets magiques, et rien de plus. */
function requeteAvecPhoto(id: string): Request {
  const corps = new FormData();
  corps.set(
    "fichier",
    new File([Uint8Array.from([0xff, 0xd8, 0xff, 1, 2, 3, 4])], "r7.jpg", {
      type: "image/jpeg",
    }),
  );
  return new Request(`http://localhost/api/terrain/${id}/photos`, {
    method: "POST",
    body: corps,
  });
}

function motifDeLaRedirection(reponse: Response): string | null {
  const location = reponse.headers.get("location");
  if (location === null) return null;
  return new URL(location, "http://localhost").searchParams.get("motif");
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

describe("le renfort refusé sur l'intervention d'un collègue ne laisse aucun document", () => {
  it("refus nommé, aucun document créé", async () => {
    const id = await jetable(COLLEGUE);
    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte(TECHNICIEN));

    const reponse = await postPhotos(requeteAvecPhoto(id), {
      params: Promise.resolve({ id }),
    });

    expect(motifDeLaRedirection(reponse)).toBe("terrain.photos.refus");
    const documents = await clientOwner().document.count({
      where: { intervention_id: id },
    });
    expect(documents).toBe(0);
  });

  it("LE JUMEAU — le technicien affecté dépose sa propre photo : acceptée, un seul document créé", async () => {
    const id = await jetable(TECHNICIEN);
    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte(TECHNICIEN));

    const reponse = await postPhotos(requeteAvecPhoto(id), {
      params: Promise.resolve({ id }),
    });

    expect(motifDeLaRedirection(reponse)).toBeNull();
    const documents = await clientOwner().document.count({
      where: { intervention_id: id },
    });
    expect(documents).toBe(1);
  });
});

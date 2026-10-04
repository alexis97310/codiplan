import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

/**
 * R7 (9DX-RETOUCHES-11) — LE PÉRIMÈTRE SE JUGE AVANT D'ÉCRIRE L'OCTET.
 *
 * `POST /api/terrain/{id}/photos` appelait `enregistrerObjet` (écrit le
 * fichier sur disque) AVANT `deposerPhotoIntervention`, qui peut refuser
 * depuis D151 (le renfort ne dépose pas la photo d'autrui) — un refus
 * laissait donc un fichier orphelin derrière lui. La route appelle désormais
 * `peutDeposerPhotoSurCetteIntervention` (`lib/documents/depot.ts`) avant
 * tout `enregistrerObjet` : ce fichier le prouve en traversant la VRAIE
 * route, la porte étant fabriquée pour un rôle donné (même patron que
 * `tests/isolation/droits-ecrans-tp-s3.test.ts`).
 */

vi.mock("@/lib/auth/porte", () => ({
  exigerCapacite: vi.fn(),
  motifDuRefus: vi.fn().mockResolvedValue("auth.refus_droit"),
}));

vi.mock("@/lib/documents/stockage", async () => {
  const reel = await vi.importActual<typeof import("@/lib/documents/stockage")>(
    "@/lib/documents/stockage",
  );
  return { ...reel, enregistrerObjet: vi.fn(reel.enregistrerObjet) };
});

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
import { enregistrerObjet } from "@/lib/documents/stockage";

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

function requeteAvecPhoto(id: string): Request {
  const corps = new FormData();
  corps.set(
    "fichier",
    new File([Uint8Array.from([1, 2, 3, 4])], "r7.jpg", {
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
  vi.mocked(enregistrerObjet).mockClear();
  for (const id of jetables.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "document" WHERE "intervention_id" = '${id}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = '${id}'`,
    );
  }
});

describe("le renfort refusé sur l'intervention d'un collègue ne laisse aucun fichier orphelin", () => {
  it("refus nommé, enregistrerObjet jamais appelé, aucun document créé", async () => {
    const id = await jetable(COLLEGUE);
    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte(TECHNICIEN));

    const reponse = await postPhotos(requeteAvecPhoto(id), {
      params: Promise.resolve({ id }),
    });

    expect(motifDeLaRedirection(reponse)).toBe("terrain.photos.refus");
    expect(enregistrerObjet).not.toHaveBeenCalled();
    const documents = await clientOwner().document.count({
      where: { intervention_id: id },
    });
    expect(documents).toBe(0);
  });

  it("LE JUMEAU — le technicien affecté dépose sa propre photo : acceptée, un seul appel à enregistrerObjet", async () => {
    const id = await jetable(TECHNICIEN);
    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte(TECHNICIEN));

    const reponse = await postPhotos(requeteAvecPhoto(id), {
      params: Promise.resolve({ id }),
    });

    expect(motifDeLaRedirection(reponse)).toBeNull();
    expect(enregistrerObjet).toHaveBeenCalledTimes(1);
    const documents = await clientOwner().document.count({
      where: { intervention_id: id },
    });
    expect(documents).toBe(1);
  });
});

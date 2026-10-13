import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

/**
 * LE FORMAT ET LA TAILLE SE JUGENT SUR LES OCTETS, AVANT TOUT PÉRIMÈTRE
 * (9EWB-PHOTOS-EN-BASE) — en traversant la VRAIE route, comme
 * `tests/isolation/photo-orpheline-r7.test.ts`, même patron.
 *
 * Un SVG porte du script exécutable : l'accepter comme une image serait une
 * porte ouverte, et `fichier.type`/l'extension ne protègent de rien (les
 * deux sont fournis par le client). La base elle-même refuse plus d'1 Mo
 * (`document_octets_plafond`) ; la route le refuse d'abord, avec un motif
 * lisible plutôt qu'une erreur de contrainte.
 */

vi.mock("@/lib/auth/porte", () => ({
  exigerCapacite: vi.fn(),
  motifDuRefus: vi.fn().mockResolvedValue("auth.refus_droit"),
}));

vi.hoisted(() => {
  const base = process.env.TEST_DATABASE_URL;
  if (base === undefined) {
    throw new Error(
      "TEST_DATABASE_URL est requis pour tests/isolation/photo-format-et-taille.test.ts.",
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

function motifDeLaRedirection(reponse: Response): string | null {
  const location = reponse.headers.get("location");
  if (location === null) return null;
  return new URL(location, "http://localhost").searchParams.get("motif");
}

const jetables: string[] = [];

async function jetable(): Promise<string> {
  const id = uuidv7();
  jetables.push(id);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id","societe_id","client_id","site_id","agence_id",
       "type","statut","date_planifiee","technicien_id","duree_estimee_min","modifie_le")
     SELECT '${id}', "societe_id", "client_id", "site_id", "agence_id",
            'curatif', 'planifiee', DATE '2026-09-14',
            '${TECHNICIEN}', 60, now()
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

async function deposer(id: string, corps: FormData): Promise<Response> {
  vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte());
  return postPhotos(
    new Request(`http://localhost/api/terrain/${id}/photos`, {
      method: "POST",
      body: corps,
    }),
    { params: Promise.resolve({ id }) },
  );
}

describe("le format et la taille d'une photo", () => {
  it("un SVG — fichier.type et extension prétendent une image — est refusé, aucun document créé", async () => {
    const id = await jetable();
    const corps = new FormData();
    corps.set(
      "fichier",
      new File(
        [new TextEncoder().encode("<svg onload='alert(1)'></svg>")],
        "x.svg",
        { type: "image/svg+xml" },
      ),
    );

    const reponse = await deposer(id, corps);

    expect(motifDeLaRedirection(reponse)).toBe("terrain.photos.refus_type");
    const documents = await clientOwner().document.count({
      where: { intervention_id: id },
    });
    expect(documents).toBe(0);
  });

  it("un fichier renommé .jpg mais sans octets magiques JPEG/PNG est refusé", async () => {
    const id = await jetable();
    const corps = new FormData();
    corps.set(
      "fichier",
      new File([Uint8Array.from([1, 2, 3, 4])], "faux.jpg", {
        type: "image/jpeg",
      }),
    );

    const reponse = await deposer(id, corps);

    expect(motifDeLaRedirection(reponse)).toBe("terrain.photos.refus_type");
  });

  it("plus d'1 Mo est refusé, nommé, aucun document créé", async () => {
    const id = await jetable();
    const gros = new Uint8Array(1024 * 1024 + 1);
    gros.set([0xff, 0xd8, 0xff]);
    const corps = new FormData();
    corps.set("fichier", new File([gros], "gros.jpg", { type: "image/jpeg" }));

    const reponse = await deposer(id, corps);

    expect(motifDeLaRedirection(reponse)).toBe("terrain.photos.refus_taille");
    const documents = await clientOwner().document.count({
      where: { intervention_id: id },
    });
    expect(documents).toBe(0);
  });
});

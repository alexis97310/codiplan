import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

/**
 * 9K28-CHECKLIST-REPONSE-PHOTO — LE SIXIÈME TYPE, « photo ».
 *
 * MÊME ROUTE, MÊME COMPOSANT qu'une photo d'intervention ordinaire
 * (`POST /api/terrain/[id]/photos`, un seul champ `checklist_point_id` de
 * plus) : ce fichier l'éprouve donc au MÊME niveau que `photo-orpheline-
 * r7.test.ts` — la vraie route, jamais un appel direct au dépôt pour le
 * chemin heureux.
 *
 * **TOUT ou RIEN (I6)** : un refus sur la liaison au point REFUSE LE DÉPÔT
 * ENTIER — `enregistrerReponsePhoto` lève plutôt que de `return null`
 * depuis une transaction Prisma interactive (un `return` la validerait quand
 * même). Les deux scénarios de refus ci-dessous vérifient donc aussi
 * qu'AUCUN document n'a été créé, pas seulement qu'aucune réponse ne l'a été.
 */

vi.mock("@/lib/auth/porte", () => ({
  exigerCapacite: vi.fn(),
  motifDuRefus: vi.fn().mockResolvedValue("auth.refus_droit"),
}));

vi.hoisted(() => {
  const base = process.env.TEST_DATABASE_URL;
  if (base === undefined) {
    throw new Error(
      "TEST_DATABASE_URL est requis pour tests/isolation/9k28-checklist-reponse-photo.test.ts.",
    );
  }
  const url = new URL(base);
  url.username = "codiplan_app";
  url.password = "";
  process.env.DATABASE_URL = url.toString();
});

import { type ContexteActif, type ContexteSession } from "@/lib/auth/contexte";
import { enregistrerReponsePhoto } from "@/lib/checklists/depot";
import { exigerCapacite } from "@/lib/auth/porte";
import { Role } from "@/lib/auth/roles";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";

import { POST as postPhotos } from "@/app/api/terrain/[id]/photos/route";

import { clientOwner, fermerClients } from "./setup/db";
import {
  INTERVENTION_A1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

afterAll(fermerClients);

const TECHNICIEN_A = UTILISATEUR_PAR_ROLE[Role.technicien];

function contexteActif(utilisateurId: string): ContexteActif {
  return {
    utilisateurId,
    societeId: SOCIETE_A,
    role: Role.technicien,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };
}

function session(utilisateurId: string): ContexteSession {
  return contexteActif(utilisateurId);
}

/** Un JPEG minimal — les trois octets magiques, et rien de plus. */
function requeteAvecPhoto(id: string, checklistPointId?: string): Request {
  const corps = new FormData();
  corps.set(
    "fichier",
    new File([Uint8Array.from([0xff, 0xd8, 0xff, 1, 2, 3, 4])], "9k28.jpg", {
      type: "image/jpeg",
    }),
  );
  if (checklistPointId !== undefined) {
    corps.set("checklist_point_id", checklistPointId);
  }
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
const modelesJetables: string[] = [];

/** Une intervention jetable, clonée du décor de `INTERVENTION_A1`. */
async function jetable(): Promise<string> {
  const id = uuidv7();
  jetables.push(id);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id","societe_id","client_id","site_id","agence_id",
       "type","statut","date_planifiee","technicien_id","duree_estimee_min","modifie_le")
     SELECT '${id}', "societe_id", "client_id", "site_id", "agence_id",
            'curatif', 'planifiee', DATE '2026-09-14',
            '${TECHNICIEN_A}', 60, now()
       FROM "intervention" WHERE "id" = '${INTERVENTION_A1}'`,
  );
  return id;
}

/** Un modèle GÉNÉRIQUE (aucun rattachement) + une version + un point `photo`, résolu par la cascade pour toute intervention de la société. */
async function poserGabaritPhoto(
  societeId: string,
  suffixe: string,
): Promise<{ readonly modeleId: string; readonly pointId: string }> {
  const modeleId = uuidv7();
  const versionId = uuidv7();
  const pointId = uuidv7();
  modelesJetables.push(modeleId);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "checklist_modele" ("id", "societe_id", "code", "libelle", "modifie_le")
     VALUES ('${modeleId}', '${societeId}', 'CK28-${suffixe}', 'Checklist photo ${suffixe}', now())`,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "checklist_version" ("id", "societe_id", "checklist_modele_id", "numero")
     VALUES ('${versionId}', '${societeId}', '${modeleId}', 1)`,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "checklist_point"
       ("id", "societe_id", "checklist_version_id", "section", "ordre", "libelle", "obligatoire", "type_reponse")
     VALUES ('${pointId}', '${societeId}', '${versionId}', 'Section', 1, 'Point photo', false, 'photo')`,
  );
  return { modeleId, pointId };
}

async function supprimerModele(modeleId: string): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "checklist_reponse_photo" WHERE "checklist_reponse_id" IN (
       SELECT "r"."id" FROM "checklist_reponse" "r"
       JOIN "checklist_point" "p" ON "p"."id" = "r"."checklist_point_id"
       JOIN "checklist_version" "v" ON "v"."id" = "p"."checklist_version_id"
       WHERE "v"."checklist_modele_id" = '${modeleId}'
     )`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "checklist_reponse" WHERE "checklist_point_id" IN (
       SELECT "p"."id" FROM "checklist_point" "p"
       JOIN "checklist_version" "v" ON "v"."id" = "p"."checklist_version_id"
       WHERE "v"."checklist_modele_id" = '${modeleId}'
     )`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "checklist_version" WHERE "checklist_modele_id" = '${modeleId}'`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "checklist_modele" WHERE "id" = '${modeleId}'`,
  );
}

afterEach(async () => {
  // L'INTERVENTION D'ABORD (son pin `checklist_version_id` référence la
  // version que `supprimerModele` va détruire ensuite) — l'ordre inverse
  // heurte `intervention_societe_id_checklist_version_id_fkey`.
  for (const id of jetables.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "checklist_reponse_photo" WHERE "checklist_reponse_id" IN (
         SELECT "id" FROM "checklist_reponse" WHERE "intervention_id" = '${id}'
       )`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "checklist_reponse" WHERE "intervention_id" = '${id}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "document" WHERE "intervention_id" = '${id}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = '${id}'`,
    );
  }
  for (const modeleId of modelesJetables.splice(0)) {
    await supprimerModele(modeleId);
  }
});

describe("une photo de point « photo », par la vraie route", () => {
  it("accepte, lie la photo au point, et pose le marqueur de présence", async () => {
    const id = await jetable();
    const { pointId } = await poserGabaritPhoto(SOCIETE_A, "heureux");
    vi.mocked(exigerCapacite).mockResolvedValueOnce(
      contexteActif(TECHNICIEN_A),
    );

    const reponse = await postPhotos(requeteAvecPhoto(id, pointId), {
      params: Promise.resolve({ id }),
    });

    expect(motifDeLaRedirection(reponse)).toBeNull();

    const document = await clientOwner().document.findFirst({
      where: { intervention_id: id },
    });
    expect(document).not.toBeNull();
    // LE CLIENT VOIT TOUS LES POINTS DE SA CHECKLIST REMPLIE (D235) — la
    // classe est FORCÉE à « client », quel que soit ce que l'appelant aurait
    // pu soumettre (aucun champ `classe` n'était même fourni ici).
    expect(document?.classe).toBe("client");

    const checklistReponse = await clientOwner().checklistReponse.findFirst({
      where: { intervention_id: id, checklist_point_id: pointId },
    });
    expect(checklistReponse?.valeur_photo).toBe(true);

    const lien = await clientOwner().checklistReponsePhoto.findFirst({
      where: { checklist_reponse_id: checklistReponse?.id },
    });
    expect(lien?.document_id).toBe(document?.id);
  });

  it("LE JUMEAU — un point d'une AUTRE checklist (jamais pinnée ici) est refusé, et AUCUN document n'est créé (I6)", async () => {
    const id = await jetable();
    // Un gabarit résoluble pour CETTE intervention (pour que la cascade
    // pinne une version RÉELLE), et un point AILLEURS — jamais dans cette
    // version-ci, exactement ce qu'« un point d'une autre intervention »
    // signifie ici : aucun point n'appartient à une intervention, seulement
    // à LA VERSION qu'une intervention a pinnée.
    await poserGabaritPhoto(SOCIETE_A, "voisin-a");
    const { pointId: pointAilleurs } = await poserGabaritPhoto(
      SOCIETE_A,
      "voisin-b",
    );
    vi.mocked(exigerCapacite).mockResolvedValueOnce(
      contexteActif(TECHNICIEN_A),
    );

    const reponse = await postPhotos(requeteAvecPhoto(id, pointAilleurs), {
      params: Promise.resolve({ id }),
    });

    expect(motifDeLaRedirection(reponse)).toBe("terrain.photos.refus");
    const documents = await clientOwner().document.count({
      where: { intervention_id: id },
    });
    expect(documents).toBe(0);
    const reponses = await clientOwner().checklistReponse.count({
      where: { intervention_id: id },
    });
    expect(reponses).toBe(0);
  });

  it("LE JUMEAU — un point d'une AUTRE SOCIÉTÉ est refusé, et AUCUN document n'est créé (I6)", async () => {
    const id = await jetable();
    await poserGabaritPhoto(SOCIETE_A, "propre");
    // `poserGabaritPhoto` sous le propriétaire ÉCRIT la ligne, mais c'est la
    // SESSION du technicien (société A) qui LIT ensuite — la politique
    // « interne » de `checklist_modele` (D94) ferme la chaîne de filiation
    // avant même de comparer les identifiants.
    const { pointId: pointDeLautreSociete } = await poserGabaritPhoto(
      SOCIETE_B,
      "intrus",
    );
    vi.mocked(exigerCapacite).mockResolvedValueOnce(
      contexteActif(TECHNICIEN_A),
    );

    const reponse = await postPhotos(
      requeteAvecPhoto(id, pointDeLautreSociete),
      { params: Promise.resolve({ id }) },
    );

    expect(motifDeLaRedirection(reponse)).toBe("terrain.photos.refus");
    const documents = await clientOwner().document.count({
      where: { intervention_id: id },
    });
    expect(documents).toBe(0);
  });
});

describe("enregistrerReponsePhoto — la photo doit être CELLE DE CETTE INTERVENTION", () => {
  it("refuse de lier une photo déposée sur une AUTRE intervention, même de la même société", async () => {
    const idCible = await jetable();
    const idAutre = await jetable();
    const { pointId } = await poserGabaritPhoto(SOCIETE_A, "ownership");

    // La photo existe réellement, mais sur `idAutre` — jamais `idCible`.
    const documentAilleurs = await clientOwner().document.create({
      data: {
        id: uuidv7(),
        societe_id: SOCIETE_A,
        intervention_id: idAutre,
        classe: "client",
        libelle: "Photo de l'autre intervention",
        nom_fichier: "ailleurs.jpg",
        type_mime: "image/jpeg",
        taille_octets: BigInt(7),
        empreinte: "0".repeat(64),
        objet_cle: "bd:0".repeat(1),
      },
      select: { id: true },
    });

    const contexte = session(TECHNICIEN_A);
    const resultat = await avecContexteApplicatif(contexte, (tx) =>
      enregistrerReponsePhoto(tx, {
        societeId: SOCIETE_A,
        interventionId: idCible,
        typeIntervention: "curatif",
        checklistVersionIdActuel: null,
        checklistPointId: pointId,
        documentId: documentAilleurs.id,
        auteurId: TECHNICIEN_A,
      }),
    );

    expect("refuse" in resultat && resultat.refuse).toBe(true);
    const lien = await clientOwner().checklistReponsePhoto.count({
      where: { document_id: documentAilleurs.id },
    });
    expect(lien).toBe(0);
  });
});

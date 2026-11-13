import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

/**
 * 9L04E-TERRAIN-PHOTOS-EPUREES — SUPPRESSION ET LÉGENDE D'UNE PHOTO DÉJÀ
 * ENVOYÉE (décisions d'Alexis du 13/11/2026).
 *
 * **L'AUTEUR EST LU DANS `Document.depose_par`, JAMAIS DANS `journal_audit`**
 * (`lib/documents/depot.ts`, `photoModifiableDansTx`) — mesuré au point 0 :
 * la politique de LECTURE du journal exige la capacité
 * `consulter_journal_audit` (admin_societe/direction seuls), que le rôle
 * `technicien` qui dépose et supprime SES PROPRES photos n'a jamais ; lire le
 * journal depuis ce rôle rend toujours zéro ligne. La seule façon réaliste de
 * faire DIVERGER l'auteur réel (qui a déposé) de l'affecté actuel (qui passe
 * le périmètre technicien, forme « restreint »,
 * `accesSurCetteIntervention`) est une RÉAFFECTATION de l'intervention — le
 * périmètre route n'admet AUCUN second accès simultané (« renfort ») sur une
 * même intervention, voir `lib/interventions/perimetre-technicien.ts`
 * (`dansLePerimetre`). Les scénarios « pas l'auteur » ci-dessous réaffectent
 * donc l'intervention plutôt que d'inventer un second technicien qui y
 * aurait accès en même temps que le premier — ce second accès n'existe pas.
 */

vi.mock("@/lib/auth/porte", () => ({
  exigerCapacite: vi.fn(),
  motifDuRefus: vi.fn().mockResolvedValue("auth.refus_droit"),
}));

vi.hoisted(() => {
  const base = process.env.TEST_DATABASE_URL;
  if (base === undefined) {
    throw new Error(
      "TEST_DATABASE_URL est requis pour tests/isolation/photo-suppression-legende.test.ts.",
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
import { POST as postSupprimer } from "@/app/api/terrain/[id]/photos/supprimer/route";
import { POST as postLegende } from "@/app/api/terrain/[id]/photos/legende/route";

import { clientOwner, fermerClients } from "./setup/db";
import {
  INTERVENTION_A1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

afterAll(fermerClients);

const TECHNICIEN_A = UTILISATEUR_PAR_ROLE[Role.technicien];
// MÊME SECOND TECHNICIEN DE LA SOCIÉTÉ A QUE `photo-orpheline-r7.test.ts` —
// une ligne `utilisateur` réelle, déjà prouvée par ce fichier.
const COLLEGUE_A = "aaaaaaaa-0000-7000-8000-0000000009e7";

function contexte(utilisateurId: string, societeId = SOCIETE_A): ContexteActif {
  return {
    utilisateurId,
    societeId,
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
    new File(
      [Uint8Array.from([0xff, 0xd8, 0xff, 9, 9, 9, 9, Math.random() * 255])],
      "9l04e.jpg",
      { type: "image/jpeg" },
    ),
  );
  return new Request(`http://localhost/api/terrain/${id}/photos`, {
    method: "POST",
    body: corps,
    headers: { Accept: "application/json" },
  });
}

function requeteSuppression(id: string, documentId: string): Request {
  const corps = new FormData();
  corps.set("document_id", documentId);
  return new Request(`http://localhost/api/terrain/${id}/photos/supprimer`, {
    method: "POST",
    body: corps,
    headers: { Accept: "application/json" },
  });
}

function requeteLegende(
  id: string,
  documentId: string,
  libelle: string,
): Request {
  const corps = new FormData();
  corps.set("document_id", documentId);
  corps.set("libelle", libelle);
  return new Request(`http://localhost/api/terrain/${id}/photos/legende`, {
    method: "POST",
    body: corps,
    headers: { Accept: "application/json" },
  });
}

async function corpsJson(
  reponse: Response,
): Promise<{ readonly ok: boolean; readonly motif: string | null }> {
  return (await reponse.json()) as { ok: boolean; motif: string | null };
}

const jetables: string[] = [];
const modelesJetables: string[] = [];

async function jetable(
  technicienId: string,
  statut = "en_cours",
): Promise<string> {
  const id = uuidv7();
  jetables.push(id);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id","societe_id","client_id","site_id","agence_id",
       "type","statut","date_planifiee","technicien_id","duree_estimee_min","modifie_le")
     SELECT '${id}', "societe_id", "client_id", "site_id", "agence_id",
            'curatif', '${statut}', DATE '2026-09-14',
            '${technicienId}', 60, now()
       FROM "intervention" WHERE "id" = '${INTERVENTION_A1}'`,
  );
  return id;
}

async function reaffecter(
  interventionId: string,
  technicienId: string,
): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `UPDATE "intervention" SET "technicien_id" = '${technicienId}' WHERE "id" = '${interventionId}'`,
  );
}

/** Dépose une photo par la VRAIE route, et rend son `id` lu en base. */
async function deposer(
  interventionId: string,
  auteurId: string,
): Promise<string> {
  vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte(auteurId));
  const reponse = await postPhotos(requeteAvecPhoto(interventionId), {
    params: Promise.resolve({ id: interventionId }),
  });
  const resultat = await corpsJson(reponse);
  expect(resultat.ok).toBe(true);
  const document = await clientOwner().document.findFirstOrThrow({
    where: { intervention_id: interventionId },
    orderBy: { cree_le: "desc" },
    select: { id: true },
  });
  return document.id;
}

async function poserGabaritPhoto(
  suffixe: string,
): Promise<{ readonly modeleId: string; readonly pointId: string }> {
  const modeleId = uuidv7();
  const versionId = uuidv7();
  const pointId = uuidv7();
  modelesJetables.push(modeleId);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "checklist_modele" ("id", "societe_id", "code", "libelle", "modifie_le")
     VALUES ('${modeleId}', '${SOCIETE_A}', 'CK9L04E-${suffixe}', 'Checklist photo ${suffixe}', now())`,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "checklist_version" ("id", "societe_id", "checklist_modele_id", "numero")
     VALUES ('${versionId}', '${SOCIETE_A}', '${modeleId}', 1)`,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "checklist_point"
       ("id", "societe_id", "checklist_version_id", "section", "ordre", "libelle", "obligatoire", "type_reponse")
     VALUES ('${pointId}', '${SOCIETE_A}', '${versionId}', 'Section', 1, 'Point photo', false, 'photo')`,
  );
  return { modeleId, pointId };
}

afterEach(async () => {
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
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "checklist_version" WHERE "checklist_modele_id" = '${modeleId}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "checklist_modele" WHERE "id" = '${modeleId}'`,
    );
  }
});

describe("supprimer une photo — par son auteur, jusqu'à Terminer", () => {
  it("l'auteur supprime sa propre photo, acceptée", async () => {
    const id = await jetable(TECHNICIEN_A);
    const documentId = await deposer(id, TECHNICIEN_A);

    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte(TECHNICIEN_A));
    const reponse = await postSupprimer(requeteSuppression(id, documentId), {
      params: Promise.resolve({ id }),
    });
    expect(await corpsJson(reponse)).toEqual({ ok: true, motif: null });
    const restantes = await clientOwner().document.count({
      where: { id: documentId },
    });
    expect(restantes).toBe(0);
  });

  it("réaffectée à un autre technicien, CELUI-CI ne supprime pas la photo d'un autre — refus nommé, rien n'est supprimé", async () => {
    const id = await jetable(TECHNICIEN_A);
    const documentId = await deposer(id, TECHNICIEN_A);
    await reaffecter(id, COLLEGUE_A);

    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte(COLLEGUE_A));
    const reponse = await postSupprimer(requeteSuppression(id, documentId), {
      params: Promise.resolve({ id }),
    });
    expect(await corpsJson(reponse)).toEqual({
      ok: false,
      motif: "terrain.photos.refus_pas_lauteur",
    });
    expect(
      await clientOwner().document.count({ where: { id: documentId } }),
    ).toBe(1);
  });

  it("LE JUMEAU — après réaffectation, le nouvel affecté supprime SA PROPRE photo, acceptée", async () => {
    const id = await jetable(TECHNICIEN_A);
    await reaffecter(id, COLLEGUE_A);
    const documentId = await deposer(id, COLLEGUE_A);

    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte(COLLEGUE_A));
    const reponse = await postSupprimer(requeteSuppression(id, documentId), {
      params: Promise.resolve({ id }),
    });
    expect(await corpsJson(reponse)).toEqual({ ok: true, motif: null });
  });

  it("une intervention TERMINÉE refuse la suppression — même pour l'auteur, rien n'est supprimé", async () => {
    const id = await jetable(TECHNICIEN_A);
    const documentId = await deposer(id, TECHNICIEN_A);
    await clientOwner().$executeRawUnsafe(
      `UPDATE "intervention" SET "statut" = 'terminee' WHERE "id" = '${id}'`,
    );

    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte(TECHNICIEN_A));
    const reponse = await postSupprimer(requeteSuppression(id, documentId), {
      params: Promise.resolve({ id }),
    });
    expect(await corpsJson(reponse)).toEqual({
      ok: false,
      motif: "terrain.photos.refus_intervention_fermee",
    });
    expect(
      await clientOwner().document.count({ where: { id: documentId } }),
    ).toBe(1);
  });

  it("une photo liée à une réponse de checklist est IMMUABLE — refus nommé, rien n'est supprimé", async () => {
    const id = await jetable(TECHNICIEN_A);
    const { pointId } = await poserGabaritPhoto("supprimer");
    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte(TECHNICIEN_A));
    const corps = new FormData();
    corps.set(
      "fichier",
      new File([Uint8Array.from([0xff, 0xd8, 0xff, 7, 7, 7])], "ck.jpg", {
        type: "image/jpeg",
      }),
    );
    corps.set("checklist_point_id", pointId);
    const depot = await postPhotos(
      new Request(`http://localhost/api/terrain/${id}/photos`, {
        method: "POST",
        body: corps,
        headers: { Accept: "application/json" },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(await corpsJson(depot)).toEqual({ ok: true, motif: null });
    const document = await clientOwner().document.findFirstOrThrow({
      where: { intervention_id: id },
      select: { id: true },
    });

    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte(TECHNICIEN_A));
    const reponse = await postSupprimer(requeteSuppression(id, document.id), {
      params: Promise.resolve({ id }),
    });
    expect(await corpsJson(reponse)).toEqual({
      ok: false,
      motif: "terrain.photos.refus_lien_checklist",
    });
    expect(
      await clientOwner().document.count({ where: { id: document.id } }),
    ).toBe(1);
  });

  it("une société B ne voit — ni ne supprime — jamais le document d'une autre société (I1)", async () => {
    const id = await jetable(TECHNICIEN_A);
    const documentId = await deposer(id, TECHNICIEN_A);

    vi.mocked(exigerCapacite).mockResolvedValueOnce(
      contexte(TECHNICIEN_A, SOCIETE_B),
    );
    const reponse = await postSupprimer(requeteSuppression(id, documentId), {
      params: Promise.resolve({ id }),
    });
    expect(await corpsJson(reponse)).toEqual({
      ok: false,
      motif: "terrain.photos.refus",
    });
    expect(
      await clientOwner().document.count({ where: { id: documentId } }),
    ).toBe(1);
  });
});

describe("modifier la légende d'une photo déjà envoyée", () => {
  it("l'auteur enregistre une légende, acceptée et lue en base", async () => {
    const id = await jetable(TECHNICIEN_A);
    const documentId = await deposer(id, TECHNICIEN_A);

    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte(TECHNICIEN_A));
    const reponse = await postLegende(
      requeteLegende(id, documentId, "Avant intervention"),
      { params: Promise.resolve({ id }) },
    );
    expect(await corpsJson(reponse)).toEqual({ ok: true, motif: null });
    const document = await clientOwner().document.findUniqueOrThrow({
      where: { id: documentId },
      select: { libelle: true },
    });
    expect(document.libelle).toBe("Avant intervention");
  });

  it("une légende vidée repose le nom de fichier d'origine — « sans légende » détectée par ce repli", async () => {
    const id = await jetable(TECHNICIEN_A);
    const documentId = await deposer(id, TECHNICIEN_A);
    const avant = await clientOwner().document.findUniqueOrThrow({
      where: { id: documentId },
      select: { nom_fichier: true },
    });

    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte(TECHNICIEN_A));
    await postLegende(requeteLegende(id, documentId, "Une légende"), {
      params: Promise.resolve({ id }),
    });
    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte(TECHNICIEN_A));
    const reponse = await postLegende(requeteLegende(id, documentId, ""), {
      params: Promise.resolve({ id }),
    });
    expect(await corpsJson(reponse)).toEqual({ ok: true, motif: null });
    const apres = await clientOwner().document.findUniqueOrThrow({
      where: { id: documentId },
      select: { libelle: true },
    });
    expect(apres.libelle).toBe(avant.nom_fichier);
  });

  it("réaffectée, le nouvel affecté ne modifie pas la légende d'une photo d'un autre — refus nommé", async () => {
    const id = await jetable(TECHNICIEN_A);
    const documentId = await deposer(id, TECHNICIEN_A);
    await reaffecter(id, COLLEGUE_A);

    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte(COLLEGUE_A));
    const reponse = await postLegende(
      requeteLegende(id, documentId, "Une légende d'autrui"),
      { params: Promise.resolve({ id }) },
    );
    expect(await corpsJson(reponse)).toEqual({
      ok: false,
      motif: "terrain.photos.refus_pas_lauteur",
    });
  });

  it("une intervention TERMINÉE refuse la modification de légende, même pour l'auteur", async () => {
    const id = await jetable(TECHNICIEN_A);
    const documentId = await deposer(id, TECHNICIEN_A);
    await clientOwner().$executeRawUnsafe(
      `UPDATE "intervention" SET "statut" = 'terminee' WHERE "id" = '${id}'`,
    );

    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte(TECHNICIEN_A));
    const reponse = await postLegende(
      requeteLegende(id, documentId, "Trop tard"),
      { params: Promise.resolve({ id }) },
    );
    expect(await corpsJson(reponse)).toEqual({
      ok: false,
      motif: "terrain.photos.refus_intervention_fermee",
    });
  });
});

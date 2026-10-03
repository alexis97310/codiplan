import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { deposerPhotoIntervention } from "@/lib/documents/depot";
import {
  arreterLeCompteur,
  demarrerLeCompteur,
} from "@/lib/interventions/depot-compteur";
import {
  definirPrestationsRealisees,
  enregistrerRapportTexte,
  enregistrerSignature,
} from "@/lib/interventions/depot-rapport-terrain";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  INTERVENTION_A1,
  SOCIETE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * D151 (03/10/2026, reprise 9DCA de 9DC-TP-S2-S5) — LE RENFORT POINTE, IL
 * N'ÉCRIT PAS LE RAPPORT D'AUTRUI.
 *
 * `saisir_rapport` passe en ○ pour le technicien (`lib/auth/habilitations.ts`),
 * et les quatre dépôts d'écriture du terrain — `enregistrerRapportTexte`,
 * `definirPrestationsRealisees`, `enregistrerSignature`
 * (`lib/interventions/depot-rapport-terrain.ts`), `deposerPhotoIntervention`
 * (`lib/documents/depot.ts`) — jugent désormais `accesSurCetteIntervention`,
 * même périmètre scopé que `cloturerIntervention` (D131, voir
 * `droits-cycle-de-vie.test.ts`). Le compteur (`depot-compteur.ts`) n'en fait
 * PAS partie — ce fichier le prouve des deux côtés : refusé sur l'écriture
 * du rapport d'un collègue, accepté sur le pointage du même collègue.
 */

afterAll(fermerClients);

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien];
/** Le COLLÈGUE — une valeur posée sur `technicien_id`, jamais authentifiée
 * ici (même patron que `tests/isolation/droits-cycle-de-vie.test.ts`). */
const COLLEGUE = "aaaaaaaa-0000-7000-8000-0000000009dc";

const SESSION_TECH = {
  utilisateurId: TECHNICIEN,
  societeId: SOCIETE_A,
  role: Role.technicien,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const SESSION_BUREAU = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.responsable_materiel],
  societeId: SOCIETE_A,
  role: Role.responsable_materiel,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const PRESTATION = uuidv7();
const jetables: string[] = [];

beforeAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "prestation" ("id", "societe_id", "code", "libelle", "modifie_le")
     VALUES ('${PRESTATION}', '${SOCIETE_A}', '9DC-RENF', 'Prestation 9DC', now())`,
  );
});

afterAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "prestation" WHERE "id" = '${PRESTATION}'`,
  );
});

/** Une intervention jetable, clonée du décor de `INTERVENTION_A1`, affectée à `technicienId`. */
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
      `DELETE FROM "segment_travail" WHERE "intervention_id" = '${id}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "document" WHERE "intervention_id" = '${id}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention_signature" WHERE "intervention_id" = '${id}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention_prestation" WHERE "intervention_id" = '${id}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = '${id}'`,
    );
  }
});

function photo(empreinte: string) {
  return {
    classe: "client" as const,
    libelle: "Photo 9DC",
    nom_fichier: "photo.jpg",
    type_mime: "image/jpeg",
    objet: {
      objetCle: `test/${uuidv7()}.jpg`,
      empreinte,
      tailleOctets: 1024,
    },
  };
}

describe("le renfort est REFUSÉ sur le rapport d'une intervention d'un collègue", () => {
  it("rapport, prestations, signature, photo : rien ne s'écrit", async () => {
    const id = await jetable(COLLEGUE);

    const rapport = await enregistrerRapportTexte(
      SESSION_TECH,
      id,
      { commentaire_technicien: "détourné", suite_a_donner: null },
      clientApp(),
    );
    expect(rapport).toBeNull();

    const prestations = await definirPrestationsRealisees(
      SESSION_TECH,
      id,
      [PRESTATION],
      clientApp(),
    );
    expect(prestations).toBeNull();

    const signature = await enregistrerSignature(
      SESSION_TECH,
      id,
      {
        issue: "signee",
        image_base64: "data:image/png;base64,AAAA",
        signataire_nom: "X",
      },
      clientApp(),
    );
    expect(signature).toBeNull();

    const depotPhoto = await deposerPhotoIntervention(
      SESSION_TECH,
      id,
      photo("d".repeat(64)),
      clientApp(),
    );
    expect(depotPhoto).toBeNull();

    // RIEN N'A ÉTÉ ÉCRIT — lu sous le propriétaire, hors RLS.
    const [ligne] = await clientOwner().$queryRawUnsafe<
      Array<{ commentaire_technicien: string | null }>
    >(
      `SELECT "commentaire_technicien" FROM "intervention" WHERE "id" = '${id}'`,
    );
    expect(ligne?.commentaire_technicien).toBeNull();

    const [{ n: nPrestations }] = await clientOwner().$queryRawUnsafe<
      Array<{ n: bigint }>
    >(
      `SELECT count(*) AS "n" FROM "intervention_prestation" WHERE "intervention_id" = '${id}'`,
    );
    expect(Number(nPrestations)).toBe(0);

    const [{ n: nSignatures }] = await clientOwner().$queryRawUnsafe<
      Array<{ n: bigint }>
    >(
      `SELECT count(*) AS "n" FROM "intervention_signature" WHERE "intervention_id" = '${id}'`,
    );
    expect(Number(nSignatures)).toBe(0);

    const [{ n: nDocuments }] = await clientOwner().$queryRawUnsafe<
      Array<{ n: bigint }>
    >(
      `SELECT count(*) AS "n" FROM "document" WHERE "intervention_id" = '${id}'`,
    );
    expect(Number(nDocuments)).toBe(0);
  });
});

describe("le technicien AFFECTÉ écrit sur SA PROPRE intervention", () => {
  it("rapport, prestations, signature, photo : tout s'accepte", async () => {
    const id = await jetable(TECHNICIEN);

    const rapport = await enregistrerRapportTexte(
      SESSION_TECH,
      id,
      { commentaire_technicien: "Filtre changé", suite_a_donner: null },
      clientApp(),
    );
    expect(rapport).not.toBeNull();

    const prestations = await definirPrestationsRealisees(
      SESSION_TECH,
      id,
      [PRESTATION],
      clientApp(),
    );
    expect(prestations).not.toBeNull();

    const signature = await enregistrerSignature(
      SESSION_TECH,
      id,
      {
        issue: "signee",
        image_base64: "data:image/png;base64,BBBB",
        signataire_nom: "Y",
      },
      clientApp(),
    );
    expect(signature).not.toBeNull();

    const depotPhoto = await deposerPhotoIntervention(
      SESSION_TECH,
      id,
      photo("e".repeat(64)),
      clientApp(),
    );
    expect(depotPhoto).not.toBeNull();
  });
});

describe("le renfort pointe son temps même sur l'intervention d'un collègue", () => {
  it("démarrer puis arrêter le compteur : accepté — le compteur n'est pas scopé", async () => {
    const id = await jetable(COLLEGUE);

    const demarrage = await demarrerLeCompteur(
      SESSION_TECH,
      id,
      new Date("2026-09-14T08:00:00.000Z"),
      clientApp(),
    );
    expect(demarrage.accepte).toBe(true);

    const arret = await arreterLeCompteur(
      SESSION_TECH,
      new Date("2026-09-14T09:00:00.000Z"),
      clientApp(),
    );
    expect(arret.accepte).toBe(true);
  });
});

describe("le bureau (accès complet) écrit sur n'importe quelle intervention", () => {
  it("rapport, prestations, signature, photo : tout s'accepte, même sur l'intervention d'un technicien", async () => {
    const id = await jetable(COLLEGUE);

    const rapport = await enregistrerRapportTexte(
      SESSION_BUREAU,
      id,
      { commentaire_technicien: "Vu par le bureau", suite_a_donner: null },
      clientApp(),
    );
    expect(rapport).not.toBeNull();

    const prestations = await definirPrestationsRealisees(
      SESSION_BUREAU,
      id,
      [PRESTATION],
      clientApp(),
    );
    expect(prestations).not.toBeNull();

    const signature = await enregistrerSignature(
      SESSION_BUREAU,
      id,
      {
        issue: "signee",
        image_base64: "data:image/png;base64,CCCC",
        signataire_nom: "Z",
      },
      clientApp(),
    );
    expect(signature).not.toBeNull();

    const depotPhoto = await deposerPhotoIntervention(
      SESSION_BUREAU,
      id,
      photo("f".repeat(64)),
      clientApp(),
    );
    expect(depotPhoto).not.toBeNull();
  });
});

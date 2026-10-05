import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { compterClients, rechercherClients } from "@/lib/clients/depot";
import { schemaRechercheClient } from "@/lib/clients/saisie";
import {
  compterInterventions,
  listerInterventions,
} from "@/lib/interventions/depot";
import { schemaRechercheInterventions } from "@/lib/interventions/saisie";
import { compterLeParc, rechercherLeParc } from "@/lib/machines/depot";
import { schemaRechercheParc } from "@/lib/machines/saisie";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  AGENCE_B,
  MODELE_A,
  MODELE_B,
  SOCIETE_A,
  SOCIETE_B,
} from "./setup/fixtures";

/**
 * LES FILTRES DU LOT 9DT-TP-MOD2-INDICATEURS-DONNEES — ÉPROUVÉS SUR LA VRAIE
 * BASE (QT-20, QE-19, D170).
 *
 * **Le contrat de chaque chiffre** : `compterInterventions`/`compterLeParc`/
 * `compterClients` doivent rendre EXACTEMENT `.length` de la liste qu'ils
 * filtrent (§9, 01/09) — c'est la garantie que « Indicateurs du mois » et
 * « Données à compléter » tiennent, puisqu'ils composent ces mêmes fonctions.
 *
 * Toutes les fixtures sont créées ET supprimées par ce fichier, sous un
 * préfixe/marqueur dédié (`IND9DT`), jamais sur `CLIENT_A1`/`SITE_A1_S1` du
 * harnais partagé : `texte`/`client_id` scope chaque assertion à ces lignes
 * SEULES, indépendamment de toute autre donnée présente en base.
 */

afterAll(fermerClients);

const MARQUEUR = "IND9DT";
const TYPE_DEDIE = "recensement";

const CLIENT_IND_A = "aaaaaaaa-0000-7000-8000-00000000d9a1";
const SITE_IND_A = "aaaaaaaa-0000-7000-8000-00000000d9a2";
const CLIENT_IND_B = "bbbbbbbb-0000-7000-8000-00000000d9b1";
const SITE_IND_B = "bbbbbbbb-0000-7000-8000-00000000d9b2";

// LA FENÊTRE DU MOIS, EN INSTANTS VRAIS — distincte de toute autre fenêtre
// utilisée par un autre fichier d'isolation (export-interventions.test.ts
// prend 2097-07-07 ; celui-ci prend un autre mois).
const DEBUT_FENETRE = new Date("2097-09-01T00:00:00.000Z");
const FIN_FENETRE = new Date("2097-09-30T23:59:59.999Z");
const HORS_FENETRE = new Date("2097-08-15T12:00:00.000Z");

const idsInterventions: string[] = [];
const idsMachines: string[] = [];
const idsClients: string[] = [CLIENT_IND_A, CLIENT_IND_B];

beforeAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "client" ("id", "societe_id", "raison_sociale")
     VALUES ($1::uuid, $2::uuid, $3)`,
    CLIENT_IND_A,
    SOCIETE_A,
    `${MARQUEUR} Client A`,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "client" ("id", "societe_id", "raison_sociale")
     VALUES ($1::uuid, $2::uuid, $3)`,
    CLIENT_IND_B,
    SOCIETE_B,
    `${MARQUEUR} Client B`,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "site" ("id", "societe_id", "client_id", "agence_id", "libelle")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5)`,
    SITE_IND_A,
    SOCIETE_A,
    CLIENT_IND_A,
    AGENCE_A,
    `${MARQUEUR} Site A`,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "site" ("id", "societe_id", "client_id", "agence_id", "libelle")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5)`,
    SITE_IND_B,
    SOCIETE_B,
    CLIENT_IND_B,
    AGENCE_B,
    `${MARQUEUR} Site B`,
  );

  // ── Interventions : deux CRÉÉES dans la fenêtre, une HORS fenêtre, une
  //    CLÔTURÉE dans la fenêtre, une de la société B dans la fenêtre ──────
  const intervention = async (
    cree: Date,
    cloturee: Date | null,
    statut: string,
    societeId: string,
    clientId: string,
    siteId: string,
    agenceId: string,
  ): Promise<string> => {
    const [ligne] = await clientOwner().$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "cree_le", "cloturee_le", "modifie_le")
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, $4::uuid,
         $5::"TypeIntervention", $6::"StatutIntervention", $7::timestamptz,
         $8::timestamptz, now())
       RETURNING "id"`,
      societeId,
      clientId,
      siteId,
      agenceId,
      TYPE_DEDIE,
      statut,
      cree,
      cloturee,
    );
    return ligne!.id;
  };

  const creeeUne = await intervention(
    DEBUT_FENETRE,
    null,
    "a_planifier",
    SOCIETE_A,
    CLIENT_IND_A,
    SITE_IND_A,
    AGENCE_A,
  );
  const creeeDeux = await intervention(
    FIN_FENETRE,
    null,
    "a_planifier",
    SOCIETE_A,
    CLIENT_IND_A,
    SITE_IND_A,
    AGENCE_A,
  );
  const horsFenetre = await intervention(
    HORS_FENETRE,
    null,
    "a_planifier",
    SOCIETE_A,
    CLIENT_IND_A,
    SITE_IND_A,
    AGENCE_A,
  );
  const clotureeDansLaFenetre = await intervention(
    HORS_FENETRE,
    DEBUT_FENETRE,
    "cloturee",
    SOCIETE_A,
    CLIENT_IND_A,
    SITE_IND_A,
    AGENCE_A,
  );
  const societeBDansLaFenetre = await intervention(
    DEBUT_FENETRE,
    null,
    "a_planifier",
    SOCIETE_B,
    CLIENT_IND_B,
    SITE_IND_B,
    AGENCE_B,
  );
  idsInterventions.push(
    creeeUne,
    creeeDeux,
    horsFenetre,
    clotureeDansLaFenetre,
    societeBDansLaFenetre,
  );

  // ── Machines : deux AJOUTÉES (origine terrain) dans la fenêtre, une HORS
  //    fenêtre, une d'une AUTRE origine dans la fenêtre, une INCOMPLÈTE,
  //    une de la société B dans la fenêtre ───────────────────────────────
  const machine = async (
    cree: Date,
    origine: string,
    complet: boolean,
    numeroSerie: string,
    qrToken: string,
    societeId: string,
    modeleId: string,
    clientId: string,
    siteId: string,
  ): Promise<string> => {
    const [ligne] = await clientOwner().$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO "machine"
         ("id", "societe_id", "modele_id", "client_id", "site_id",
          "qr_token", "numero_serie", "source_creation", "complet",
          "cree_le", "modifie_le")
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, $4::uuid,
         $5, $6, $7::"SourceCreationMachine", $8, $9::timestamptz, now())
       RETURNING "id"`,
      societeId,
      modeleId,
      clientId,
      siteId,
      qrToken,
      numeroSerie,
      origine,
      complet,
      cree,
    );
    return ligne!.id;
  };

  const ajouteeUne = await machine(
    DEBUT_FENETRE,
    "terrain",
    true,
    `${MARQUEUR}-SN-1`,
    `${MARQUEUR}-QR-1`,
    SOCIETE_A,
    MODELE_A,
    CLIENT_IND_A,
    SITE_IND_A,
  );
  const ajouteeDeux = await machine(
    FIN_FENETRE,
    "terrain",
    true,
    `${MARQUEUR}-SN-2`,
    `${MARQUEUR}-QR-2`,
    SOCIETE_A,
    MODELE_A,
    CLIENT_IND_A,
    SITE_IND_A,
  );
  const machineHorsFenetre = await machine(
    HORS_FENETRE,
    "terrain",
    true,
    `${MARQUEUR}-SN-3`,
    `${MARQUEUR}-QR-3`,
    SOCIETE_A,
    MODELE_A,
    CLIENT_IND_A,
    SITE_IND_A,
  );
  const autreOrigine = await machine(
    DEBUT_FENETRE,
    "import",
    true,
    `${MARQUEUR}-SN-4`,
    `${MARQUEUR}-QR-4`,
    SOCIETE_A,
    MODELE_A,
    CLIENT_IND_A,
    SITE_IND_A,
  );
  const incomplete = await machine(
    HORS_FENETRE,
    "back_office",
    false,
    `${MARQUEUR}-SN-5`,
    `${MARQUEUR}-QR-5`,
    SOCIETE_A,
    MODELE_A,
    CLIENT_IND_A,
    SITE_IND_A,
  );
  const machineSocieteB = await machine(
    DEBUT_FENETRE,
    "terrain",
    true,
    `${MARQUEUR}-SN-6`,
    `${MARQUEUR}-QR-6`,
    SOCIETE_B,
    MODELE_B,
    CLIENT_IND_B,
    SITE_IND_B,
  );
  idsMachines.push(
    ajouteeUne,
    ajouteeDeux,
    machineHorsFenetre,
    autreOrigine,
    incomplete,
    machineSocieteB,
  );
});

afterAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "id" = ANY($1::uuid[])`,
    idsInterventions,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "machine" WHERE "id" = ANY($1::uuid[])`,
    idsMachines,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "site" WHERE "id" = ANY($1::uuid[])`,
    [SITE_IND_A, SITE_IND_B],
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "client" WHERE "id" = ANY($1::uuid[])`,
    idsClients,
  );
});

const INTERNE_A = {
  utilisateurId: "aaaaaaaa-0000-7000-8000-00000000f0e1",
  societeId: SOCIETE_A,
  role: Role.admin_societe,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};
const INTERNE_B = { ...INTERNE_A, societeId: SOCIETE_B };

describe("le registre des interventions filtre par création et par clôture (QT-20, D170)", () => {
  const criteresCreees = schemaRechercheInterventions.parse({
    texte: MARQUEUR,
    type: TYPE_DEDIE,
    cree_du: DEBUT_FENETRE,
    cree_au: FIN_FENETRE,
  });

  it("le décompte est EXACTEMENT la longueur de la liste qu'il ouvre", async () => {
    const [total, lignes] = await Promise.all([
      compterInterventions(INTERNE_A, criteresCreees, clientApp()),
      listerInterventions(INTERNE_A, criteresCreees, clientApp()),
    ]);
    expect(total).toBe(lignes.length);
    expect(total).toBe(2);
  });

  it("la fiche hors fenêtre n'entre pas dans le décompte", async () => {
    const lignes = await listerInterventions(
      INTERNE_A,
      criteresCreees,
      clientApp(),
    );
    expect(lignes.map((l) => l.id)).toEqual(
      expect.arrayContaining([idsInterventions[0], idsInterventions[1]]),
    );
    expect(lignes.map((l) => l.id)).not.toContain(idsInterventions[2]);
  });

  it("la société B n'apparaît jamais dans le décompte de la société A", async () => {
    const total = await compterInterventions(
      INTERNE_A,
      criteresCreees,
      clientApp(),
    );
    expect(total).toBe(2);
  });

  it("la société B compte sa propre fiche créée dans la fenêtre, et elle seule", async () => {
    const lignes = await listerInterventions(
      INTERNE_B,
      criteresCreees,
      clientApp(),
    );
    expect(lignes.map((l) => l.id)).toEqual([idsInterventions[4]]);
  });

  it("le filtre de clôture compte la fiche clôturée dans la fenêtre, pas celle créée", async () => {
    const criteresCloturees = schemaRechercheInterventions.parse({
      texte: MARQUEUR,
      type: TYPE_DEDIE,
      cloturee_du: DEBUT_FENETRE,
      cloturee_au: FIN_FENETRE,
    });
    const [total, lignes] = await Promise.all([
      compterInterventions(INTERNE_A, criteresCloturees, clientApp()),
      listerInterventions(INTERNE_A, criteresCloturees, clientApp()),
    ]);
    expect(total).toBe(1);
    expect(lignes.map((l) => l.id)).toEqual([idsInterventions[3]]);
  });
});

describe("le parc filtre par ajout au parc, par origine et par complétude (QT-20, MO-7, D170)", () => {
  const criteresAjoutees = schemaRechercheParc.parse({
    texte: MARQUEUR,
    origine: "terrain",
    ajoutee_du: DEBUT_FENETRE,
    ajoutee_au: FIN_FENETRE,
  });

  it("le décompte est EXACTEMENT la longueur de la liste qu'il ouvre", async () => {
    const [total, lignes] = await Promise.all([
      compterLeParc(INTERNE_A, criteresAjoutees, clientApp()),
      rechercherLeParc(INTERNE_A, criteresAjoutees, clientApp()),
    ]);
    expect(total).toBe(lignes.length);
    expect(total).toBe(2);
    expect(lignes.map((l) => l.id)).toEqual(
      expect.arrayContaining([idsMachines[0], idsMachines[1]]),
    );
  });

  it("une autre origine, dans la même fenêtre, n'entre pas dans le décompte", async () => {
    const lignes = await rechercherLeParc(
      INTERNE_A,
      criteresAjoutees,
      clientApp(),
    );
    expect(lignes.map((l) => l.id)).not.toContain(idsMachines[3]);
  });

  it("la société B compte sa propre machine ajoutée dans la fenêtre, et elle seule", async () => {
    const lignes = await rechercherLeParc(
      INTERNE_B,
      criteresAjoutees,
      clientApp(),
    );
    expect(lignes.map((l) => l.id)).toEqual([idsMachines[5]]);
  });

  it("le filtre « incomplètes » compte exactement la fiche marquée incomplète", async () => {
    const criteresIncompletes = schemaRechercheParc.parse({
      texte: MARQUEUR,
      incompletes: "1",
    });
    const [total, lignes] = await Promise.all([
      compterLeParc(INTERNE_A, criteresIncompletes, clientApp()),
      rechercherLeParc(INTERNE_A, criteresIncompletes, clientApp()),
    ]);
    expect(total).toBe(1);
    expect(lignes.map((l) => l.id)).toEqual([idsMachines[4]]);
  });
});

describe("les clients filtrent par absence de code externe (QT-20, D170)", () => {
  it("le décompte est EXACTEMENT la longueur de la liste qu'il ouvre, et la société B en reste absente", async () => {
    const criteres = schemaRechercheClient.parse({
      texte: MARQUEUR,
      sans_code_externe: "1",
    });
    const [total, lignes] = await Promise.all([
      compterClients(INTERNE_A, criteres, clientApp()),
      rechercherClients(INTERNE_A, criteres, clientApp()),
    ]);
    expect(total).toBe(lignes.length);
    expect(total).toBe(1);
    expect(lignes.map((l) => l.id)).toEqual([CLIENT_IND_A]);
  });

  it("la société B compte sa propre fiche sans code externe, et elle seule", async () => {
    const criteres = schemaRechercheClient.parse({
      texte: MARQUEUR,
      sans_code_externe: "1",
    });
    const lignes = await rechercherClients(INTERNE_B, criteres, clientApp());
    expect(lignes.map((l) => l.id)).toEqual([CLIENT_IND_B]);
  });
});

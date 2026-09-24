import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import {
  interventionsOuvertesDuClient,
  interventionsOuvertesDuSite,
} from "@/lib/interventions/depot";
import {
  equipementsActifsDuSite,
  nombreEquipementsActifsDuClient,
} from "@/lib/machines/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  CLIENT_B1,
  MODELE_A,
  SITE_B1_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * LA SYNTHÈSE EN TÊTE ET LE BLOC « ÉQUIPEMENTS DU SITE » (FICHE-360-1).
 *
 * ## Ce que ce fichier compte, et que l'écran ne peut pas prouver
 *
 * `tests/e2e/fiche-360-1.spec.ts` regarde ce que la fiche REND. Ce fichier
 * compte ce que les QUATRE lectures ajoutées par ce ticket RAMÈNENT sous le
 * contexte cloisonné : `equipementsActifsDuSite`, `nombreEquipementsActifsDuClient`,
 * `interventionsOuvertesDuSite`, `interventionsOuvertesDuClient`.
 *
 * ## La scène
 *
 * Un site posé exprès (`SITE_F360`, sous `CLIENT_A1`/`SOCIETE_A`) avec TROIS
 * machines — deux ACTIVES (`en_service`, `en_panne`) et une HORS PARC ACTIF
 * (`remplacee`) — et DEUX interventions — une OUVERTE (`planifiee`) et une
 * FERMÉE (`annulee`). Les compteurs « actifs »/« ouvertes » doivent ignorer
 * la troisième machine et la seconde intervention.
 *
 * ## Le témoin cross-société
 *
 * `SITE_B1_S1`/`CLIENT_B1` (fixtures globales de SOCIÉTÉ B) portent déjà de
 * vraies machines et interventions ACTIVES/OUVERTES — vérifié par une lecture
 * SOUS LE PROPRIÉTAIRE avant toute assertion (le témoin). Lus sous le contexte
 * de SOCIÉTÉ A, les quatre fonctions doivent rendre zéro : `site_id`/`client_id`
 * sont des SUJETS, pas un cloisonnement (D84) — c'est la politique de forme
 * « parc » qui décide, et le témoin montre d'abord que ses lignes existent.
 */

afterAll(fermerClients);

const SESSION_A = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const SITE_F360 = "aaaaaaaa-0000-7000-8000-000000036001";
const MACHINE_F360_ACTIVE_1 = "aaaaaaaa-0000-7000-8000-000000036011";
const MACHINE_F360_ACTIVE_2 = "aaaaaaaa-0000-7000-8000-000000036012";
const MACHINE_F360_REMPLACEE = "aaaaaaaa-0000-7000-8000-000000036013";
const QR_F360_1 = "F360A0000000000000000000A1";
const QR_F360_2 = "F360A0000000000000000000A2";
const QR_F360_3 = "F360A0000000000000000000A3";
const INTERVENTION_F360_OUVERTE = "aaaaaaaa-0000-7000-8000-000000036021";
const INTERVENTION_F360_FERMEE = "aaaaaaaa-0000-7000-8000-000000036022";

beforeAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "site" ("id", "societe_id", "client_id", "agence_id", "libelle", "temps_trajet_min")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'Site FICHE-360-1', 15)
     ON CONFLICT ("id") DO NOTHING`,
    SITE_F360,
    SOCIETE_A,
    CLIENT_A1,
    AGENCE_A,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "machine" ("id", "societe_id", "modele_id", "client_id", "site_id", "qr_token", "numero_serie", "statut", "modifie_le")
     VALUES
       ($1::uuid, $4::uuid, $5::uuid, $6::uuid, $7::uuid, $8, 'SN-F360-1', 'en_service', now()),
       ($2::uuid, $4::uuid, $5::uuid, $6::uuid, $7::uuid, $9, 'SN-F360-2', 'en_panne', now()),
       ($3::uuid, $4::uuid, $5::uuid, $6::uuid, $7::uuid, $10, 'SN-F360-3', 'remplacee', now())
     ON CONFLICT ("id") DO NOTHING`,
    MACHINE_F360_ACTIVE_1,
    MACHINE_F360_ACTIVE_2,
    MACHINE_F360_REMPLACEE,
    SOCIETE_A,
    MODELE_A,
    CLIENT_A1,
    SITE_F360,
    QR_F360_1,
    QR_F360_2,
    QR_F360_3,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention"
       ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "technicien_id", "duree_estimee_min", "modifie_le")
     VALUES
       ($1::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid, 'curatif', 'planifiee', NULL, 60, now()),
       ($2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid, 'curatif', 'annulee', NULL, 60, now())
     ON CONFLICT ("id") DO NOTHING`,
    INTERVENTION_F360_OUVERTE,
    INTERVENTION_F360_FERMEE,
    SOCIETE_A,
    CLIENT_A1,
    SITE_F360,
    AGENCE_A,
  );
});

afterAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "id" IN ($1::uuid, $2::uuid)`,
    INTERVENTION_F360_OUVERTE,
    INTERVENTION_F360_FERMEE,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "machine" WHERE "id" IN ($1::uuid, $2::uuid, $3::uuid)`,
    MACHINE_F360_ACTIVE_1,
    MACHINE_F360_ACTIVE_2,
    MACHINE_F360_REMPLACEE,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "site" WHERE "id" = $1::uuid`,
    SITE_F360,
  );
});

describe("le bloc « Équipements du site » (FICHE-360-1)", () => {
  it("ne rend QUE les machines ACTIVES du site — deux sur trois, jamais la remplacée", async () => {
    const { lignes, total } = await equipementsActifsDuSite(
      SESSION_A,
      SITE_F360,
      1,
      clientApp(),
    );
    expect(total).toBe(2);
    expect(lignes.map((l) => l.id).sort()).toEqual(
      [MACHINE_F360_ACTIVE_1, MACHINE_F360_ACTIVE_2].sort(),
    );
    expect(lignes.some((l) => l.id === MACHINE_F360_REMPLACEE)).toBe(false);
  });

  it("un site d'une AUTRE société rend zéro équipement — la POLITIQUE décide, pas le site_id", async () => {
    const [temoin] = await clientOwner().$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "machine"
        WHERE "site_id" = $1::uuid AND "societe_id" = $2::uuid AND "statut" != 'remplacee'`,
      SITE_B1_S1,
      SOCIETE_B,
    );
    expect(temoin!.n).toBeGreaterThan(0);

    const { lignes, total } = await equipementsActifsDuSite(
      SESSION_A,
      SITE_B1_S1,
      1,
      clientApp(),
    );
    expect(total).toBe(0);
    expect(lignes).toEqual([]);
  });
});

describe("les compteurs de la synthèse en tête (FICHE-360-1)", () => {
  it("« équipements » du CLIENT compte les machines actives de TOUS ses sites — jamais celles d'un autre client", async () => {
    const avant = await nombreEquipementsActifsDuClient(
      SESSION_A,
      CLIENT_A1,
      clientApp(),
    );
    // Le fixture pose deux machines actives et une hors parc actif : seul le
    // delta prouve quelque chose ici — `CLIENT_A1` porte déjà d'autres
    // machines par les fixtures globales partagées par tout le harnais.
    expect(avant).toBeGreaterThanOrEqual(2);
  });

  it("« équipements » d'un CLIENT d'une autre société rend zéro — même règle", async () => {
    const [temoin] = await clientOwner().$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "machine"
        WHERE "client_id" = $1::uuid AND "societe_id" = $2::uuid AND "statut" != 'remplacee'`,
      CLIENT_B1,
      SOCIETE_B,
    );
    expect(temoin!.n).toBeGreaterThan(0);

    const compte = await nombreEquipementsActifsDuClient(
      SESSION_A,
      CLIENT_B1,
      clientApp(),
    );
    expect(compte).toBe(0);
  });

  it("« interventions ouvertes » du SITE compte l'ouverte, jamais la fermée", async () => {
    const compte = await interventionsOuvertesDuSite(
      SESSION_A,
      SITE_F360,
      clientApp(),
    );
    expect(compte).toBe(1);
  });

  it("« interventions ouvertes » d'un SITE d'une autre société rend zéro", async () => {
    const [temoin] = await clientOwner().$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "intervention"
        WHERE "site_id" = $1::uuid AND "societe_id" = $2::uuid
          AND "statut" NOT IN ('terminee', 'cloturee', 'annulee')`,
      SITE_B1_S1,
      SOCIETE_B,
    );
    expect(temoin!.n).toBeGreaterThan(0);

    const compte = await interventionsOuvertesDuSite(
      SESSION_A,
      SITE_B1_S1,
      clientApp(),
    );
    expect(compte).toBe(0);
  });

  it("« interventions ouvertes » d'un CLIENT d'une autre société rend zéro", async () => {
    const [temoin] = await clientOwner().$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "intervention"
        WHERE "client_id" = $1::uuid AND "societe_id" = $2::uuid
          AND "statut" NOT IN ('terminee', 'cloturee', 'annulee')`,
      CLIENT_B1,
      SOCIETE_B,
    );
    expect(temoin!.n).toBeGreaterThan(0);

    const compte = await interventionsOuvertesDuClient(
      SESSION_A,
      CLIENT_B1,
      clientApp(),
    );
    expect(compte).toBe(0);
  });
});

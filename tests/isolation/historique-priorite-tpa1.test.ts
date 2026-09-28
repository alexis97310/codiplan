import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import {
  dernieresInterventionsDuClient,
  dernieresInterventionsDuSite,
} from "@/lib/interventions/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { AGENCE_A, SOCIETE_A, UTILISATEUR_INTERNE_A } from "./setup/fixtures";

/**
 * L'ORDRE DE L'HISTORIQUE D'UN SITE ET D'UN CLIENT, LES OUVERTES SANS DATE
 * EN TÊTE (9BL-TP-A1-HISTORIQUES-CLIENT-SITE — décision d'Alexis du
 * 28/09/2026, ~20h10 NC, audit du 28/09, CS29/CS9).
 *
 * ## Ce que `historique-site-borne.test.ts`/`historique-client-pagination.test.ts`
 * ne peuvent pas montrer
 *
 * Leurs scènes ne portent que des interventions sans date de MÊME priorité
 * (p3, le défaut) : elles prouvent que le groupe de tête existe et qu'il
 * ferme sur `id`, jamais que l'URGENCE le range. Ce fichier pose une scène à
 * lui — `CLIENT_TPA1`, `SITE_TPA1` — avec DEUX ouvertes sans date de
 * priorités DIFFÉRENTES et UNE fermée (`annulee`) sans date : la première
 * propriété que ce fichier mesure est que l'urgence décide, la seconde que
 * `annulee` ne rejoint JAMAIS le groupe de tête, quelle que soit sa date
 * (absente, ici).
 *
 * ## La scène — jamais partagée
 *
 * Un client et son site, prefixés `TPA1-`, créés et détruits par ce fichier
 * seul (piège connu des exécutions parallèles) : treize interventions
 * DATÉES, une par an à partir de 2090, deux OUVERTES sans date (`p4` insérée
 * en premier, `p1` ensuite — l'ordre d'INSERTION ne doit RIEN décider), une
 * FERMÉE (`annulee`) sans date.
 */

afterAll(fermerClients);

const SESSION = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const CLIENT_TPA1 = "aaaaaaaa-0000-7000-8000-00000009a2fe";
const SITE_TPA1 = "aaaaaaaa-0000-7000-8000-00000009a1ff";
const DATEES = 13;

function idDatee(rang: number): string {
  return `aaaaaaaa-0000-7000-8000-00000009a1${String(rang).padStart(2, "0")}`;
}
const ID_OUVERTE_P4 = "aaaaaaaa-0000-7000-8000-00000009a1e4";
const ID_OUVERTE_P1 = "aaaaaaaa-0000-7000-8000-00000009a1e1";
const ID_FERMEE_SANS_DATE = "aaaaaaaa-0000-7000-8000-00000009a1ea";

const TOTAL = DATEES + 3;

/** Une date par an à partir de 2090 — hors de portée de tout comptage daté réel. */
function dateDuRang(rang: number): string {
  return `${2090 + rang}-01-01`;
}

/**
 * L'ORDRE ATTENDU : d'abord `p1` puis `p4` (l'urgence, jamais l'insertion),
 * ensuite les treize datées de la plus récente à la plus ancienne, et enfin
 * la fermée sans date — qui n'entre JAMAIS dans le groupe de tête.
 */
const ORDRE_ATTENDU: readonly string[] = [
  ID_OUVERTE_P1,
  ID_OUVERTE_P4,
  ...Array.from({ length: DATEES }, (_, r) => idDatee(DATEES - 1 - r)),
  ID_FERMEE_SANS_DATE,
];

beforeAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "client" ("id", "societe_id", "raison_sociale", "code_externe")
     VALUES ($1::uuid, $2::uuid, 'TPA1- Client de la priorité', NULL)
     ON CONFLICT ("id") DO NOTHING`,
    CLIENT_TPA1,
    SOCIETE_A,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "site" ("id", "societe_id", "client_id", "agence_id", "libelle", "temps_trajet_min")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'TPA1- Site de la priorité', 15)
     ON CONFLICT ("id") DO NOTHING`,
    SITE_TPA1,
    SOCIETE_A,
    CLIENT_TPA1,
    AGENCE_A,
  );
  for (let rang = 0; rang < DATEES; rang += 1) {
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "technicien_id", "date_planifiee", "duree_estimee_min", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'planifiee', NULL, $6::date, 60, now())
       ON CONFLICT ("id") DO NOTHING`,
      idDatee(rang),
      SOCIETE_A,
      CLIENT_TPA1,
      SITE_TPA1,
      AGENCE_A,
      dateDuRang(rang),
    );
  }
  // `p4` D'ABORD, `p1` ENSUITE — si l'ordre rendu suivait l'insertion plutôt
  // que l'urgence, cette scène le révélerait immédiatement.
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention"
       ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "priorite", "technicien_id", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'a_planifier', 'p4', NULL, now())
     ON CONFLICT ("id") DO NOTHING`,
    ID_OUVERTE_P4,
    SOCIETE_A,
    CLIENT_TPA1,
    SITE_TPA1,
    AGENCE_A,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention"
       ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "priorite", "technicien_id", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'a_planifier', 'p1', NULL, now())
     ON CONFLICT ("id") DO NOTHING`,
    ID_OUVERTE_P1,
    SOCIETE_A,
    CLIENT_TPA1,
    SITE_TPA1,
    AGENCE_A,
  );
  // FERMÉE SANS DATE — le cas que le piège connu (§9) nomme : un `ORDER BY
  // date_planifiee DESC` nu la mettrait en tête aussi bien qu'une ouverte.
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention"
       ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "technicien_id", "duree_estimee_min", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'annulee', NULL, 60, now())
     ON CONFLICT ("id") DO NOTHING`,
    ID_FERMEE_SANS_DATE,
    SOCIETE_A,
    CLIENT_TPA1,
    SITE_TPA1,
    AGENCE_A,
  );
});

afterAll(async () => {
  for (let rang = 0; rang < DATEES; rang += 1) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
      idDatee(rang),
    );
  }
  for (const id of [ID_OUVERTE_P4, ID_OUVERTE_P1, ID_FERMEE_SANS_DATE]) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
      id,
    );
  }
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "site" WHERE "id" = $1::uuid`,
    SITE_TPA1,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "client" WHERE "id" = $1::uuid`,
    CLIENT_TPA1,
  );
});

async function temoinDeLaScene(): Promise<void> {
  const [ligne] = await clientOwner().$queryRawUnsafe<Array<{ total: number }>>(
    `SELECT count(*)::int AS total FROM "intervention" WHERE "site_id" = $1::uuid`,
    SITE_TPA1,
  );
  expect(ligne?.total).toBe(TOTAL);
}

describe("l'ordre de l'historique d'un site — urgence puis ancienneté (TP-A1)", () => {
  it("la lecture COMPLÈTE rend p1, p4, les treize datées (récence), puis la fermée sans date", async () => {
    await temoinDeLaScene();
    const tout = await dernieresInterventionsDuSite(
      SESSION,
      SITE_TPA1,
      TOTAL + 5,
      clientApp(),
    );
    expect(tout.map((l) => l.id)).toEqual(ORDRE_ATTENDU);
  });

  it("une lecture bornée à DEUX rend p1 puis p4 — jamais une datée, jamais la fermée", async () => {
    await temoinDeLaScene();
    const tete = await dernieresInterventionsDuSite(
      SESSION,
      SITE_TPA1,
      2,
      clientApp(),
    );
    expect(tete.map((l) => l.id)).toEqual([ID_OUVERTE_P1, ID_OUVERTE_P4]);
  });

  it("une lecture bornée à TROIS ajoute la datée la plus RÉCENTE, jamais la fermée sans date", async () => {
    await temoinDeLaScene();
    const tete = await dernieresInterventionsDuSite(
      SESSION,
      SITE_TPA1,
      3,
      clientApp(),
    );
    expect(tete.map((l) => l.id)).toEqual([
      ID_OUVERTE_P1,
      ID_OUVERTE_P4,
      idDatee(DATEES - 1),
    ]);
  });
});

describe("l'ordre de l'historique d'un client, PAGINÉ — urgence puis ancienneté (TP-A1)", () => {
  it("PAGE 1 : p1 et p4 OUVRENT la page, avant toute datée", async () => {
    await temoinDeLaScene();
    const page1 = await dernieresInterventionsDuClient(
      SESSION,
      CLIENT_TPA1,
      5,
      1,
      clientApp(),
    );
    expect(page1.map((l) => l.id)).toEqual(ORDRE_ATTENDU.slice(0, 5));
  });

  it("la pagination TRAVERSE la frontière tête/reste sans doublon ni trou", async () => {
    await temoinDeLaScene();
    // `limite=1` isole chaque rang : la page 1 est p1, la page 2 est p4, la
    // page 3 est la datée la plus récente — le groupe de tête (deux lignes)
    // épuisé exactement à la frontière que compte `compteEnTete`.
    const page1 = await dernieresInterventionsDuClient(
      SESSION,
      CLIENT_TPA1,
      1,
      1,
      clientApp(),
    );
    const page2 = await dernieresInterventionsDuClient(
      SESSION,
      CLIENT_TPA1,
      1,
      2,
      clientApp(),
    );
    const page3 = await dernieresInterventionsDuClient(
      SESSION,
      CLIENT_TPA1,
      1,
      3,
      clientApp(),
    );
    expect(page1.map((l) => l.id)).toEqual([ID_OUVERTE_P1]);
    expect(page2.map((l) => l.id)).toEqual([ID_OUVERTE_P4]);
    expect(page3.map((l) => l.id)).toEqual([idDatee(DATEES - 1)]);
  });

  it("LA DERNIÈRE PAGE porte la fermée sans date, et elle seule", async () => {
    await temoinDeLaScene();
    const derniere = await dernieresInterventionsDuClient(
      SESSION,
      CLIENT_TPA1,
      1,
      TOTAL,
      clientApp(),
    );
    expect(derniere.map((l) => l.id)).toEqual([ID_FERMEE_SANS_DATE]);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import {
  instantDuJour,
  jourDe,
  jourSuivant,
  maintenant,
} from "@/lib/calendar/fuseau";
import { compterParVue } from "@/lib/interventions/depot";
import { enRetard } from "@/lib/interventions/retard";
import {
  schemaRechercheInterventions,
  TYPES_INTERVENTION,
} from "@/lib/interventions/saisie";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  FUSEAU_SOCIETE_A,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * LA TUILE « EN RETARD » DU TABLEAU DE BORD, SUR LA VRAIE TABLE
 * (PG-C1b-EN-RETARD-TABLEAU, bug 8 de l'audit d'ergonomie du 27/09/2026,
 * §4.1, CA-5).
 *
 * La tuile lit `comptesRegistre.en_retard` — le MÊME `compterParVue` que la
 * tuile « Dossiers bloqués » et que l'onglet « En retard » du registre
 * (PG-C1c-EN-RETARD-REGISTRE, `tests/isolation/ecran-intervention.test.ts`).
 * Ce fichier n'éprouve donc pas une seconde traduction du critère — il n'y en
 * a qu'une —, mais l'ÉGALITÉ entre ce que `compterParVue` rend et ce que la
 * fonction pure `enRetard` calcule sur les MÊMES données, forgées ici,
 * préfixe `PGC1B-`.
 */

afterAll(fermerClients);

const INTERNE_A = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const PGC1B_EN_RETARD = "aaaaaaaa-0000-7000-8000-00000000af30";
const AUJOURDHUI_LOCAL = jourDe(maintenant(FUSEAU_SOCIETE_A).local);
const HIER = instantDuJour(jourSuivant(AUJOURDHUI_LOCAL, -1))
  .toISOString()
  .slice(0, 10);

let typeAbsent: (typeof TYPES_INTERVENTION)[number];

beforeAll(async () => {
  const presents = await clientOwner().$queryRawUnsafe<{ type: string }[]>(
    `SELECT DISTINCT type FROM "intervention" WHERE societe_id = $1::uuid`,
    SOCIETE_A,
  );
  const typesPresents = new Set(presents.map((p) => p.type));
  const trouve = TYPES_INTERVENTION.find((type) => !typesPresents.has(type));
  expect(
    trouve,
    "tous les types sont présents sur la société A : aucun témoin d'absence n'est possible",
  ).toBeDefined();
  typeAbsent = trouve as (typeof TYPES_INTERVENTION)[number];

  // AFFECTÉE, datée d'hier, aucun segment de travail — en retard.
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention"
       ("id","societe_id","client_id","site_id","agence_id","type","statut","technicien_id","date_planifiee","duree_estimee_min","modifie_le")
     VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::"TypeIntervention",'affectee',NULL,$7::date,60,now())
     ON CONFLICT ("id") DO NOTHING`,
    PGC1B_EN_RETARD,
    SOCIETE_A,
    CLIENT_A1,
    SITE_A1_S1,
    AGENCE_A,
    typeAbsent,
    HIER,
  );
});

afterAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
    PGC1B_EN_RETARD,
  );
});

describe("la tuile « En retard » — comptée par compterParVue, EXACTEMENT ce qu'enRetard calcule", () => {
  it("compterParVue.en_retard vaut 1, sur ce jeu créé par le test", async () => {
    const comptes = await compterParVue(
      INTERNE_A,
      schemaRechercheInterventions.parse({ type: typeAbsent }),
      clientApp(),
    );
    expect(comptes.en_retard).toBe(1);
  });

  it("l'égalité avec la fonction pure — mêmes données, même verdict", () => {
    expect(
      enRetard(
        {
          statut: "affectee",
          datePlanifiee: new Date(HIER),
          aDesSegments: false,
        },
        AUJOURDHUI_LOCAL,
      ),
    ).toBe(true);
  });
});

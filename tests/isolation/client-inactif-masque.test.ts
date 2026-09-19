import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import {
  compterInterventions,
  listerInterventions,
  listerPlanning,
} from "@/lib/interventions/depot";
import { schemaRechercheInterventions } from "@/lib/interventions/saisie";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { AGENCE_A, SOCIETE_A, UTILISATEUR_INTERNE_A } from "./setup/fixtures";

/**
 * RG-PLA-08 (D129, arbitrage du 19/09/2026, direction d'exploitation) — LE
 * GARDIEN qui échoue si le filtre disparaît.
 *
 * Ni `INTERVENTION_A1`/`A2` ni leur `CLIENT_A1` ne conviennent ici : le
 * scénario a besoin d'un client INACTIF, et le harnais partagé n'en pose
 * aucun (c'est `CLIENT_A1`, actif, que tout le reste du fichier
 * `ecran-intervention.test.ts` mesure). Une fiche posée EXPRÈS — client, site
 * et intervention dédiés, comme `INTERVENTION_DEDIEE` le fait déjà pour le
 * type et le statut — rend la mesure indépendante du reste du harnais.
 *
 * `date_planifiee` reste `NULL` (file d'attente) : `listerPlanning` y rend
 * ses lignes sans condition de date, ce qui évite de calculer une fenêtre
 * pour l'atteindre.
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

const CLIENT_INACTIF = "aaaaaaaa-0000-7000-8000-00000000af08";
const SITE_DU_CLIENT_INACTIF = "aaaaaaaa-0000-7000-8000-00000000af09";
const INTERVENTION_DU_CLIENT_INACTIF = "aaaaaaaa-0000-7000-8000-00000000af0a";

beforeAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "client" ("id", "societe_id", "code_externe", "raison_sociale", "actif")
     VALUES ($1::uuid, $2::uuid, 'C-INACTIF', 'Client inactif du gardien RG-PLA-08', false)
     ON CONFLICT ("id") DO NOTHING`,
    CLIENT_INACTIF,
    SOCIETE_A,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "site" ("id", "societe_id", "client_id", "agence_id", "libelle")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'Site du client inactif')
     ON CONFLICT ("id") DO NOTHING`,
    SITE_DU_CLIENT_INACTIF,
    SOCIETE_A,
    CLIENT_INACTIF,
    AGENCE_A,
  );
  // `date_planifiee` n'est PAS posée : la ligne reste dans la file d'attente,
  // et `listerPlanning` la voit quelle que soit la fenêtre demandée.
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "technicien_id", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'a_planifier', NULL, now())
     ON CONFLICT ("id") DO NOTHING`,
    INTERVENTION_DU_CLIENT_INACTIF,
    SOCIETE_A,
    CLIENT_INACTIF,
    SITE_DU_CLIENT_INACTIF,
    AGENCE_A,
  );
});

afterAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
    INTERVENTION_DU_CLIENT_INACTIF,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "site" WHERE "id" = $1::uuid`,
    SITE_DU_CLIENT_INACTIF,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "client" WHERE "id" = $1::uuid`,
    CLIENT_INACTIF,
  );
});

describe("RG-PLA-08 (D129) — le client inactif sort du planning et du registre, par défaut", () => {
  it("le PLANNING ne rend jamais la ligne d'un client inactif", async () => {
    const du = new Date("2020-01-01");
    const au = new Date("2035-01-01");
    const lignes = await listerPlanning(INTERNE_A, du, au, clientApp());
    expect(lignes.map((l) => l.id)).not.toContain(
      INTERVENTION_DU_CLIENT_INACTIF,
    );
  });

  it("LE REGISTRE la tait par défaut, et la case « inclure les clients inactifs » la rend", async () => {
    const parDefaut = schemaRechercheInterventions.parse({});
    expect(parDefaut.inclure_clients_inactifs).toBe(false);

    const sansLaCase = await listerInterventions(
      INTERNE_A,
      parDefaut,
      clientApp(),
    );
    expect(sansLaCase.map((l) => l.id)).not.toContain(
      INTERVENTION_DU_CLIENT_INACTIF,
    );
    expect(
      await compterInterventions(INTERNE_A, parDefaut, clientApp()),
    ).not.toBe(
      await compterInterventions(
        INTERNE_A,
        schemaRechercheInterventions.parse({ inclure_clients_inactifs: "on" }),
        clientApp(),
      ),
    );

    const avecLaCase = schemaRechercheInterventions.parse({
      inclure_clients_inactifs: "on",
    });
    expect(avecLaCase.inclure_clients_inactifs).toBe(true);
    const ids = (
      await listerInterventions(INTERNE_A, avecLaCase, clientApp())
    ).map((l) => l.id);
    expect(ids).toContain(INTERVENTION_DU_CLIENT_INACTIF);
    expect(
      await compterInterventions(INTERNE_A, avecLaCase, clientApp()),
    ).toBeGreaterThan(
      await compterInterventions(INTERNE_A, parDefaut, clientApp()),
    );
  });

  it("un autre filtre coché à côté (« on ») n'active pas la case par erreur — seul « on » compte", async () => {
    const criteres = schemaRechercheInterventions.parse({
      inclure_clients_inactifs: "true",
    });
    // Une case DÉCOCHÉE ne soumet rien en HTML : seul `"on"` doit être
    // reconnu, jamais une autre chaîne qui ressemblerait à un booléen vrai.
    expect(criteres.inclure_clients_inactifs).toBe(false);
  });
});

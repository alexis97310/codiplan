import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { habilitationsRequisesParSite } from "@/lib/sites/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  PORTAIL_A_CLIENT,
  CLIENT_A1,
  SITE_A2_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * `habilitationsRequisesParSite` (PASTILLES-1, 23/09/2026) — la lecture
 * groupée qui alimente la pastille verte de la carte site.
 *
 * **Un site POSÉ PAR CE FICHIER, jamais `SITE_A1_S1`** — la leçon mesurée en
 * écrivant ce scénario : `SITE_A1_S1` reçoit des exigences transitoires d'AU
 * MOINS quatre autres fichiers d'isolation (`habilitations.test.ts`,
 * `pose-habilitation.test.ts`, `habilitations-referentiel.test.ts`,
 * `alimentation-habilitations.test.ts`), chacun posant puis retirant les
 * siennes ; y ajouter une exigence de plus et compter EXACTEMENT un rendrait
 * un nombre qui dépend de l'ordre d'exécution des fichiers, jamais un fait.
 * Un site propre à ce scénario n'a cette dépendance envers aucun autre fichier.
 */

const SITE_PASTILLES_1 = uuidv7();
const HABILITATION_PASTILLES_1 = uuidv7();
const EXIGENCE_PASTILLES_1 = uuidv7();

const INTERNE_A = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const PORTAIL_A1 = {
  utilisateurId: PORTAIL_A_CLIENT,
  societeId: SOCIETE_A,
  role: Role.client,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: CLIENT_A1,
};

beforeAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "site" ("id", "societe_id", "client_id", "agence_id", "libelle")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'Site de scénario PASTILLES-1')`,
    SITE_PASTILLES_1,
    SOCIETE_A,
    CLIENT_A1,
    AGENCE_A,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "habilitation" ("id", "societe_id", "code", "libelle")
     VALUES ($1::uuid, $2::uuid, 'PASTILLES-1', 'Habilitation de scénario')`,
    HABILITATION_PASTILLES_1,
    SOCIETE_A,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "site_habilitation_requise"
       ("id", "societe_id", "site_id", "habilitation_id", "bloquant")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, true)`,
    EXIGENCE_PASTILLES_1,
    SOCIETE_A,
    SITE_PASTILLES_1,
    HABILITATION_PASTILLES_1,
  );
});

afterAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "site_habilitation_requise" WHERE "id" = $1::uuid`,
    EXIGENCE_PASTILLES_1,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "habilitation" WHERE "id" = $1::uuid`,
    HABILITATION_PASTILLES_1,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "site" WHERE "id" = $1::uuid`,
    SITE_PASTILLES_1,
  );
  await fermerClients();
});

describe("habilitationsRequisesParSite (PASTILLES-1)", () => {
  it("compte la ligne posée sur le site du scénario, et rend un site sans exigence absent", async () => {
    const comptes = await habilitationsRequisesParSite(
      INTERNE_A,
      [{ id: SITE_PASTILLES_1 }, { id: SITE_A2_S1 }],
      clientApp(),
    );
    expect(comptes.get(SITE_PASTILLES_1)).toBe(1);
    expect(comptes.get(SITE_A2_S1)).toBeUndefined();
  });

  it("un compte de PORTAIL restreint par PÉRIMÈTRE ne voit pas le site hors de ce périmètre (D10, D22)", async () => {
    // PORTAIL_A1 est restreint à SITE_A1_S1 (fixture globale) — le site de ce
    // scénario appartient au MÊME client (CLIENT_A1) mais n'est PAS dans ce
    // périmètre : c'est la branche que le filtre CLIENT seul ne sait pas
    // produire, et que le périmètre de sites doit fermer.
    const comptes = await habilitationsRequisesParSite(
      PORTAIL_A1,
      [{ id: SITE_PASTILLES_1 }, { id: SITE_A2_S1 }],
      clientApp(),
    );
    expect(comptes.get(SITE_PASTILLES_1)).toBeUndefined();
    expect(comptes.get(SITE_A2_S1)).toBeUndefined();
  });

  it("une liste de sites vide rend une table vide sans requête", async () => {
    expect(
      await habilitationsRequisesParSite(INTERNE_A, [], clientApp()),
    ).toEqual(new Map());
  });
});

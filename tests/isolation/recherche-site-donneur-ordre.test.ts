import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { destinataireClient } from "@/lib/avertissements/planification";
import { contactsDuClient } from "@/lib/contacts/depot";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * « QUI SERA PRÉVENU » (TP-UX5-1-FORMULAIRES, maquette du 28/09) —
 * `/api/recherche/site/[id]` compose désormais `donneurOrdre` EXACTEMENT
 * comme ce fichier : `contactsDuClient` puis `destinataireClient` (la MÊME
 * lecture déjà fournie à la liste des contacts du site, AVANT son filtre —
 * aucune lecture neuve). `destinataireClient` elle-même est déjà éprouvée en
 * pur (`tests/unit/avertissements/destinataire.test.ts`) ; ce fichier
 * éprouve la lecture qui l'alimente, cloisonnée (I1), comme
 * `avertissements-planification.test.ts` le fait déjà pour `envoyerAuClient`.
 */

const INTERNE_A = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

afterAll(fermerClients);

describe("le donneur d'ordre du SITE prime celui du CLIENT, lu par contactsDuClient", () => {
  const contactClientId = uuidv7();
  const contactSiteId = uuidv7();

  beforeAll(async () => {
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "contact"
         ("id", "societe_id", "client_id", "site_id", "nom", "roles", "canaux", "email", "actif")
       VALUES ($1::uuid, $2::uuid, $3::uuid, NULL, 'Donneur d''ordre du client TP-UX5-1',
               ARRAY['donneur_ordre'], ARRAY['email'], 'client@tp-ux5-1.test', true)`,
      contactClientId,
      SOCIETE_A,
      CLIENT_A1,
    );
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "contact"
         ("id", "societe_id", "client_id", "site_id", "nom", "roles", "canaux", "email", "actif")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'Donneur d''ordre du site TP-UX5-1',
               ARRAY['donneur_ordre'], ARRAY['email'], 'site@tp-ux5-1.test', true)`,
      contactSiteId,
      SOCIETE_A,
      CLIENT_A1,
      SITE_A1_S1,
    );
  });

  afterAll(async () => {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "contact" WHERE "id" IN ($1::uuid, $2::uuid)`,
      contactClientId,
      contactSiteId,
    );
  });

  it("rend le donneur d'ordre DU SITE, pas celui du client", async () => {
    const contacts = await contactsDuClient(INTERNE_A, CLIENT_A1, clientApp());
    const donneur = destinataireClient(contacts, SITE_A1_S1);
    expect(donneur?.nom).toBe("Donneur d'ordre du site TP-UX5-1");
  });

  it("sur un AUTRE site du même client, retombe sur le donneur d'ordre du CLIENT", async () => {
    const autreSiteId = uuidv7();
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "site" ("id", "societe_id", "client_id", "agence_id", "libelle")
       SELECT $1::uuid, societe_id, client_id, agence_id, 'Site TP-UX5-1 sans donneur dédié'
       FROM "site" WHERE id = $2::uuid`,
      autreSiteId,
      SITE_A1_S1,
    );
    try {
      const contacts = await contactsDuClient(
        INTERNE_A,
        CLIENT_A1,
        clientApp(),
      );
      const donneur = destinataireClient(contacts, autreSiteId);
      expect(donneur?.nom).toBe("Donneur d'ordre du client TP-UX5-1");
    } finally {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "site" WHERE "id" = $1::uuid`,
        autreSiteId,
      );
    }
  });

  it("sans donneur d'ordre éligible, rend `null` — jamais un courriel dans ce que la route en ferait", async () => {
    const contacts = await contactsDuClient(INTERNE_A, CLIENT_A1, clientApp());
    const sansDonneur = contacts.filter(
      (contact) => !contact.roles.includes("donneur_ordre"),
    );
    expect(destinataireClient(sansDonneur, SITE_A1_S1)).toBeNull();
  });
});

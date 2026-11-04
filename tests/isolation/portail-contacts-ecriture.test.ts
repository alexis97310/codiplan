import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { creerContact, modifierContact } from "@/lib/contacts/depot";
import { Role } from "@/lib/auth/roles";
import { avecContexteRls } from "@/lib/db/rls";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_A2,
  CONTACT_A1_COMPTABLE,
  PORTAIL_A2_CLIENT,
  PORTAIL_A_CLIENT,
  SITE_A1_S1,
  SITE_A1_S2,
  SOCIETE_A,
} from "./setup/fixtures";

/**
 * L'ÉCRITURE DE `contact` DEPUIS LE PORTAIL (9J03-PORTAIL-CONTACTS, CLI-3).
 *
 * `tests/isolation/contacts-ecriture.test.ts` prouve déjà le chemin
 * applicatif pour un utilisateur INTERNE. Ce fichier ajoute le chemin que ce
 * ticket ouvre : un compte portail (`Role.client`, `app.client_id` posé)
 * créant ou modifiant un contact par `lib/contacts/depot.ts` — jamais une
 * recopie de la règle, et aucune migration (la politique « parc » de
 * `contact` existe depuis L1-03).
 *
 * `PORTAIL_A_CLIENT` est rattaché à `CLIENT_A1` et restreint à `SITE_A1_S1`
 * (`PERIMETRE_A1_S1`, `tests/isolation/setup/global.ts`) — `SITE_A1_S2`
 * appartient au MÊME client mais reste HORS de son périmètre, exactement la
 * fixture qu'il faut pour éprouver le `WITH CHECK` sans fabriquer de donnée
 * neuve.
 */

afterAll(fermerClients);

const SESSION_PORTAIL_A1 = {
  utilisateurId: PORTAIL_A_CLIENT,
  societeId: SOCIETE_A,
  role: Role.client,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: CLIENT_A1,
};

const SESSION_PORTAIL_A2 = {
  ...SESSION_PORTAIL_A1,
  utilisateurId: PORTAIL_A2_CLIENT,
  clientId: CLIENT_A2,
};

let contactIds: string[] = [];

beforeEach(() => {
  contactIds = [];
});

afterEach(async () => {
  for (const id of contactIds) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "contact" WHERE "id" = $1::uuid`,
      id,
    );
  }
});

describe("un compte portail écrit SUR SON CLIENT, par le dépôt", () => {
  it("ACCEPTE : crée un contact de son client, site dans son périmètre", async () => {
    const creation = await creerContact(
      SESSION_PORTAIL_A1,
      {
        client_id: CLIENT_A1,
        site_id: SITE_A1_S1,
        nom: "Créé depuis le portail (épreuve)",
        fonction: null,
        telephone: null,
        mobile: null,
        email: "portail-a1@iso.test",
        roles: ["contact_technique"],
        canaux: ["email"],
      },
      clientApp(),
    );
    expect(creation.accepte).toBe(true);
    if (!creation.accepte) return;
    contactIds.push(creation.fiche.id);
    expect(creation.fiche.client_id).toBe(CLIENT_A1);
  });

  it("ACCEPTE : modifie un contact DÉJÀ existant de son client", async () => {
    const modification = await modifierContact(
      SESSION_PORTAIL_A1,
      CONTACT_A1_COMPTABLE,
      { fonction: "Modifié depuis le portail (épreuve)" },
      clientApp(),
    );
    expect(modification.accepte).toBe(true);
    if (modification.accepte) {
      expect(modification.fiche.fonction).toBe(
        "Modifié depuis le portail (épreuve)",
      );
    }
    // Remis en l'état : ce scénario ne laisse pas une fiche partagée altérée
    // pour les scénarios suivants du même fichier de fixtures.
    await modifierContact(
      SESSION_PORTAIL_A1,
      CONTACT_A1_COMPTABLE,
      { fonction: null },
      clientApp(),
    );
  });

  it("REFUS : un compte portail d'un AUTRE client ne modifie pas ce contact (introuvable, D35/D50)", async () => {
    const resultat = await modifierContact(
      SESSION_PORTAIL_A2,
      CONTACT_A1_COMPTABLE,
      { fonction: "Détournement depuis A2 (épreuve)" },
      clientApp(),
    );
    expect(resultat.accepte).toBe(false);
    if (!resultat.accepte) {
      // « introuvable », jamais une distinction qui apprendrait que la fiche
      // existe ailleurs (D35, D50) : même refus qu'un identifiant inconnu.
      expect(resultat.motif).toBe("introuvable");
    }

    // TÉMOIN : la fiche n'a PAS bougé — le refus n'a rien écrit.
    const fiche = await clientOwner().$queryRawUnsafe<
      { fonction: string | null }[]
    >(
      `SELECT "fonction" FROM "contact" WHERE "id" = $1::uuid`,
      CONTACT_A1_COMPTABLE,
    );
    expect(fiche[0]?.fonction).not.toBe("Détournement depuis A2 (épreuve)");
  });

  it("REFUS (WITH CHECK) : un compte portail ne rattache pas un contact à un site HORS de SON périmètre", async () => {
    // SITE_A1_S2 appartient au MÊME client (CLIENT_A1) mais pas au périmètre
    // de PORTAIL_A_CLIENT, restreint à SITE_A1_S1 — c'est la politique
    // « parc » de `contact`, jamais une comparaison écrite dans le dépôt
    // (hors territoire), qui referme ici.
    await expect(
      creerContact(
        SESSION_PORTAIL_A1,
        {
          client_id: CLIENT_A1,
          site_id: SITE_A1_S2,
          nom: "Intrus hors périmètre (épreuve)",
          fonction: null,
          telephone: null,
          mobile: null,
          email: "intrus@iso.test",
          roles: ["contact_technique"],
          canaux: ["email"],
        },
        clientApp(),
      ),
    ).rejects.toThrow();
  });

  it("DÉFENSE EN PROFONDEUR : client_id ne change JAMAIS, même forcé en requête brute sous le contexte portail", async () => {
    // Zod exclut déjà `client_id` de `schemaModificationContact` — ceci
    // éprouve la GARDE DE FOND : même en contournant la saisie serveur par
    // une requête brute, la politique `WITH CHECK` referme, parce que la
    // nouvelle valeur ne vaudrait plus `app.client_id`.
    await expect(
      avecContexteRls(
        clientApp(),
        {
          societeId: SOCIETE_A,
          role: Role.client,
          auteurId: PORTAIL_A_CLIENT,
          clientId: CLIENT_A1,
        },
        (tx) =>
          tx.$executeRawUnsafe(
            `UPDATE "contact" SET "client_id" = $1::uuid WHERE "id" = $2::uuid`,
            CLIENT_A2,
            CONTACT_A1_COMPTABLE,
          ),
      ),
    ).rejects.toThrow(/row-level security|violates/i);

    // TÉMOIN : la fiche appartient toujours à CLIENT_A1.
    const fiche = await clientOwner().$queryRawUnsafe<{ client_id: string }[]>(
      `SELECT "client_id" FROM "contact" WHERE "id" = $1::uuid`,
      CONTACT_A1_COMPTABLE,
    );
    expect(fiche[0]?.client_id).toBe(CLIENT_A1);
  });
});

import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  basculerActiviteContact,
  contactsDuClient,
  contactsDuSite,
  creerContact,
  modifierContact,
} from "@/lib/contacts/depot";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_B1,
  SITE_A1_S1,
  SITE_A1_S2,
  SITE_A2_S1,
  SITE_B1_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_INTERNE_B,
} from "./setup/fixtures";

/**
 * LE CHEMIN D'ÉCRITURE DES CONTACTS (CONTACTS-1).
 *
 * `lib/contacts/depot.ts` était absent avant ce ticket : mesuré le 22/09/2026,
 * zéro chemin d'écriture vers `contact` dans tout le dépôt. Ce fichier prouve
 * que le dépôt NEUF écrit réellement — création, modification, bascule
 * d'activité — et que le cloisonnement mord sur ces trois chemins comme il
 * mord déjà sur les lectures brutes de `tests/isolation/contact.test.ts`.
 *
 * **Le piège nommé par l'exploitation reste le même** : un contact sans site
 * est un contact du client, et un contact d'un site n'apparaît pas sous un
 * autre site du même client. `tests/isolation/contact.test.ts` l'éprouve par
 * lecture brute ; ce fichier l'éprouve par le CHEMIN APPLICATIF —
 * `contactsDuClient` et `contactsDuSite`.
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

const SESSION_B = {
  ...SESSION,
  utilisateurId: UTILISATEUR_INTERNE_B,
  societeId: SOCIETE_B,
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

describe("créer, modifier, désactiver — par le dépôt, jamais par une ligne SQL", () => {
  it("crée un contact du CLIENT (site_id nul), le modifie, puis le désactive", async () => {
    const creation = await creerContact(
      SESSION,
      {
        client_id: CLIENT_A1,
        site_id: null,
        nom: "Comptable de CLIENT_A1",
        fonction: null,
        telephone: null,
        mobile: null,
        email: "compta@a1.test",
        roles: ["comptabilite"],
        canaux: ["email"],
      },
      clientApp(),
    );
    expect(creation.accepte).toBe(true);
    if (!creation.accepte) return;
    contactIds.push(creation.fiche.id);
    expect(creation.fiche.site_id).toBeNull();
    expect(creation.fiche.actif).toBe(true);

    const modification = await modifierContact(
      SESSION,
      creation.fiche.id,
      {
        fonction: "Responsable comptable",
        roles: ["comptabilite", "signataire"],
      },
      clientApp(),
    );
    expect(modification.accepte).toBe(true);
    if (!modification.accepte) return;
    expect(modification.fiche.fonction).toBe("Responsable comptable");
    expect([...modification.fiche.roles].sort()).toEqual(
      ["comptabilite", "signataire"].sort(),
    );
    // Ce qui n'a pas été soumis n'a PAS bougé.
    expect(modification.fiche.nom).toBe("Comptable de CLIENT_A1");
    expect(modification.fiche.email).toBe("compta@a1.test");

    const desactivation = await basculerActiviteContact(
      SESSION,
      creation.fiche.id,
      false,
      clientApp(),
    );
    expect(desactivation.accepte).toBe(true);
    if (!desactivation.accepte) return;
    expect(desactivation.fiche.actif).toBe(false);

    const reactivation = await basculerActiviteContact(
      SESSION,
      creation.fiche.id,
      true,
      clientApp(),
    );
    expect(reactivation.accepte).toBe(true);
    if (reactivation.accepte) expect(reactivation.fiche.actif).toBe(true);
  });

  it("crée un contact rattaché à un SITE du même client", async () => {
    const creation = await creerContact(
      SESSION,
      {
        client_id: CLIENT_A1,
        site_id: SITE_A1_S2,
        nom: "Atelier de CLIENT_A1",
        fonction: null,
        telephone: null,
        mobile: null,
        email: "atelier@a1.test",
        roles: ["contact_technique"],
        canaux: ["email"],
      },
      clientApp(),
    );
    expect(creation.accepte).toBe(true);
    if (!creation.accepte) return;
    contactIds.push(creation.fiche.id);
    expect(creation.fiche.site_id).toBe(SITE_A1_S2);
  });

  it("MODIFIER un contact introuvable (autre société) est refusé sans lever", async () => {
    const creeSousB = await creerContact(
      SESSION_B,
      {
        client_id: CLIENT_B1,
        site_id: null,
        nom: "Contact de B",
        fonction: null,
        telephone: null,
        mobile: null,
        email: "b@b1.test",
        roles: ["donneur_ordre"],
        canaux: ["email"],
      },
      clientApp(),
    );
    expect(creeSousB.accepte).toBe(true);
    if (!creeSousB.accepte) return;
    contactIds.push(creeSousB.fiche.id);

    const tentative = await modifierContact(
      SESSION,
      creeSousB.fiche.id,
      { nom: "Renommé depuis A" },
      clientApp(),
    );
    expect(tentative).toEqual({ accepte: false, motif: "introuvable" });
  });

  it("DÉSACTIVER un identifiant inconnu est refusé sans lever", async () => {
    const resultat = await basculerActiviteContact(
      SESSION,
      uuidv7(),
      false,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "introuvable" });
  });
});

describe("les refus référentiels — les deux clés composites tiennent, jamais une lecture préalable", () => {
  it("REFUS : un client d'une AUTRE société", async () => {
    const tentative = await creerContact(
      SESSION,
      {
        client_id: CLIENT_B1,
        site_id: null,
        nom: "Intrus",
        fonction: null,
        telephone: null,
        mobile: null,
        email: "x@y.test",
        roles: ["donneur_ordre"],
        canaux: ["email"],
      },
      clientApp(),
    );
    expect(tentative).toEqual({
      accepte: false,
      motif: "client_hors_perimetre",
    });
  });

  it("REFUS : un site d'un AUTRE client de la même société", async () => {
    // SITE_A2_S1 appartient à un autre client (CLIENT_A2) que CLIENT_A1 : la
    // clé composite (société, client, site) doit refuser, exactement comme
    // `contact_site_du_client_fkey` en base (tests/isolation/contact.test.ts).
    const tentative = await creerContact(
      SESSION,
      {
        client_id: CLIENT_A1,
        site_id: SITE_A2_S1,
        nom: "Intrus",
        fonction: null,
        telephone: null,
        mobile: null,
        email: "x@y.test",
        roles: ["donneur_ordre"],
        canaux: ["email"],
      },
      clientApp(),
    );
    expect(tentative).toEqual({ accepte: false, motif: "site_hors_client" });
  });
});

describe("LE PIÈGE NOMMÉ, éprouvé par le chemin applicatif", () => {
  it("`contactsDuClient` rend le contact du client ET celui de son site", async () => {
    const duClient = await creerContact(
      SESSION,
      {
        client_id: CLIENT_A1,
        site_id: null,
        nom: "Du client (chemin applicatif)",
        fonction: null,
        telephone: null,
        mobile: null,
        email: "duclient@a1.test",
        roles: ["comptabilite"],
        canaux: ["email"],
      },
      clientApp(),
    );
    const duSite = await creerContact(
      SESSION,
      {
        client_id: CLIENT_A1,
        site_id: SITE_A1_S1,
        nom: "Du site (chemin applicatif)",
        fonction: null,
        telephone: null,
        mobile: null,
        email: "dusite@a1.test",
        roles: ["contact_technique"],
        canaux: ["email"],
      },
      clientApp(),
    );
    expect(duClient.accepte).toBe(true);
    expect(duSite.accepte).toBe(true);
    if (!duClient.accepte || !duSite.accepte) return;
    contactIds.push(duClient.fiche.id, duSite.fiche.id);

    const lus = await contactsDuClient(SESSION, CLIENT_A1, clientApp());
    const ids = lus.map((c) => c.id);
    expect(ids).toContain(duClient.fiche.id);
    expect(ids).toContain(duSite.fiche.id);
  });

  it("`contactsDuSite` ne rend QUE les contacts de CE site, jamais ceux du client ni d'un autre site", async () => {
    const duClient = await creerContact(
      SESSION,
      {
        client_id: CLIENT_A1,
        site_id: null,
        nom: "Du client (témoin site)",
        fonction: null,
        telephone: null,
        mobile: null,
        email: "temoin1@a1.test",
        roles: ["comptabilite"],
        canaux: ["email"],
      },
      clientApp(),
    );
    const surS1 = await creerContact(
      SESSION,
      {
        client_id: CLIENT_A1,
        site_id: SITE_A1_S1,
        nom: "Sur S1",
        fonction: null,
        telephone: null,
        mobile: null,
        email: "surs1@a1.test",
        roles: ["contact_technique"],
        canaux: ["email"],
      },
      clientApp(),
    );
    const surS2 = await creerContact(
      SESSION,
      {
        client_id: CLIENT_A1,
        site_id: SITE_A1_S2,
        nom: "Sur S2",
        fonction: null,
        telephone: null,
        mobile: null,
        email: "surs2@a1.test",
        roles: ["contact_technique"],
        canaux: ["email"],
      },
      clientApp(),
    );
    expect(duClient.accepte).toBe(true);
    expect(surS1.accepte).toBe(true);
    expect(surS2.accepte).toBe(true);
    if (!duClient.accepte || !surS1.accepte || !surS2.accepte) return;
    contactIds.push(duClient.fiche.id, surS1.fiche.id, surS2.fiche.id);

    const lusSurS1 = await contactsDuSite(SESSION, SITE_A1_S1, clientApp());
    const idsSurS1 = lusSurS1.map((c) => c.id);
    expect(idsSurS1).toContain(surS1.fiche.id);
    expect(idsSurS1).not.toContain(surS2.fiche.id);
    expect(idsSurS1).not.toContain(duClient.fiche.id);
  });
});

describe("cloisonnement — un contact d'une AUTRE société est invisible, sans clause écrite", () => {
  it("`contactsDuClient` sous la société B ne rend rien pour un client de A", async () => {
    const creation = await creerContact(
      SESSION,
      {
        client_id: CLIENT_A1,
        site_id: null,
        nom: "Contact de A (témoin de cloisonnement)",
        fonction: null,
        telephone: null,
        mobile: null,
        email: "cloison@a1.test",
        roles: ["donneur_ordre"],
        canaux: ["email"],
      },
      clientApp(),
    );
    expect(creation.accepte).toBe(true);
    if (!creation.accepte) return;
    contactIds.push(creation.fiche.id);

    // TÉMOIN — sans lui, « rien vu sous B » serait indistinguable de « la
    // fonction ne cherche jamais rien ».
    const vuSousA = await contactsDuClient(SESSION, CLIENT_A1, clientApp());
    expect(vuSousA.map((c) => c.id)).toContain(creation.fiche.id);

    const vuSousB = await contactsDuClient(SESSION_B, CLIENT_A1, clientApp());
    expect(vuSousB.map((c) => c.id)).not.toContain(creation.fiche.id);
    expect(vuSousB).toEqual([]);
  });

  it("`contactsDuSite` sous la société B ne rend rien pour un site de A", async () => {
    const creation = await creerContact(
      SESSION,
      {
        client_id: CLIENT_A1,
        site_id: SITE_A1_S1,
        nom: "Contact de A sur site (témoin de cloisonnement)",
        fonction: null,
        telephone: null,
        mobile: null,
        email: "cloison-site@a1.test",
        roles: ["contact_technique"],
        canaux: ["email"],
      },
      clientApp(),
    );
    expect(creation.accepte).toBe(true);
    if (!creation.accepte) return;
    contactIds.push(creation.fiche.id);

    const vuSousB = await contactsDuSite(SESSION_B, SITE_A1_S1, clientApp());
    expect(vuSousB.map((c) => c.id)).not.toContain(creation.fiche.id);

    // Le témoin symétrique — un contact de B, sur un site de B, invisible
    // sous A.
    const contactDeB = await creerContact(
      SESSION_B,
      {
        client_id: CLIENT_B1,
        site_id: SITE_B1_S1,
        nom: "Contact de B sur site B",
        fonction: null,
        telephone: null,
        mobile: null,
        email: "b-site@b1.test",
        roles: ["contact_technique"],
        canaux: ["email"],
      },
      clientApp(),
    );
    expect(contactDeB.accepte).toBe(true);
    if (contactDeB.accepte) contactIds.push(contactDeB.fiche.id);
    const vuSousA = await contactsDuSite(SESSION, SITE_B1_S1, clientApp());
    expect(vuSousA).toEqual([]);
  });
});

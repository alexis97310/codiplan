import { describe, expect, it } from "vitest";

import {
  CANAUX_CONNUS,
  CANAUX_IMPLEMENTES,
  CANAL_PAR_DEFAUT,
  ROLES_CONTACT,
  ROLE_SIGNATAIRE,
  peutSigner,
  schemaCreationContact,
  schemaModificationContact,
} from "../../../lib/contacts/saisie";

/**
 * L'ENTRÉE SERVEUR D'UN CONTACT (ticket L1-03).
 *
 * Ce fichier garde les deux DÉCISIONS que le ticket a prises sur le lieu des
 * énumérations, et non seulement leur contenu.
 */

const VALIDE = {
  client_id: "0192f0a0-1000-7000-8000-000000000001",
  nom: "Comptable",
  roles: ["comptabilite"],
  email: "compta@client.test",
};

describe("les rôles — un ENSEMBLE, clos à l'entrée serveur", () => {
  it("accepte plusieurs rôles : le donneur d'ordre est souvent le signataire", () => {
    const lu = schemaCreationContact.safeParse({
      ...VALIDE,
      roles: ["donneur_ordre", "signataire"],
    });
    expect(lu.success).toBe(true);
  });

  it("refuse un rôle inconnu — la liste est close ICI", () => {
    const lu = schemaCreationContact.safeParse({
      ...VALIDE,
      roles: ["magasinier"],
    });
    expect(lu.success).toBe(false);
  });

  it("refuse un ensemble VIDE et un rôle répété", () => {
    expect(
      schemaCreationContact.safeParse({ ...VALIDE, roles: [] }).success,
    ).toBe(false);
    expect(
      schemaCreationContact.safeParse({
        ...VALIDE,
        roles: ["signataire", "signataire"],
      }).success,
    ).toBe(false);
  });

  it("RG-INT-04 lit « qui signe » DANS l'ensemble, pas dans une colonne", () => {
    // Une colonne `est_signataire` aurait été une seconde source du même fait,
    // et deux sources d'un même fait divergent en silence (§9, 01/09).
    expect(peutSigner(["donneur_ordre", ROLE_SIGNATAIRE])).toBe(true);
    expect(peutSigner(["comptabilite"])).toBe(false);
    // Témoin : le rôle nommé appartient bien à la liste close — une constante
    // qui ne s'y adosserait plus ne protégerait plus rien.
    expect([...ROLES_CONTACT]).toContain(ROLE_SIGNATAIRE);
  });
});

describe("les canaux — une PRÉFÉRENCE n'est pas une capacité", () => {
  it("`email` est le défaut, et il n'est pas à saisir", () => {
    const lu = schemaCreationContact.parse(VALIDE);
    expect(lu.canaux).toEqual([CANAL_PAR_DEFAUT]);
  });

  it("refuse `sms` aujourd'hui — aucune passerelle n'est en service", () => {
    const lu = schemaCreationContact.safeParse({
      ...VALIDE,
      canaux: ["sms"],
    });
    expect(lu.success).toBe(false);
  });

  it("CONNUS et IMPLÉMENTÉS coïncident, et la distinction est vivante", () => {
    // On n'enregistre pas une préférence qu'on ne sait pas honorer. Le jour où
    // `sms` rejoint les CONNUS sans rejoindre les IMPLÉMENTÉS, cette mesure
    // devient un vrai contrôle ; aujourd'hui elle dit que rien ne promet un
    // envoi qui ne partira pas.
    expect([...CANAUX_IMPLEMENTES].sort()).toEqual([...CANAUX_CONNUS].sort());
    for (const canal of CANAUX_IMPLEMENTES) {
      expect([...CANAUX_CONNUS]).toContain(canal);
    }
  });
});

describe("la dépendance entre deux champs est DITE, pas laissée à la relecture", () => {
  it("refuse le canal e-mail sans adresse", () => {
    const lu = schemaCreationContact.safeParse({
      ...VALIDE,
      email: null,
      canaux: ["email"],
    });
    expect(lu.success).toBe(false);
    if (!lu.success) {
      // Le message porte sur le CHAMP fautif : un refus qui ne dit pas où
      // regarder oblige à deviner.
      expect(lu.error.issues.some((i) => i.path.includes("email"))).toBe(true);
    }
  });
});

describe("le rattachement — ce qui se modifie et ce qui ne se modifie pas", () => {
  it("`site_id` est FACULTATIF, et son absence est la valeur par défaut", () => {
    const lu = schemaCreationContact.parse(VALIDE);
    expect(lu.site_id).toBeNull();
  });

  it("`client_id` n'est PAS modifiable", () => {
    // Déplacer un contact d'un client à l'autre n'est pas une correction de
    // saisie : c'est effacer un interlocuteur chez l'un et en créer un chez
    // l'autre, avec l'historique qui ne suit pas.
    const lu = schemaModificationContact.parse({
      client_id: "0192f0a0-1000-7000-8000-000000000002",
      nom: "Renommé",
    });
    expect(lu).not.toHaveProperty("client_id");
  });

  it("`site_id` se modifie — un interlocuteur change d'atelier", () => {
    const lu = schemaModificationContact.parse({
      site_id: "0192f0a0-4000-7000-8000-000000000001",
    });
    expect(lu.site_id).toBe("0192f0a0-4000-7000-8000-000000000001");
  });

  it("et il se REMET à null — le contact redevient contact du client", () => {
    const lu = schemaModificationContact.parse({ site_id: null });
    expect(lu.site_id).toBeNull();
  });
});

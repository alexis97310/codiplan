import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";

import { clientApp, clientOwner, fermerClients, urlApp } from "./setup/db";
import {
  MACHINE_A1,
  MACHINE_A2,
  MACHINE_B1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_INTERNE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * CHANGER L'ÉTAT D'UNE MACHINE (9I8F-STATUT-MACHINE-MODIFIABLE) — le
 * cloisonnement et le périmètre par personne de `changerStatutMachine`
 * (`lib/machines/depot.ts`), sur la vraie table, sous le contexte applicatif.
 *
 * Même patron que `modifierMachine` dans
 * `tests/isolation/qt2-retouches-r1-r2.test.ts` : une fiche hors du
 * périmètre rend le même refus « introuvable » qu'un identifiant inconnu,
 * jamais un refus distinct qui révélerait son existence (D50).
 */
const URL_DATABASE_AVANT = process.env.DATABASE_URL;
process.env.DATABASE_URL = urlApp();
const { changerStatutMachine, lireMachine } =
  await import("@/lib/machines/depot");

afterAll(async () => {
  process.env.DATABASE_URL = URL_DATABASE_AVANT;
  await fermerClients();
});

const SESSION_INTERNE_A = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const SESSION_INTERNE_B = {
  utilisateurId: UTILISATEUR_INTERNE_B,
  societeId: SOCIETE_B,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const SESSION_TECH_A = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.technicien] as string,
  societeId: SOCIETE_A,
  role: Role.technicien,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

describe("changerStatutMachine — cloisonnement (I1)", () => {
  it("une société B ne change jamais une machine de la société A : refus « introuvable », rien n'est écrit", async () => {
    const resultat = await changerStatutMachine(
      SESSION_INTERNE_B,
      MACHINE_A1,
      "en_panne",
      false,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "introuvable" });

    const fiche = await lireMachine(SESSION_INTERNE_A, MACHINE_A1);
    expect(fiche?.statut).toBe("en_service");
  });
});

describe("changerStatutMachine — le périmètre par personne (QT-2, D152)", () => {
  it("MACHINE_A2, hors de la fenêtre du technicien restreint : refus « introuvable », rien n'est écrit", async () => {
    const resultat = await changerStatutMachine(
      SESSION_TECH_A,
      MACHINE_A2,
      "en_panne",
      false,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: false, motif: "introuvable" });

    const fiche = await lireMachine(SESSION_INTERNE_A, MACHINE_A2);
    expect(fiche?.statut).toBe("en_service");
  });
});

describe("changerStatutMachine — le chemin accepté", () => {
  it("MACHINE_B1, par un compte interne de SA société : accepté, et relu tel quel", async () => {
    const resultat = await changerStatutMachine(
      SESSION_INTERNE_B,
      MACHINE_B1,
      "arretee",
      false,
      clientApp(),
    );
    expect(resultat).toEqual({ accepte: true, id: MACHINE_B1 });

    const fiche = await lireMachine(SESSION_INTERNE_B, MACHINE_B1);
    expect(fiche?.statut).toBe("arretee");

    // Remis dans son état initial — une fixture partagée ne doit pas sortir
    // de ce fichier changée pour les épreuves qui la lisent après celle-ci.
    const remise = await changerStatutMachine(
      SESSION_INTERNE_B,
      MACHINE_B1,
      "en_service",
      false,
      clientApp(),
    );
    expect(remise).toEqual({ accepte: true, id: MACHINE_B1 });
  });
});

/**
 * LA GARDE DU STATUT (9I8F1-REPRISE-9I8F, D227) — les trois règles serveur
 * de `lib/machines/garde-statut.ts`, sur la vraie table. `MACHINE_B1` est la
 * fixture déjà mutée dans ce fichier (bloc ci-dessus) : chaque épreuve la
 * remet dans son état initial avant de rendre la main.
 */
describe("changerStatutMachine — une sortie du parc exige une confirmation vérifiée côté serveur", () => {
  it("« remplacee » SANS confirmation : refus nommé, rien n'est écrit", async () => {
    const resultat = await changerStatutMachine(
      SESSION_INTERNE_B,
      MACHINE_B1,
      "remplacee",
      false,
      clientApp(),
    );
    expect(resultat).toEqual({
      accepte: false,
      motif: "sortie_sans_confirmation",
    });
    const fiche = await lireMachine(SESSION_INTERNE_B, MACHINE_B1);
    expect(fiche?.statut).toBe("en_service");
  });

  it("« remplacee » AVEC confirmation : accepté, puis le RETOUR exige lui aussi une confirmation", async () => {
    const sortie = await changerStatutMachine(
      SESSION_INTERNE_B,
      MACHINE_B1,
      "remplacee",
      true,
      clientApp(),
    );
    expect(sortie).toEqual({ accepte: true, id: MACHINE_B1 });

    const retourSansConfirmation = await changerStatutMachine(
      SESSION_INTERNE_B,
      MACHINE_B1,
      "en_service",
      false,
      clientApp(),
    );
    expect(retourSansConfirmation).toEqual({
      accepte: false,
      motif: "sortie_sans_confirmation",
    });
    expect((await lireMachine(SESSION_INTERNE_B, MACHINE_B1))?.statut).toBe(
      "remplacee",
    );

    // Remis dans son état initial, AVEC confirmation cette fois.
    const retour = await changerStatutMachine(
      SESSION_INTERNE_B,
      MACHINE_B1,
      "en_service",
      true,
      clientApp(),
    );
    expect(retour).toEqual({ accepte: true, id: MACHINE_B1 });
    expect((await lireMachine(SESSION_INTERNE_B, MACHINE_B1))?.statut).toBe(
      "en_service",
    );
  });
});

describe("changerStatutMachine — une machine fusionnée ne change jamais de statut", () => {
  it("refus nommé « fusionnee », même avec confirmation", async () => {
    await clientOwner().$executeRawUnsafe(
      `UPDATE "machine" SET "statut" = 'fusionnee' WHERE "id" = '${MACHINE_B1}'`,
    );
    try {
      const resultat = await changerStatutMachine(
        SESSION_INTERNE_B,
        MACHINE_B1,
        "en_service",
        true,
        clientApp(),
      );
      expect(resultat).toEqual({ accepte: false, motif: "fusionnee" });
      const fiche = await lireMachine(SESSION_INTERNE_B, MACHINE_B1);
      expect(fiche?.statut).toBe("fusionnee");
    } finally {
      // Remis dans son état initial — l'écriture directe est la SEULE voie :
      // `changerStatutMachine` refuse, par construction, de faire sortir une
      // machine fusionnée de son statut (c'est exactement ce que cette
      // épreuve vient de prouver).
      await clientOwner().$executeRawUnsafe(
        `UPDATE "machine" SET "statut" = 'en_service' WHERE "id" = '${MACHINE_B1}'`,
      );
    }
  });
});

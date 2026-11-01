import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";

import { clientApp, fermerClients, urlApp } from "./setup/db";
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

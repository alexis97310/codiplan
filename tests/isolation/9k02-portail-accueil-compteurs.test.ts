import { afterAll, describe, expect, it } from "vitest";

import { interventionsDuParc } from "@/app/(portail)/portail/interventions/depot";
import { type ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import { demandesOuvertes } from "@/lib/demandes/depot";
import { estFige } from "@/lib/interventions/cycle-de-vie";

import { clientApp, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_A2,
  DEMANDE_A1,
  DEMANDE_A2,
  DEMANDE_B1,
  INTERVENTION_A1,
  INTERVENTION_A2,
  INTERVENTION_B1,
  PORTAIL_A2_CLIENT,
  PORTAIL_A_CLIENT,
  SOCIETE_A,
} from "./setup/fixtures";

/**
 * LES DEUX TUILES DE L'ACCUEIL DU PORTAIL (9K02-PORTAIL-MENU-ACCUEIL) — SOUS
 * LA VRAIE POLITIQUE, pas une comparaison écrite dans la page.
 *
 * `/portail` compose son compte d'« interventions en cours » en filtrant
 * `interventionsDuParc` par `estFige` (jamais une troisième lecture du
 * critère de périmètre, §9 01/09) et lit son compte de « demandes en
 * attente » directement sur `demandesOuvertes` (`/portail/demandes` lit déjà
 * sous la même forme). Ce scénario éprouve que les DEUX comptes, une fois
 * composés, restent bornés au client et au périmètre de sites du compte
 * portail — jamais une ligne du client A2 ni de la société B.
 *
 * `INTERVENTION_A1`/`A2`/`B1` et `DEMANDE_A1`/`A2`/`B1` portent toutes un
 * statut non figé / ouvert par construction du harnais (`setup/global.ts`) :
 * ce scénario n'éprouve donc que le FILTRE DE PÉRIMÈTRE, le filtre de statut
 * étant déjà celui que `9j07` et `demandesOuvertes` éprouvent chacun pour
 * leur compte.
 */
function contextePortailA1(): ContexteSession {
  return {
    utilisateurId: PORTAIL_A_CLIENT,
    societeId: SOCIETE_A,
    role: Role.client,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: CLIENT_A1,
  };
}

afterAll(fermerClients);

describe("le compte « interventions en cours » de l'accueil", () => {
  it("ne compte que l'intervention du client A1 dans SON périmètre de sites", async () => {
    const contexte = contextePortailA1();
    const interventions = await interventionsDuParc(contexte, clientApp());
    const identifiants = interventions
      .filter((i) => !estFige(i.statut))
      .map((i) => i.id);
    expect(identifiants).toContain(INTERVENTION_A1);
    // Même client, mais hors du périmètre de sites de ce compte.
    expect(identifiants).not.toContain(INTERVENTION_A2);
    // Autre société.
    expect(identifiants).not.toContain(INTERVENTION_B1);
  });

  it("un compte d'un AUTRE client de la même société ne compte aucune intervention du client A1", async () => {
    const interventions = await interventionsDuParc(
      {
        utilisateurId: PORTAIL_A2_CLIENT,
        societeId: SOCIETE_A,
        role: Role.client,
        secondFacteurValide: true,
        adresseIp: null,
        clientId: CLIENT_A2,
      },
      clientApp(),
    );
    const identifiants = interventions
      .filter((i) => !estFige(i.statut))
      .map((i) => i.id);
    expect(identifiants).not.toContain(INTERVENTION_A1);
  });
});

describe("le compte « demandes en attente » de l'accueil", () => {
  it("ne compte que la demande du client A1 dans SON périmètre de sites", async () => {
    const contexte = contextePortailA1();
    const demandes = await demandesOuvertes(contexte, clientApp());
    const identifiants = demandes.map((d) => d.id);
    expect(identifiants).toContain(DEMANDE_A1);
    expect(identifiants).not.toContain(DEMANDE_A2);
    expect(identifiants).not.toContain(DEMANDE_B1);
  });

  it("un compte d'un AUTRE client de la même société ne compte aucune demande du client A1", async () => {
    const demandes = await demandesOuvertes(
      {
        utilisateurId: PORTAIL_A2_CLIENT,
        societeId: SOCIETE_A,
        role: Role.client,
        secondFacteurValide: true,
        adresseIp: null,
        clientId: CLIENT_A2,
      },
      clientApp(),
    );
    const identifiants = demandes.map((d) => d.id);
    expect(identifiants).not.toContain(DEMANDE_A1);
  });
});

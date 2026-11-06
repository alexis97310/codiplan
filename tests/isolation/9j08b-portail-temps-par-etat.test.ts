import { afterAll, describe, expect, it } from "vitest";

import { type ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import {
  historiqueInterventionDuClient,
  historiquesDemandesDuClient,
} from "@/lib/portail/historique-etats";

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
 * LE CLOISONNEMENT DE `historiqueInterventionDuClient`/
 * `historiquesDemandesDuClient` (9J08B-PORTAIL-TEMPS-PAR-ETAT, point 4) — SOUS
 * LA VRAIE POLITIQUE, pas une comparaison écrite dans le module.
 *
 * Même nuance que `9j07-portail-intervention-etat.test.ts` et
 * `9j04-portail-demandes-creer.test.ts` : `INTERVENTION_A1`/`DEMANDE_A1` sont
 * dans le périmètre du compte `PORTAIL_A_CLIENT` ; `INTERVENTION_A2`/
 * `DEMANDE_A2` sont du MÊME client mais HORS périmètre de sites ;
 * `INTERVENTION_B1`/`DEMANDE_B1` sont d'une autre société. Chaque fixture
 * porte au moins une ligne d'historique (le déclencheur AFTER INSERT la pose
 * à la création) — ce gardien mesure donc une ABSENCE réelle, jamais
 * l'absence d'une donnée à lire.
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

function contextePortailA2(): ContexteSession {
  return {
    utilisateurId: PORTAIL_A2_CLIENT,
    societeId: SOCIETE_A,
    role: Role.client,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: CLIENT_A2,
  };
}

afterAll(fermerClients);

describe("historiqueInterventionDuClient — ce qu'il ouvre et ce qu'il tait", () => {
  it("le compte portail lit SON historique", async () => {
    const historique = await historiqueInterventionDuClient(
      contextePortailA1(),
      INTERVENTION_A1,
      clientApp(),
    );
    expect(historique.length).toBeGreaterThan(0);
  });

  it("une intervention du MÊME client mais HORS du périmètre de sites : AUCUNE ligne", async () => {
    const historique = await historiqueInterventionDuClient(
      contextePortailA1(),
      INTERVENTION_A2,
      clientApp(),
    );
    expect(historique).toHaveLength(0);
  });

  it("une intervention d'un AUTRE client de la MÊME société : AUCUNE ligne", async () => {
    const historique = await historiqueInterventionDuClient(
      contextePortailA2(),
      INTERVENTION_A1,
      clientApp(),
    );
    expect(historique).toHaveLength(0);
  });

  it("une intervention d'une AUTRE société : AUCUNE ligne", async () => {
    const historique = await historiqueInterventionDuClient(
      contextePortailA1(),
      INTERVENTION_B1,
      clientApp(),
    );
    expect(historique).toHaveLength(0);
  });
});

describe("historiquesDemandesDuClient — ce qu'il ouvre et ce qu'il tait, PAR LOT", () => {
  it("le compte portail lit SON historique parmi un lot qui mélange son id et des ids hors périmètre", async () => {
    const historiques = await historiquesDemandesDuClient(
      contextePortailA1(),
      [DEMANDE_A1, DEMANDE_A2, DEMANDE_B1],
      clientApp(),
    );
    expect(historiques.get(DEMANDE_A1)?.length).toBeGreaterThan(0);
    // DEMANDE_A2 est du MÊME client mais hors du périmètre de sites de ce
    // compte : aucune ligne, même si la table en porte pour cet id.
    expect(historiques.has(DEMANDE_A2)).toBe(false);
    expect(historiques.has(DEMANDE_B1)).toBe(false);
  });

  it("un compte portail d'un AUTRE client de la même société ne lit AUCUN historique du client A1", async () => {
    const historiques = await historiquesDemandesDuClient(
      contextePortailA2(),
      [DEMANDE_A1, DEMANDE_A2],
      clientApp(),
    );
    expect(historiques.size).toBe(0);
  });
});

import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import {
  compterInterventions,
  listerInterventions,
} from "@/lib/interventions/depot";
import { schemaRechercheInterventions } from "@/lib/interventions/saisie";

import { clientApp, fermerClients } from "./setup/db";
import {
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_INTERNE_B,
} from "./setup/fixtures";

/**
 * LE FILTRE TECHNICIEN DU REGISTRE (57-REGISTRE-2) — CLOISONNÉ.
 *
 * `filtreDesInterventions` (`lib/interventions/depot.ts`) n'écrit aucune
 * comparaison de société sur ce critère : c'est la politique de forme
 * « parc », lue sous le contexte cloisonné, qui décide déjà de la population
 * visible. Ce fichier éprouve que le filtre `technicien` ne fait fuir aucune
 * ligne quand l'identifiant donné appartient à une AUTRE société — même
 * principe que le filtre « agence » dans `ecran-intervention.test.ts`
 * (AT-07).
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

describe("le filtre technicien du registre — cloisonné (57-REGISTRE-2)", () => {
  it("un uuid de technicien d'une autre société ne montre rien", async () => {
    const criteres = schemaRechercheInterventions.parse({
      technicien: UTILISATEUR_INTERNE_B,
    });
    const lignes = await listerInterventions(INTERNE_A, criteres, clientApp());
    expect(lignes).toEqual([]);
    expect(await compterInterventions(INTERNE_A, criteres, clientApp())).toBe(
      0,
    );
  });
});

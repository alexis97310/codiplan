import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import {
  compterInterventions,
  listerInterventions,
} from "@/lib/interventions/depot";
import { schemaRechercheInterventions } from "@/lib/interventions/saisie";

import { clientApp, fermerClients } from "./setup/db";
import { SOCIETE_A, UTILISATEUR_INTERNE_A } from "./setup/fixtures";

/**
 * LA RECHERCHE PAR NUMÉRO DE SÉRIE DU REGISTRE (67-REGISTRE-3) — CLOISONNÉE.
 *
 * `filtreDesInterventions` (`lib/interventions/depot.ts`) n'écrit aucune
 * comparaison de société sur la nouvelle branche `machines.some.machine.
 * numero_serie` : c'est la politique de forme « parc », lue sous le contexte
 * cloisonné, qui décide déjà de la population visible. `MACHINE_B1` (S/N
 * `SN-B1`) appartient à `SOCIETE_B` et est rattachée à `INTERVENTION_B1` —
 * cette épreuve vérifie qu'un compte de `SOCIETE_A` cherchant ce S/N ne voit
 * rien, même principe que le filtre technicien dans
 * `tests/isolation/registre-2.test.ts`.
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

describe("la recherche par numéro de série du registre — cloisonnée (67-REGISTRE-3)", () => {
  it("le S/N d'une machine d'une autre société ne remonte rien", async () => {
    const criteres = schemaRechercheInterventions.parse({ texte: "SN-B1" });
    const lignes = await listerInterventions(INTERNE_A, criteres, clientApp());
    expect(lignes).toEqual([]);
    expect(await compterInterventions(INTERNE_A, criteres, clientApp())).toBe(
      0,
    );
  });
});

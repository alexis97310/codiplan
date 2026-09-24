import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import {
  creerIntervention,
  interventionDejaCreee,
} from "@/lib/interventions/depot";
import { schemaCreation } from "@/lib/interventions/saisie";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  INTERVENTION_B1,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * 55-FORMULAIRES-1 (SAV-02) — L'IDENTIFIANT PROPOSÉ PAR LE FORMULAIRE NE
 * FUIT JAMAIS UNE AUTRE SOCIÉTÉ.
 *
 * `/api/interventions/creer` relit désormais l'`id` posé par le formulaire
 * SOUS LE CONTEXTE CLOISONNÉ (`interventionDejaCreee`) avant d'écrire, pour
 * qu'un double clic ne crée qu'une intervention. Ce fichier éprouve le seul
 * point qu'AGENCE_A ne peut pas éprouver par l'écran : que cette lecture, et
 * l'écriture qui la suit si elle ne trouve rien, ne révèlent et ne créent
 * jamais rien pour un `id` qui appartient à une AUTRE société.
 *
 * `INTERVENTION_B1` est une fixture DÉJÀ POSÉE par le harnais d'isolation
 * (`tests/isolation/setup/global.ts`), dans la société B — jamais une ligne
 * ajoutée par ce fichier.
 */

afterAll(fermerClients);

const SESSION_A = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

describe("un id d'une autre société reste inconnu, sous le contexte cloisonné", () => {
  it("`interventionDejaCreee` ne révèle pas l'intervention de la société B", async () => {
    const trouvee = await interventionDejaCreee(
      SESSION_A,
      INTERVENTION_B1,
      clientApp(),
    );
    expect(trouvee).toBeNull();
  });

  it("créer avec ce même id ne crée rien dans la société A", async () => {
    const description = "Épreuve FORMULAIRES-1 — id d'une autre société";
    const saisie = schemaCreation.parse({
      id: INTERVENTION_B1,
      client_id: CLIENT_A1,
      site_id: SITE_A1_S1,
      type: "curatif",
      description,
    });

    await expect(
      creerIntervention(SESSION_A, saisie, clientApp()),
    ).rejects.toThrow();

    const lignes = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*)::bigint AS "n" FROM "intervention"
       WHERE "societe_id" = $1::uuid AND "description" = $2`,
      SOCIETE_A,
      description,
    );
    expect(Number(lignes[0]?.n ?? -1)).toBe(0);

    // TÉMOIN — l'intervention de la société B, elle, existe toujours,
    // inchangée : ce scénario ne l'a ni lue ni altérée par effet de bord.
    const bLignes = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*)::bigint AS "n" FROM "intervention" WHERE "id" = $1::uuid`,
      INTERVENTION_B1,
    );
    expect(Number(bLignes[0]?.n ?? -1)).toBe(1);
  });
});

import { afterAll, describe, expect, it } from "vitest";

import { diagnostiquerRole, verifierRoleApplicatif } from "@/lib/db/garde-role";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { ROLE_APP } from "./setup/fixtures";

/**
 * Contrôle au démarrage du rôle de connexion (correction de revue L0-04, I1).
 *
 * Le filet RLS ne vaut que si l'application se connecte avec un rôle qui y est
 * soumis. Ces scénarios éprouvent le garde-fou contre les deux rôles réels de
 * la base : le propriétaire (refusé) et le rôle applicatif (accepté).
 */
describe("garde-fou du rôle applicatif", () => {
  afterAll(fermerClients);

  it("accepte le rôle applicatif non propriétaire", async () => {
    const diagnostic = await verifierRoleApplicatif(clientApp());

    expect(diagnostic.role).toBe(ROLE_APP);
    expect(diagnostic.proprietaire_base).toBe(false);
    expect(diagnostic.superutilisateur).toBe(false);
    expect(diagnostic.contourne_rls).toBe(false);
  });

  it("refuse le rôle propriétaire de la base", async () => {
    await expect(verifierRoleApplicatif(clientOwner())).rejects.toThrow(
      /propriétaire de la base|superutilisateur|BYPASSRLS/,
    );
  });

  it("le rôle propriétaire est bien détecté comme tel", async () => {
    // Contrôle du diagnostic lui-même : sans cela, un refus pourrait tomber
    // pour la mauvaise raison et le test resterait vert.
    const diagnostic = await diagnostiquerRole(clientOwner());

    expect(diagnostic.proprietaire_base).toBe(true);
  });
});

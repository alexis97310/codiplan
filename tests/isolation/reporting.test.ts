import { afterAll, describe, expect, it } from "vitest";

import {
  diagnostiquerRoleReporting,
  verifierRoleApplicatif,
  verifierRoleReporting,
} from "@/lib/db/garde-role";

import {
  clientApp,
  clientOwner,
  clientReporting,
  fermerClients,
} from "./setup/db";
import { ROLE_REPORTING, SOCIETE_A, SOCIETE_B } from "./setup/fixtures";

/**
 * Connexion de consolidation `codiplan_reporting` (arbitrage D21, ticket L0-06).
 *
 * Le rôle contourne délibérément les politiques : consolider plusieurs sociétés
 * n'est possible qu'à cette condition. Ce qui empêche cette exemption d'être une
 * porte dérobée, ce sont ses limites — et ce sont elles que ces scénarios
 * éprouvent, dans les deux sens : ce que le rôle PEUT (lire au-dessus du
 * cloisonnement) et ce qu'il ne peut PAS (écrire quoi que ce soit, lire une
 * table de données personnelles).
 */
describe("rôle de consolidation — attributs", () => {
  afterAll(fermerClients);

  it("porte BYPASSRLS, sans être ni superutilisateur ni propriétaire", async () => {
    const diagnostic = await diagnostiquerRoleReporting(clientReporting());

    expect(diagnostic.role).toBe(ROLE_REPORTING);
    expect(diagnostic.contourne_rls).toBe(true);
    expect(diagnostic.superutilisateur).toBe(false);
    expect(diagnostic.proprietaire_base).toBe(false);
    expect(diagnostic.ecriture_possible).toBe(false);
  });
});

describe("deux usages, deux gardes — le même rôle n'est pas jugé deux fois pareil", () => {
  afterAll(fermerClients);

  it("le garde de consolidation ACCEPTE le rôle de consolidation", async () => {
    const diagnostic = await verifierRoleReporting(clientReporting());
    expect(diagnostic.role).toBe(ROLE_REPORTING);
  });

  it("le garde applicatif REFUSE ce même rôle, à cause de BYPASSRLS", async () => {
    await expect(verifierRoleApplicatif(clientReporting())).rejects.toThrow(
      /BYPASSRLS/,
    );
  });

  it("le garde de consolidation REFUSE le rôle applicatif, faute de BYPASSRLS", async () => {
    await expect(verifierRoleReporting(clientApp())).rejects.toThrow(
      /BYPASSRLS/,
    );
  });

  it("le garde de consolidation REFUSE le propriétaire de la base", async () => {
    await expect(verifierRoleReporting(clientOwner())).rejects.toThrow(
      /propriétaire de la base|superutilisateur/,
    );
  });
});

describe("rôle de consolidation — ce qu'il PEUT", () => {
  afterAll(fermerClients);

  it("lit les deux sociétés à la fois, sans contexte — c'est l'objet même de D21", async () => {
    // La même requête, sous le rôle applicatif et sans contexte, ne rendrait
    // aucune ligne : c'est ce que prouve `cloisonnement-societe.test.ts`.
    const societes = await clientReporting().societe.findMany({
      select: { id: true },
    });
    const ids = societes.map((societe) => societe.id);

    expect(ids).toContain(SOCIETE_A);
    expect(ids).toContain(SOCIETE_B);
  });

  it("lit les agences des deux sociétés, et les parités", async () => {
    const agences = await clientReporting().agence.findMany({
      select: { societe_id: true },
    });
    expect(new Set(agences.map((agence) => agence.societe_id))).toEqual(
      new Set([SOCIETE_A, SOCIETE_B]),
    );

    await expect(clientReporting().devise.findMany()).resolves.toHaveLength(2);
  });
});

describe("rôle de consolidation — ce qu'il NE PEUT PAS", () => {
  afterAll(fermerClients);

  it("n'écrit rien, pas même sur les tables qu'il lit (SELECT seul)", async () => {
    await expect(
      clientReporting().societe.updateMany({
        where: { id: SOCIETE_A },
        data: { raison_sociale: "Renommée par le reporting" },
      }),
    ).rejects.toThrow(/permission denied/i);

    await expect(
      clientReporting().agence.deleteMany({ where: { societe_id: SOCIETE_A } }),
    ).rejects.toThrow(/permission denied/i);
  });

  it("ne lit aucune table de données personnelles (D21, garde-fou n°1)", async () => {
    // `BYPASSRLS` ne sert à rien sans droit de lecture : c'est le GRANT, pas la
    // politique, qui ferme ces tables. Les deux barrières sont indépendantes.
    await expect(clientReporting().utilisateur.findMany()).rejects.toThrow(
      /permission denied/i,
    );
    await expect(
      clientReporting().utilisateurSociete.findMany(),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      clientReporting().utilisateurClient.findMany(),
    ).rejects.toThrow(/permission denied/i);
    await expect(clientReporting().session.findMany()).rejects.toThrow(
      /permission denied/i,
    );
    await expect(clientReporting().compte.findMany()).rejects.toThrow(
      /permission denied/i,
    );
    await expect(clientReporting().secondFacteur.findMany()).rejects.toThrow(
      /permission denied/i,
    );
    await expect(clientReporting().journalAcces.findMany()).rejects.toThrow(
      /permission denied/i,
    );
  });
});

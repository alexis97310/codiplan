import { afterAll, describe, expect, it } from "vitest";

import {
  diagnostiquerRoleReporting,
  verifierRoleApplicatif,
  verifierRoleReporting,
} from "@/lib/db/garde-role";
import { uuidv7 } from "@/lib/db/uuid";

import {
  ecartsPrivilegesConsolidation,
  PRIVILEGE_AUTORISE,
  ROLE_CONSOLIDATION,
  SQL_PRIVILEGES_CONSOLIDATION,
  versPrivileges,
  type LignePrivilege,
} from "../../scripts/lib/privileges-consolidation";

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

  it("ne peut pas ÉCRIRE le journal des accès — la journalisation est l'affaire de l'APPLICATION (D21, précisé le 10/09/2026)", async () => {
    // D21 disait « il n'a que SELECT » ET « toute requête passant par lui est
    // journalisée » — journaliser est une écriture, et les deux ne peuvent pas
    // être vrais du MÊME rôle. Ce qui les réconcilie est QUI écrit : c'est
    // `avecConsolidation` (lib/reporting/connexion.ts), sur la connexion
    // applicative, AVANT la requête de consolidation. Ce scénario tient la
    // moitié que la base peut tenir : le rôle de consolidation ne peut pas
    // écrire cette table. L'autre moitié — que l'application l'écrit bien —
    // est le code lui-même, et le gardien statique de `connexion-reservee`.
    await expect(
      clientReporting().$executeRawUnsafe(
        `INSERT INTO "journal_acces" ("id", "utilisateur_id", "evenement", "detail")
         VALUES ($1::uuid, $1::uuid, 'requete_consolidation', 'tentative sous le rôle de consolidation')`,
        uuidv7(),
      ),
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

describe("rôle de consolidation — privilèges observés, non déclarés (D38)", () => {
  afterAll(fermerClients);

  /**
   * `codiplan_reporting` est une clé passe-partout : il voit toutes les sociétés
   * et il peut se connecter. Ce qui l'empêche d'être dangereux tient à une seule
   * chose — il ne détient que `SELECT`. Les scénarios ci-dessus l'éprouvent par
   * l'usage, en tentant d'écrire ; celui-ci l'éprouve par le CATALOGUE, ce qui
   * n'est pas la même chose : l'usage ne couvre que les tables auxquelles on a
   * pensé, le catalogue les couvre toutes, y compris celles des lots à venir.
   *
   * C'est exactement le contrôle que `scripts/controle-cloisonnement.mts` joue
   * contre la base hébergée, avec la même requête et la même règle.
   */
  async function privilegesObserves() {
    const lignes = await clientOwner().$queryRawUnsafe<LignePrivilege[]>(
      SQL_PRIVILEGES_CONSOLIDATION,
      ROLE_CONSOLIDATION,
    );
    return versPrivileges(lignes);
  }

  it("ne détient AUCUN privilège autre que SELECT", async () => {
    const observes = await privilegesObserves();

    expect(
      ecartsPrivilegesConsolidation(observes),
      "un privilège d'écriture sur la connexion qui contourne le " +
        "cloisonnement est une porte dérobée (D38)",
    ).toEqual([]);
  });

  it("détient bien quelque chose — sans quoi le contrôle serait aveugle", async () => {
    const observes = await privilegesObserves();

    // Le périmètre de consolidation, table par table. Un contrôle qui
    // n'observerait rien passerait au vert en ne prouvant rien : c'est
    // précisément le cas que `ecartsPrivilegesConsolidation` traite en échec.
    //
    // La liste est écrite EN TOUTES LETTRES, et c'est voulu : chaque ajout au
    // périmètre de `codiplan_reporting` est une décision, jamais un effet de
    // bord (D21, garde-fou n°1 — `ALTER DEFAULT PRIVILEGES` ne vise que le
    // rôle applicatif). Quatre tables sont venues de la migration L0-06 ; les
    // quatre du calendrier ont été ajoutées par L0-08 parce que D13 range les
    // « jours ouvrés des indicateurs » sous « agence, agrégé par société », et
    // qu'aucune d'elles ne porte de donnée personnelle.
    expect(observes.map((accorde) => accorde.table).sort()).toEqual([
      "agence",
      "calendrier",
      "calendrier_ferie",
      "calendrier_plage",
      "devise",
      "jour_ferie",
      "parite",
      "societe",
    ]);
    for (const accorde of observes) {
      expect(accorde.privilege).toBe(PRIVILEGE_AUTORISE);
      expect(accorde.transmissible).toBe(false);
    }
  });
});

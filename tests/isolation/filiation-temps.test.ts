import { afterAll, describe, expect, it } from "vitest";

import {
  INTERVENTION_A1_S1,
  INTERVENTION_A1_S2,
  SITE_A1_S1,
  SOCIETE_A,
  TEMPS_A1_S1,
  TEMPS_A1_S2,
  CLIENT_A1,
} from "./setup/fixtures";
import {
  avecPortail,
  clientOwner,
  fermerClients,
  observerSousProprietaire,
  sousSociete,
} from "./setup/db";

/**
 * LA FORME « FILIATION », ÉPROUVÉE PAR LECTURE — ticket L2-10, D82.
 *
 * *Une fille est visible si son parent l'est.* `intervention_temps` est la
 * première table fille réelle d'une table du parc, et sa politique n'a AUCUNE
 * colonne de site à filtrer : elle obtient la visibilité de son parent, qui est
 * de forme « parc ».
 *
 * **La preuve par LECTURE est la plus forte** (§9, 31/08) : de vraies lignes,
 * sous le vrai rôle applicatif, à travers le vrai chemin de contexte. Une
 * assertion sur le texte de la politique dirait seulement qu'elle est écrite ;
 * celle-ci dit qu'elle mord.
 *
 * **Deux interventions du MÊME client sur DEUX sites**, et c'est indispensable :
 * avec une seule, le filtre serait vrai par vacuité et l'épreuve serait creuse.
 */
describe("la forme « filiation » sur intervention_temps (D82)", () => {
  afterAll(fermerClients);

  const tempsVus = (tx: { $queryRawUnsafe: <T>(sql: string) => Promise<T> }) =>
    tx.$queryRawUnsafe<Array<{ id: string; intervention_id: string }>>(
      `SELECT "id", "intervention_id" FROM "intervention_temps" ORDER BY "id"`,
    );

  it("TÉMOIN : la politique est en vigueur, et elle mord", async () => {
    // Le témoin PRÉALABLE du §9 (07/09) : sans lui, une base reconstruite
    // entre-temps rendrait un vert qui ne parle de rien. Il porte sur le
    // MÉCANISME — les deux drapeaux — et sur le fait qu'il refuse déjà sans
    // contexte, jamais sur un décompte qui pourrait être légitimement nul.
    const drapeaux = await clientOwner().$queryRawUnsafe<
      Array<{ enable: boolean; force: boolean }>
    >(
      `SELECT "relrowsecurity" AS "enable", "relforcerowsecurity" AS "force"
         FROM "pg_class" WHERE "relname" = 'intervention_temps'`,
    );
    expect(drapeaux[0]).toEqual({ enable: true, force: true });

    // Sans contexte de société, le rôle applicatif ne voit rien.
    const sansContexte = await sousSociete("", (tx) => tempsVus(tx));
    expect(sansContexte).toEqual([]);

    // Et la base en porte bien deux — sinon les scénarios ci-dessous
    // compareraient du vide à du vide.
    const reelles = await observerSousProprietaire(
      "témoin de population : la table porte deux lignes",
    ).$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "intervention_temps"`,
    );
    expect(reelles).toHaveLength(2);
  });

  it("un utilisateur INTERNE de la société voit les deux lignes", async () => {
    // La branche « app.client_id absent » du parent : un interne voit tout le
    // parc de sa société, donc les temps des deux sites.
    const vus = await sousSociete(SOCIETE_A, (tx) => tempsVus(tx));
    expect(vus.map((ligne) => ligne.id).sort()).toEqual(
      [TEMPS_A1_S1, TEMPS_A1_S2].sort(),
    );
  });

  it("un compte PORTAIL restreint au site S1 ne voit QUE le temps de S1", async () => {
    // **C'est l'épreuve du ticket.** Rien sur la ligne de temps ne dit le
    // site : la clause l'obtient du parent, dont la politique de forme « parc »
    // porte le périmètre. Si la filiation ne se propageait pas, les deux lignes
    // remonteraient.
    const vus = await avecPortail(
      {
        societeId: SOCIETE_A,
        clientId: CLIENT_A1,
        perimetreSites: [SITE_A1_S1],
      },
      (tx) => tempsVus(tx),
    );

    expect(vus).toHaveLength(1);
    expect(vus[0]?.id).toBe(TEMPS_A1_S1);
    expect(vus[0]?.intervention_id).toBe(INTERVENTION_A1_S1);
  });

  /**
   * LE JUMEAU (§9, 24/08) — il retire RÉELLEMENT la filiation et montre la
   * fuite. Sans lui, le scénario ci-dessus prouve que le verrou mordait le jour
   * où on l'a écrit, jamais qu'il mord encore.
   *
   * La faute rejouée est celle qu'un correcteur bien intentionné commettrait :
   * « la clause de société suffit, la sous-requête coûte cher ». Le DDL étant
   * transactionnel en PostgreSQL, la politique revient au `ROLLBACK`.
   */
  it("JUMEAU : la filiation retirée, le portail de S1 lit le temps de S2", async () => {
    class Annulation extends Error {}
    let fuite: Array<{ id: string }> | undefined;

    try {
      await clientOwner().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP POLICY "cloisonnement_filiation" ON "intervention_temps"`,
        );
        await tx.$executeRawUnsafe(
          `CREATE POLICY "cloisonnement_filiation" ON "intervention_temps"
             USING ("societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid)
             WITH CHECK ("societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid)`,
        );

        // La lecture fautive se fait DANS la même transaction, sous le rôle
        // applicatif : on ne peut donc pas passer par `avecPortail`, qui ouvre
        // la sienne. Le contexte est posé à la main ICI, et seulement ici —
        // c'est le seul endroit du dépôt où c'est légitime, la transaction
        // étant annulée.
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "codiplan_app"`);
        await tx.$executeRawUnsafe(
          `SELECT set_config('app.societe_id', $1, true)`,
          SOCIETE_A,
        );
        await tx.$executeRawUnsafe(
          `SELECT set_config('app.client_id', $1, true)`,
          CLIENT_A1,
        );
        await tx.$executeRawUnsafe(
          `SELECT set_config('app.perimetre_sites', $1, true)`,
          SITE_A1_S1,
        );

        fuite = await tx.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT "id" FROM "intervention_temps" ORDER BY "id"`,
        );
        throw new Annulation();
      });
    } catch (erreur) {
      if (!(erreur instanceof Annulation)) {
        throw erreur;
      }
    }

    // LA VIOLATION A BIEN EU LIEU (§9, 30/08) : sans la filiation, le compte
    // restreint au site S1 lit AUSSI le temps passé sur S2 — c'est-à-dire la
    // durée des visites d'un atelier dont il n'a pas le périmètre.
    expect(fuite).toBeDefined();
    expect(fuite?.map((ligne) => ligne.id).sort()).toEqual(
      [TEMPS_A1_S1, TEMPS_A1_S2].sort(),
    );

    // Et la politique est revenue : la transaction a été annulée.
    const apres = await avecPortail(
      {
        societeId: SOCIETE_A,
        clientId: CLIENT_A1,
        perimetreSites: [SITE_A1_S1],
      },
      (tx) => tempsVus(tx),
    );
    expect(apres).toHaveLength(1);
    expect(apres[0]?.intervention_id).not.toBe(INTERVENTION_A1_S2);
  });
});

import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { avecContexteApplicatif } from "@/lib/db/client";

import { clientApp, fermerClients, observerSousProprietaire } from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_A2,
  MACHINE_A1,
  MACHINE_A2,
  PORTAIL_A2_CLIENT,
  PORTAIL_A_CLIENT,
  SITE_A1_S1,
  SOCIETE_A,
} from "./setup/fixtures";

/**
 * L'APPELANT DÉSIGNE, LA BASE DISPOSE — la pose de `app.client_id` (D70).
 *
 * ## Ce que ce fichier éprouve, et pourquoi il existe
 *
 * La forme « parc » (D10, D22) traite un `app.client_id` VIDE comme
 * « utilisateur interne » : le filtre de client disparaît. Jusqu'au 09/09,
 * `avecContexteApplicatif` — le seul chemin de production qui ouvre une
 * transaction cloisonnée depuis une session — ne savait pas le renseigner. Un
 * compte portail y aurait lu le parc ENTIER de sa société.
 *
 * **La réparation n'est ni « l'appelant fournit » ni « la base dérive ».** La
 * dérivation n'est pas unique — `utilisateur_client` porte
 * `UNIQUE (utilisateur_id, client_id)` —, et une valeur venue de l'extérieur ne
 * vaut rien sans validation. L'appelant DÉSIGNE, la base DISPOSE.
 *
 * ## Ce fichier est un APPELANT, pas seulement une assertion
 *
 * Tout passe par `avecContexteApplicatif` et par la vraie fonction de base :
 * aucune variable n'est armée à la main. C'est la leçon du 08/09 — *une suite
 * qui éprouve tous les maillons n'éprouve pas la chaîne.*
 */
describe("la désignation du client par un compte portail", () => {
  afterAll(fermerClients);

  /** Ce qu'une session porte, une fois le client désigné. */
  function session(utilisateurId: string, clientId: string | null) {
    return {
      utilisateurId,
      societeId: SOCIETE_A,
      role: Role.client,
      secondFacteurValide: true,
      adresseIp: null,
      clientId,
    };
  }

  const machinesVues = (tx: {
    $queryRawUnsafe: <T>(sql: string) => Promise<T>;
  }) =>
    tx.$queryRawUnsafe<Array<{ id: string; site_id: string }>>(
      `SELECT "id", "site_id" FROM "machine" ORDER BY "id"`,
    );

  it("TÉMOIN — la politique du parc mord : sans contexte, zéro machine", async () => {
    // Sans ce témoin, tout ce qui suit pourrait être vert sur une base où la
    // RLS ne s'applique pas (§9, 07/09 : toute mesure d'une politique porte un
    // témoin préalable). La connexion est celle du rôle applicatif, ni
    // propriétaire ni BYPASSRLS — son propre démarrage le prouve.
    const vues = await clientApp().$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "machine"`,
    );
    expect(vues).toHaveLength(0);
  });

  describe("la DÉSIGNATION — ce que l'appelant doit dire", () => {
    it("un rôle du portail SANS client désigné est refusé", async () => {
      // Le sens qu'on ferme : `app.client_id` vide rouvrirait la branche
      // « utilisateur interne » de la forme « parc ».
      await expect(
        avecContexteApplicatif(
          session(PORTAIL_A_CLIENT, null),
          async () => "ne doit jamais s'exécuter",
          clientApp(),
        ),
      ).rejects.toThrow(/parc ENTIER/);
    });

    it("un rôle INTERNE qui désigne un client est refusé — l'autre sens", async () => {
      // Celui qu'on oublie. `app.client_id` est le DISCRIMINANT de la forme
      // « habilitation » (L1-02b) : c'est lui qui distingue un compte portail
      // d'un `admin_societe`. Le poser pour un rôle interne déplacerait en
      // silence ce que cette forme discrimine.
      await expect(
        avecContexteApplicatif(
          { ...session(PORTAIL_A_CLIENT, CLIENT_A1), role: Role.adv },
          async () => "ne doit jamais s'exécuter",
          clientApp(),
        ),
      ).rejects.toThrow(/n'est pas un rôle du portail/);
    });
  });

  describe("LA DISPOSITION — ce que la base accorde", () => {
    it("un client HABILITÉ : la pose passe, et les TROIS filtres mordent", async () => {
      const vues = await avecContexteApplicatif(
        session(PORTAIL_A_CLIENT, CLIENT_A1),
        machinesVues,
        clientApp(),
      );

      // Une seule machine : celle du client A1 ET du site du périmètre.
      // `MACHINE_A2` appartient au MÊME client et à un AUTRE site — c'est elle
      // qui prouve que le troisième filtre mord, et qu'il est le seul à séparer
      // deux machines d'un même client.
      expect(vues.map((ligne) => ligne.id)).toEqual([MACHINE_A1]);
      expect(vues[0]?.site_id).toBe(SITE_A1_S1);
      expect(MACHINE_A2).not.toBe(MACHINE_A1);
    });

    it("un client RÉEL mais NON habilité : la base LÈVE, elle ne rend pas vide", async () => {
      // `CLIENT_A2` existe, il est dans la même société, et ce compte n'y est
      // pas habilité. Une pose silencieusement vide aurait rouvert tout le parc :
      // c'est pourquoi la fonction lève au lieu de retomber sur la chaîne vide.
      await expect(
        avecContexteApplicatif(
          session(PORTAIL_A_CLIENT, CLIENT_A2),
          machinesVues,
          clientApp(),
        ),
      ).rejects.toThrow(/hors des habilitations/);
    });

    it("et le refus ANNULE LA TRANSACTION — rien ne se lit après lui", async () => {
      // La fenêtre entre la pose et la validation porte une valeur non
      // vérifiée. Ce scénario mesure ce qui la referme : l'exception avorte la
      // transaction entière, si bien qu'aucune lecture ne peut suivre.
      let aLu = false;
      await expect(
        avecContexteApplicatif(
          session(PORTAIL_A_CLIENT, CLIENT_A2),
          async (tx) => {
            aLu = true;
            return machinesVues(tx);
          },
          clientApp(),
        ),
      ).rejects.toThrow();
      expect(
        aLu,
        "le travail ne doit même pas commencer : la pose échoue avant lui",
      ).toBe(false);
    });

    it("le compte VOISIN désigne SON client, et ne voit pas le parc de l'autre", async () => {
      // `PORTAIL_A2_CLIENT` est habilité sur `CLIENT_A2`, qui n'a aucune
      // machine. Le témoin de non-vacuité est ailleurs : le scénario ci-dessus
      // montre que 1 machine est visible pour l'autre compte, donc ce zéro-ci
      // est un refus et non une base vide.
      const vues = await avecContexteApplicatif(
        session(PORTAIL_A2_CLIENT, CLIENT_A2),
        machinesVues,
        clientApp(),
      );
      expect(vues).toHaveLength(0);
    });
  });

  /**
   * LE JUMEAU — il retire le verrou VISÉ, et montre ce qui passe alors.
   *
   * Le verrou est la moitié « disposition » de la fonction : le `EXISTS` sur
   * `utilisateur_client`. Le jumeau la remplace par la version d'AVANT D70 —
   * celle qui posait le périmètre sans rien valider —, dans une transaction
   * annulée, le DDL étant transactionnel en PostgreSQL.
   *
   * **Il ne passe pas par `avecContexteApplicatif`, et c'est une contrainte, pas
   * un choix.** Le DDL d'une transaction non validée est invisible aux autres
   * connexions : mesurer sous le rôle applicatif depuis sa propre connexion
   * mesurerait la fonction INCHANGÉE. Tout se joue donc sur une seule
   * connexion, avec `SET LOCAL ROLE` pour que les politiques mordent — le
   * propriétaire est superutilisateur sur la base jetable et les
   * contournerait. Le contexte y est posé comme `instructionContexte` le pose,
   * et la fonction appelée est bien celle de production ; ce que ce scénario
   * n'éprouve pas — le chemin applicatif — est éprouvé par les cinq
   * ci-dessus.
   */
  it("JUMEAU — sans la validation, désigner le client d'autrui l'OUVRE", async () => {
    const proprietaire = observerSousProprietaire(
      "remplace la fonction de désignation par sa version d'avant D70 puis " +
        "annule : seul le propriétaire peut jouer ce DDL, et il doit être vu " +
        "par la même connexion que la mesure.",
    );

    const SANS_VALIDATION = `
      CREATE OR REPLACE FUNCTION "app_poser_perimetre_client"(
        "p_utilisateur" uuid, "p_client" uuid
      ) RETURNS void LANGUAGE plpgsql SET search_path = pg_catalog, public
      AS $jumeau$
      BEGIN
        PERFORM set_config('app.perimetre_sites', coalesce((
          SELECT string_agg("ucs"."site_id"::text, ',' ORDER BY "ucs"."site_id")
            FROM "utilisateur_client_site" "ucs"
            JOIN "utilisateur_client" "uc"
              ON "uc"."id" = "ucs"."utilisateur_client_id"
           WHERE "uc"."utilisateur_id" = "p_utilisateur"
             AND "uc"."client_id" = "p_client" AND "uc"."actif"
        ), ''), true);
      END;
      $jumeau$;`;

    let vues: string[] = [];
    await expect(
      proprietaire.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(SANS_VALIDATION);
        // Les politiques ne mordent pas le propriétaire : sans cette bascule,
        // le jumeau lirait tout et ne prouverait rien (§9, 31/08).
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "codiplan_app"`);
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.societe_id',$1,true), " +
            "set_config('app.utilisateur_id',$2,true), " +
            "set_config('app.client_id',$3,true), " +
            "set_config('app.perimetre_sites','',true)",
          SOCIETE_A,
          PORTAIL_A_CLIENT,
          CLIENT_A2,
        );
        // La désignation refusée plus haut ne lève plus.
        await tx.$executeRawUnsafe(
          `SELECT "app_poser_perimetre_client"($1::uuid, $2::uuid)`,
          PORTAIL_A_CLIENT,
          CLIENT_A2,
        );
        const lignes = await tx.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT "id" FROM "client"`,
        );
        vues = lignes.map((ligne) => ligne.id);
        throw new Error("annulation volontaire du jumeau");
      }),
    ).rejects.toThrow(/annulation volontaire/);

    // C'est ICI que le jumeau prouve quelque chose : sans cette égalité, il ne
    // montrerait que la disparition d'un refus, jamais ce que le refus fermait.
    expect(vues).toEqual([CLIENT_A2]);
    expect(CLIENT_A2).not.toBe(CLIENT_A1);

    // Et le verrou est REVENU avec le `ROLLBACK` : la même désignation est de
    // nouveau refusée, par le chemin de production cette fois.
    await expect(
      avecContexteApplicatif(
        session(PORTAIL_A_CLIENT, CLIENT_A2),
        machinesVues,
        clientApp(),
      ),
    ).rejects.toThrow(/hors des habilitations/);
  });
});

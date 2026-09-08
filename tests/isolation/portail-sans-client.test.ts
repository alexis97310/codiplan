import { afterAll, describe, expect, it } from "vitest";

import { avecContexteApplicatif } from "@/lib/db/client";
import { avecContexteRls } from "@/lib/db/rls";
import { Role } from "@/lib/auth/roles";

import { clientApp, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_A2,
  MACHINE_A1,
  MACHINE_A2,
  PORTAIL_A2_CLIENT,
  SOCIETE_A,
} from "./setup/fixtures";

/**
 * `app.client_id` N'A AUCUN POSEUR DE PRODUCTION — et ce que cela coûterait.
 *
 * ## Ce que ce fichier mesure
 *
 * La forme « parc » (D10, D22) lit `app.client_id` et traite une valeur VIDE
 * comme « utilisateur interne » : le filtre de client disparaît, et le parc
 * entier de la société s'ouvre. C'est voulu — c'est ainsi qu'un technicien voit
 * le parc de sa société.
 *
 * `avecContexteApplicatif`, le SEUL chemin de production qui ouvre une
 * transaction cloisonnée depuis une session, ne peut pas renseigner cette
 * variable : `ContexteSession` ne porte aucun champ de client. Elle part donc
 * toujours à vide.
 *
 * ## Pourquoi ce fichier existe alors que rien n'est cassé aujourd'hui
 *
 * Parce que **rien ne le dirait**. Le gardien de L1-02b vérifie que toute
 * variable lue par une politique est POSÉE par le chemin de production — et
 * `app.client_id` l'est, toujours à vide. *Un gardien qui vérifie qu'une
 * variable est posée ne vérifie pas qu'elle est renseignable.* Et le défaut ne
 * casse rien tant qu'aucun compte portail n'atteint ce chemin : c'est le §9 du
 * 08/09 — un défaut invisible parce que ce qu'il casse n'existe pas encore.
 *
 * Ce fichier est donc l'APPELANT que cette chaîne n'avait pas.
 */
describe("le portail sans `app.client_id`", () => {
  afterAll(fermerClients);

  /** Le contexte de session d'un compte portail du client A2, tel qu'il serait. */
  const sessionPortail = {
    utilisateurId: PORTAIL_A2_CLIENT,
    societeId: SOCIETE_A,
    role: Role.client,
    secondFacteurValide: true,
    adresseIp: null,
  };

  it("TÉMOIN — la politique du parc mord : sans contexte, zéro machine", async () => {
    // Sans ce témoin, les deux scénarios suivants pourraient être verts sur une
    // base où la RLS ne s'applique pas du tout (§9, 07/09 : toute mesure d'une
    // politique porte un témoin préalable). La connexion est celle du rôle
    // applicatif, ni propriétaire ni BYPASSRLS — son propre démarrage le prouve.
    const vues = await clientApp().$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "machine"`,
    );
    expect(vues).toHaveLength(0);
  });

  it("le chemin de production REFUSE d'ouvrir une transaction pour le portail", async () => {
    await expect(
      avecContexteApplicatif(
        sessionPortail,
        async () => "cette fonction ne doit jamais s'exécuter",
        clientApp(),
      ),
    ).rejects.toThrow(/app\.client_id/);
  });

  /**
   * LE JUMEAU — il retire le verrou VISÉ, et il montre ce qui passe alors.
   *
   * Le verrou est ici une décision de code, pas une contrainte de base : le
   * jumeau ne peut donc pas la retirer par `ALTER`. Il fait la seule chose
   * équivalente — il construit EXACTEMENT le contexte RLS que
   * `avecContexteApplicatif` produirait si le refus n'existait pas, c'est-à-dire
   * les quatre scalaires de la session et `clientId` non fourni — et il mesure.
   *
   * Ce qu'il doit montrer, et qui est la raison d'être du refus : un compte
   * portail du client A2 lit les machines du client A1.
   */
  it("JUMEAU — sans ce refus, le portail du client A2 lit le parc du client A1", async () => {
    const vues = await avecContexteRls(
      clientApp(),
      {
        societeId: sessionPortail.societeId,
        role: sessionPortail.role,
        auteurId: sessionPortail.utilisateurId,
        adresseIp: sessionPortail.adresseIp,
        // `clientId` ABSENT — c'est tout ce que le chemin de production sait
        // faire, et c'est le verrou retiré.
      },
      (tx) =>
        tx.$queryRawUnsafe<Array<{ id: string; client_id: string }>>(
          `SELECT "id", "client_id" FROM "machine" ORDER BY "id"`,
        ),
    );

    expect(vues.map((ligne) => ligne.id)).toEqual([MACHINE_A1, MACHINE_A2]);
    // Et la phrase qui dit pourquoi c'est une fuite : ces machines
    // n'appartiennent PAS au client de ce compte portail.
    expect(new Set(vues.map((ligne) => ligne.client_id))).toEqual(
      new Set([CLIENT_A1]),
    );
    expect(CLIENT_A1).not.toBe(CLIENT_A2);
  });

  it("et le MÊME contexte, `clientId` posé, ne rend rien — la variable suffit", async () => {
    // La contre-épreuve du jumeau : ce n'est pas la société qui manquait, ni le
    // rôle, ni l'authentification. C'est cette seule variable.
    const vues = await avecContexteRls(
      clientApp(),
      {
        societeId: sessionPortail.societeId,
        role: sessionPortail.role,
        auteurId: sessionPortail.utilisateurId,
        adresseIp: sessionPortail.adresseIp,
        clientId: CLIENT_A2,
      },
      (tx) =>
        tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "machine"`),
    );
    expect(vues).toHaveLength(0);
  });
});

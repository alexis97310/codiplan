import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import {
  lireFicheIntervention,
  lireIntervention,
  listerPlanning,
} from "@/lib/interventions/depot";

import { clientApp, fermerClients, sousSocieteEtRole } from "./setup/db";
import {
  CLIENT_A1,
  INTERVENTION_A1,
  INTERVENTION_A2,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * R5-01 — LE TECHNICIEN NE VOIT QUE SON PLANNING, mesuré sur de vraies lignes.
 *
 * ## CE QUE CE FICHIER ÉTABLIT, ET CE QU'IL ÉCRIT NOIR SUR BLANC
 *
 * **La base ne tient PAS cette restriction, et c'est mesuré ici plutôt que
 * supposé.** La politique de `intervention` est de forme « parc » (D84) : elle
 * répond « quelle société, quel client, quels sites », jamais « quelle
 * personne ». Le premier scénario lit donc les DEUX interventions de la
 * société A sous le contexte cloisonné du technicien — *c'est le jumeau de
 * cette restriction : il montre ce que la couche applicative retranche, et
 * combien il y aurait à voir sans elle.*
 *
 * Ce n'est pas une seconde lecture d'un critère que la base porte déjà (le
 * défaut que ce dépôt refuse partout) : rien en base ne répond à la question.
 * *C'est une garantie qui vit dans la couche applicative, et il faut le lire
 * comme tel* — la question de savoir si la base doit la porter est ouverte,
 * elle ajouterait une forme de politique, et une forme est un arbitrage.
 */

afterAll(fermerClients);

const PERIODE_DU = new Date("2020-01-01T00:00:00.000Z");
const PERIODE_AU = new Date("2100-01-01T00:00:00.000Z");

function session(role: Role, utilisateurId: string) {
  return {
    utilisateurId,
    societeId: SOCIETE_A,
    role,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: role === Role.client ? CLIENT_A1 : null,
  };
}

const TECHNICIEN = session(Role.technicien, UTILISATEUR_PAR_ROLE.technicien);
const PLANIFICATEUR = session(Role.adv, UTILISATEUR_INTERNE_A);

describe("le périmètre du technicien", () => {
  /**
   * LE TÉMOIN, ET IL EST AUSSI LE JUMEAU.
   *
   * Sous le contexte cloisonné du technicien, SANS la restriction applicative,
   * la base rend les deux interventions de la société. Si ce scénario rendait
   * 1, la mesure suivante ne prouverait rien — elle constaterait une base qui
   * filtre déjà.
   */
  it("la base seule rend les DEUX interventions au technicien", async () => {
    const lignes = await sousSocieteEtRole(SOCIETE_A, Role.technicien, (tx) =>
      tx.intervention.findMany({
        where: { societe_id: SOCIETE_A },
        select: { id: true, technicien_id: true },
      }),
    );
    expect(lignes).toHaveLength(2);
    expect(new Set(lignes.map((l) => l.technicien_id))).toEqual(
      new Set([UTILISATEUR_PAR_ROLE.technicien, UTILISATEUR_INTERNE_A]),
    );
  });

  it("le planificateur voit les deux, le technicien une seule", async () => {
    const complet = await listerPlanning(
      PLANIFICATEUR,
      PERIODE_DU,
      PERIODE_AU,
      clientApp(),
    );
    const restreint = await listerPlanning(
      TECHNICIEN,
      PERIODE_DU,
      PERIODE_AU,
      clientApp(),
    );

    expect(complet.map((l) => l.id).sort()).toEqual(
      [INTERVENTION_A1, INTERVENTION_A2].sort(),
    );
    expect(restreint.map((l) => l.id)).toEqual([INTERVENTION_A1]);
  });

  /**
   * L'intervention d'AUTRUI est « introuvable » et rien de plus — jamais un
   * refus qui la nomme. *Distinguer « elle n'existe pas » de « elle n'est pas
   * à vous » ferait un oracle* (D35, D50).
   */
  it("la fiche d'un autre technicien est introuvable, la sienne se lit", async () => {
    expect(
      await lireFicheIntervention(TECHNICIEN, INTERVENTION_A2, clientApp()),
    ).toBeNull();
    expect(
      await lireFicheIntervention(PLANIFICATEUR, INTERVENTION_A2, clientApp()),
    ).not.toBeNull();
    expect(
      await lireIntervention(TECHNICIEN, INTERVENTION_A2, clientApp()),
    ).toBeNull();
    expect(
      await lireIntervention(TECHNICIEN, INTERVENTION_A1, clientApp()),
    ).not.toBeNull();
  });

  /**
   * Un rôle sans `consulter_planning` REFUSE, il ne rend pas zéro ligne : un
   * planning vide se lirait « il n'y a rien » là où il faut lire « ce n'est
   * pas pour vous ».
   */
  it("un compte de portail se voit refuser le planning", async () => {
    await expect(
      listerPlanning(
        session(Role.client, UTILISATEUR_PAR_ROLE.client),
        PERIODE_DU,
        PERIODE_AU,
        clientApp(),
      ),
    ).rejects.toThrow(/aucun accès au planning/);
  });
});

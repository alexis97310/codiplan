import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { avecContexteApplicatif } from "@/lib/db/client";

import {
  clientApp,
  fermerClients,
  observerSousProprietaire,
  sousSociete,
} from "./setup/db";
import {
  CLIENT_A1,
  INTERVENTION_A1,
  INTERVENTION_A2,
  INTERVENTION_B1,
  PORTAIL_A_CLIENT,
  SITE_A1_S1,
  SOCIETE_A,
  SOCIETE_B,
} from "./setup/fixtures";

/**
 * L'ORDRE D'INTERVENTION, ÉPROUVÉ SOUS LE RÔLE APPLICATIF (lot 2, D84).
 *
 * ## Ce que ce fichier mesure, et ce qu'il ne mesure pas
 *
 * Il mesure **ce que la BASE refuse**, jamais ce que l'écran refuse. La règle
 * de l'exploitation est explicite et c'est la bonne : *une action refusée à
 * l'écran mais acceptée par la base est un trou.* Un écran se contourne par une
 * requête ; ce qui suit ne se contourne pas.
 *
 * Trois garanties, et elles sont de natures différentes :
 *
 * 1. **Le cloisonnement** — forme « parc », les trois filtres.
 * 2. **Le figeage** — une intervention clôturée ou annulée ne se modifie plus.
 * 3. **La clôture sans temps** — refusée, `temps_reel_min` étant l'entrée de
 *    l'arrondi et du plancher (D83).
 *
 * Chacune porte son JUMEAU (§9, 24/08) : le verrou est réellement retiré dans
 * une transaction annulée, et l'écriture fautive passe alors. Sans lui, un
 * refus venu d'ailleurs passerait pour le bon.
 */
describe("l'intervention, sous le rôle applicatif", () => {
  afterAll(fermerClients);

  const lues = (tx: { $queryRawUnsafe: <T>(sql: string) => Promise<T> }) =>
    tx.$queryRawUnsafe<Array<{ id: string; site_id: string }>>(
      `SELECT "id", "site_id" FROM "intervention" ORDER BY "id"`,
    );

  it("TÉMOIN — la politique mord : sans contexte, zéro intervention", async () => {
    // Sans ce témoin, tout ce qui suit serait vert sur une base où la RLS ne
    // s'applique pas (§9, 07/09). Il porte sur le MÉCANISME, pas sur un
    // décompte : trois lignes existent réellement, et l'assertion suivante le
    // montre en en rendant deux.
    const vues = await clientApp().$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "intervention"`,
    );
    expect(vues).toHaveLength(0);
  });

  describe("le cloisonnement — forme « parc », les trois filtres", () => {
    it("un rôle INTERNE voit les interventions de SA société, et elles seules", async () => {
      const vues = await sousSociete(SOCIETE_A, lues);
      expect(vues.map((l) => l.id).sort()).toEqual(
        [INTERVENTION_A1, INTERVENTION_A2].sort(),
      );
      // Le témoin qui sépare « la politique filtre » de « la table est vide » :
      // la ligne de B existe, et une autre société la voit.
      const vuesB = await sousSociete(SOCIETE_B, lues);
      expect(vuesB.map((l) => l.id)).toEqual([INTERVENTION_B1]);
    });

    it("un compte PORTAIL ne voit que le site de son périmètre", async () => {
      // Les deux interventions du client A1 sont sur DEUX sites ; le compte
      // portail n'est habilité que sur le premier. C'est le TROISIÈME filtre,
      // le seul qui sépare deux lignes d'un même client — et le seul dont
      // l'absence ne casse rien de visible.
      const vues = await avecContexteApplicatif(
        {
          utilisateurId: PORTAIL_A_CLIENT,
          societeId: SOCIETE_A,
          role: Role.client,
          secondFacteurValide: true,
          adresseIp: null,
          clientId: CLIENT_A1,
        },
        lues,
        clientApp(),
      );
      expect(vues.map((l) => l.id)).toEqual([INTERVENTION_A1]);
      expect(vues[0]?.site_id).toBe(SITE_A1_S1);
    });

    it("écrire l'intervention d'une AUTRE société est refusé", async () => {
      // Le `WITH CHECK` de la politique, éprouvé en écriture et non en lecture :
      // sous le contexte de A, on tente de déplacer la ligne de B. Zéro ligne
      // touchée — un refus de RLS n'est pas une erreur, c'est un silence, et
      // c'est ce silence qu'il faut mesurer.
      const touchees = await sousSociete(SOCIETE_A, (tx) =>
        tx.$executeRawUnsafe(
          `UPDATE "intervention" SET "priorite" = 'p1' WHERE "id" = '${INTERVENTION_B1}'`,
        ),
      );
      expect(touchees).toBe(0);
    });
  });

  describe("le FIGEAGE — clôturée et annulée ne se modifient plus", () => {
    it("une intervention CLÔTURÉE refuse toute modification autre que l'annulation", async () => {
      await expect(
        sousSociete(SOCIETE_A, async (tx) => {
          await tx.$executeRawUnsafe(
            `UPDATE "intervention" SET "statut" = 'cloturee', "temps_reel_min" = 90 WHERE "id" = '${INTERVENTION_A1}'`,
          );
          await tx.$executeRawUnsafe(
            `UPDATE "intervention" SET "priorite" = 'p1' WHERE "id" = '${INTERVENTION_A1}'`,
          );
          throw new Error("ANNULER");
        }),
      ).rejects.toThrow(/ne se modifie plus sans trace|ANNULER/);
    });

    it("mais son ANNULATION reste possible — I5 donne la préséance à ANNULEE", async () => {
      // Ce cas DOIT PASSER, et pour SA PROPRE RAISON (§9, 11/09) : un gardien
      // est un prédicat à deux directions, et celle qui ne produit jamais de
      // signal est la permissive. Si le déclencheur figeait `cloturee` tout
      // court, ce scénario tomberait — et I5 serait contredit en base.
      await expect(
        sousSociete(SOCIETE_A, async (tx) => {
          await tx.$executeRawUnsafe(
            `UPDATE "intervention" SET "statut" = 'cloturee', "temps_reel_min" = 90 WHERE "id" = '${INTERVENTION_A2}'`,
          );
          const touchees = await tx.$executeRawUnsafe(
            `UPDATE "intervention" SET "statut" = 'annulee', "motif_annulation" = 'clôturée par erreur' WHERE "id" = '${INTERVENTION_A2}'`,
          );
          if (touchees !== 1) {
            throw new Error(`annulation refusée : ${touchees} ligne(s)`);
          }
          throw new Error("ANNULER");
        }),
      ).rejects.toThrow(/^ANNULER$/);
    });

    it("une intervention ANNULÉE ne se modifie plus du tout", async () => {
      await expect(
        sousSociete(SOCIETE_A, async (tx) => {
          await tx.$executeRawUnsafe(
            `UPDATE "intervention" SET "statut" = 'annulee', "motif_annulation" = 'reportée' WHERE "id" = '${INTERVENTION_A1}'`,
          );
          await tx.$executeRawUnsafe(
            `UPDATE "intervention" SET "priorite" = 'p1' WHERE "id" = '${INTERVENTION_A1}'`,
          );
          throw new Error("ANNULER");
        }),
      ).rejects.toThrow(/ne se modifie plus|ANNULER/);
    });

    it("JUMEAU : le déclencheur RÉELLEMENT retiré, la modification passe", async () => {
      // Le verrou VISÉ, pas un voisin : c'est `intervention_cycle_de_vie` qui
      // est retiré, et rien d'autre. Le DDL est transactionnel en PostgreSQL,
      // le déclencheur revient au `ROLLBACK`, et l'épreuve rejoue à chaque
      // exécution au lieu d'être une vérification faite une fois à la main.
      //
      // Sans ce jumeau, les trois scénarios ci-dessus prouveraient seulement
      // que QUELQUE CHOSE refuse — la politique, une contrainte, un voisin —,
      // et pas que ce déclencheur-ci mord (§9, 24/08 et 08/09).
      //
      // Il s'exécute sous le PROPRIÉTAIRE : retirer un déclencheur est un
      // geste de DDL, que le rôle applicatif ne détient pas. Ce qu'on éprouve
      // n'est pas un privilège, c'est l'effet du déclencheur sur l'écriture.
      const proprietaire = observerSousProprietaire(
        "retirer réellement `intervention_cycle_de_vie` pour montrer que " +
          "c'est LUI qui refuse, et non un voisin",
      );
      await expect(
        proprietaire.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `SET LOCAL "app.societe_id" = '${SOCIETE_A}'`,
          );
          await tx.$executeRawUnsafe(
            `DROP TRIGGER "intervention_cycle_de_vie" ON "intervention"`,
          );
          await tx.$executeRawUnsafe(
            `UPDATE "intervention" SET "statut" = 'annulee', "motif_annulation" = 'reportée' WHERE "id" = '${INTERVENTION_A1}'`,
          );
          // L'écriture que le déclencheur refusait passe MAINTENANT : c'est la
          // preuve que la violation a bien lieu quand le verrou n'est plus là.
          const touchees = await tx.$executeRawUnsafe(
            `UPDATE "intervention" SET "priorite" = 'p1' WHERE "id" = '${INTERVENTION_A1}'`,
          );
          if (touchees !== 1) {
            throw new Error(
              `le verrou retiré, la modification est encore refusée (${touchees} ligne) : ` +
                "ce n'est donc PAS ce déclencheur qui refusait",
            );
          }
          throw new Error("ANNULER");
        }),
      ).rejects.toThrow(/^ANNULER$/);
    });
  });

  describe("la CLÔTURE sans temps saisi", () => {
    it("est refusée par la base, et le message nomme la règle", async () => {
      await expect(
        sousSociete(SOCIETE_A, async (tx) => {
          await tx.$executeRawUnsafe(
            `UPDATE "intervention" SET "statut" = 'cloturee' WHERE "id" = '${INTERVENTION_A1}'`,
          );
          throw new Error("ANNULER");
        }),
      ).rejects.toThrow(/le temps réel n'est pas saisi/);
    });

    it("passe dès que le temps est là — le cas qui DOIT rester vert", async () => {
      await expect(
        sousSociete(SOCIETE_A, async (tx) => {
          const touchees = await tx.$executeRawUnsafe(
            `UPDATE "intervention" SET "statut" = 'cloturee', "temps_reel_min" = 12 WHERE "id" = '${INTERVENTION_A1}'`,
          );
          if (touchees !== 1) {
            throw new Error(`clôture refusée : ${touchees} ligne(s)`);
          }
          throw new Error("ANNULER");
        }),
      ).rejects.toThrow(/^ANNULER$/);
    });
  });
});

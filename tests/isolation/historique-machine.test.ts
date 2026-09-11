import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import {
  historiqueDeLaMachine,
  sitesTraverses,
} from "@/lib/machines/historique";

import { avecPortail, clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  MACHINE_A1,
  SITE_A1_S1,
  SITE_A1_S2,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * L'HISTORIQUE D'UNE MACHINE SURVIT À SON DÉMÉNAGEMENT (L2-05).
 *
 * **La faute que ce fichier existe pour attraper est SILENCIEUSE** : une lecture
 * qui partirait du site de la machine rendrait un historique *amputé de tout ce
 * qui précède le déménagement*, sans rien dire. L'écran afficherait trois
 * interventions au lieu de douze, et personne ne saurait qu'il en manque neuf.
 *
 * Le scénario déménage donc réellement une machine, et compte des deux côtés.
 */

afterAll(fermerClients);

const SESSION = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

/** Rattache les deux interventions de A1 à la machine — le harnais ne le fait pas. */
async function rattacherLesInterventions(): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `UPDATE "intervention" SET "machine_id" = '${MACHINE_A1}'
      WHERE "societe_id" = '${SOCIETE_A}' AND "site_id" IN ('${SITE_A1_S1}', '${SITE_A1_S2}')`,
  );
}

describe("l'historique part de la MACHINE, jamais du site", () => {
  it("TÉMOIN — il porte des interventions de DEUX sites distincts", async () => {
    await rattacherLesInterventions();
    const historique = await historiqueDeLaMachine(
      SESSION,
      MACHINE_A1,
      clientApp(),
    );
    // Sans ce témoin, un historique d'un seul site ferait passer le scénario
    // du déménagement sans que rien ne soit éprouvé.
    expect(historique.length).toBeGreaterThanOrEqual(2);
    expect([...sitesTraverses(historique)].sort()).toEqual(
      [SITE_A1_S1, SITE_A1_S2].sort(),
    );
  });

  it("après un DÉMÉNAGEMENT, il est COMPLET — et la machine a bien bougé", async () => {
    await rattacherLesInterventions();
    const avant = await historiqueDeLaMachine(SESSION, MACHINE_A1, clientApp());

    // La machine déménage : de S1 vers S2. *Les interventions, elles, gardent
    // leur propre site — elles ont eu lieu où elles ont eu lieu.*
    const [siteInitial] = await clientOwner().$queryRawUnsafe<
      Array<{ site_id: string }>
    >(`SELECT "site_id" FROM "machine" WHERE "id" = '${MACHINE_A1}'`);
    const destination =
      siteInitial?.site_id === SITE_A1_S1 ? SITE_A1_S2 : SITE_A1_S1;

    try {
      await clientOwner().$executeRawUnsafe(
        `UPDATE "machine" SET "site_id" = '${destination}' WHERE "id" = '${MACHINE_A1}'`,
      );

      // LE TÉMOIN DU DÉMÉNAGEMENT : il a bien eu lieu. *Sans lui, une mise à
      // jour sans effet ferait passer ce scénario pour une preuve* (§9, 30/08).
      const [apresDemenagement] = await clientOwner().$queryRawUnsafe<
        Array<{ site_id: string }>
      >(`SELECT "site_id" FROM "machine" WHERE "id" = '${MACHINE_A1}'`);
      expect(apresDemenagement?.site_id).toBe(destination);
      expect(apresDemenagement?.site_id).not.toBe(siteInitial?.site_id);

      // ET L'HISTORIQUE N'A PAS BOUGÉ D'UNE LIGNE.
      const apres = await historiqueDeLaMachine(
        SESSION,
        MACHINE_A1,
        clientApp(),
      );
      expect(apres.map((l) => l.id)).toEqual(avant.map((l) => l.id));
      // …et il porte toujours les DEUX sites, dont celui que la machine vient
      // de quitter : c'est la trace du déménagement, déduite et non stockée.
      expect(sitesTraverses(apres)).toHaveLength(2);
    } finally {
      await clientOwner().$executeRawUnsafe(
        `UPDATE "machine" SET "site_id" = '${siteInitial?.site_id}' WHERE "id" = '${MACHINE_A1}'`,
      );
    }
  });
});

describe("le cloisonnement décide, pas ce module", () => {
  it("un compte portail RESTREINT ne voit que ce que son périmètre lui donne", async () => {
    await rattacherLesInterventions();
    // *Aucune comparaison de société ni de site n'est écrite dans le module* :
    // la politique d'`intervention` est de forme « parc » (D84), et c'est elle
    // qui tranche. Restreint à S1, ce compte perd l'intervention de S2 — et il
    // la perd par la BASE, non par un filtre applicatif.
    const vues = await avecPortail(
      {
        societeId: SOCIETE_A,
        clientId: CLIENT_A1,
        perimetreSites: [SITE_A1_S1],
      },
      (tx) =>
        tx.intervention.findMany({
          where: { machine_id: MACHINE_A1 },
          select: { site_id: true },
        }),
    );
    expect(vues.length).toBeGreaterThan(0);
    expect(vues.every((v) => v.site_id === SITE_A1_S1)).toBe(true);
  });
});

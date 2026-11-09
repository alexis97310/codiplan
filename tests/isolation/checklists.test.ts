import { afterAll, describe, expect, it } from "vitest";

import { type ContexteSession } from "@/lib/auth/contexte";
import {
  creerModele,
  dernierVersionPubliee,
  publierVersion,
} from "@/lib/checklists/depot";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";

import { avecPortail, clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  CLIENT_A2,
  INTERVENTION_A1,
  INTERVENTION_B1,
  SITE_A2_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_INTERNE_B,
} from "./setup/fixtures";

/**
 * LE SOCLE DES CHECKLISTS (9K08-CHECKLIST-SCHEMA, D235).
 *
 * ## Ce que ce fichier mesure
 *
 * Deux formes, chaînées : « INTERNE » (D94) sur `checklist_modele`, et
 * « FILIATION » (D103) ensuite à chaque étage — `checklist_version` sur
 * `checklist_modele`, `checklist_point` sur `checklist_version`,
 * `checklist_reponse` sur `intervention`. La décision verbatim d'Alexis du
 * 09/11/2026 ~07h45 (D235) : le bureau seul lit les trois premières ; le
 * client lit sa checklist RÉPONDUE par la quatrième, jamais par les trois
 * premières. Les clauses sont LUES depuis `pg_policies`, pas supposées (même
 * discipline que `tests/isolation/suite-a-donner.test.ts`).
 *
 * Et le chemin de production (`lib/checklists/depot.ts`), par ses trois
 * fonctions : créer un modèle, publier une version, lire la dernière version
 * publiée — y compris l'immutabilité d'une version déjà publiée, REFUSÉE EN
 * BASE (`UPDATE`/`DELETE` retirés au rôle applicatif, I8).
 */

afterAll(fermerClients);

function session(
  utilisateurId: string,
  societeId: string,
  role: Role,
): ContexteSession {
  return {
    utilisateurId,
    societeId,
    role,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };
}

const INTERNE_A = session(UTILISATEUR_INTERNE_A, SOCIETE_A, Role.adv);

/** Pose, hors chemin applicatif, un modèle + une version publiée + un point. */
async function poserModeleVersionPoint(
  societeId: string,
  code: string,
): Promise<{ modeleId: string; versionId: string; pointId: string }> {
  const modeleId = uuidv7();
  const versionId = uuidv7();
  const pointId = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "checklist_modele" ("id", "societe_id", "code", "libelle", "modifie_le")
     VALUES ('${modeleId}', '${societeId}', '${code}', 'Modèle de test', now())`,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "checklist_version" ("id", "societe_id", "checklist_modele_id", "numero")
     VALUES ('${versionId}', '${societeId}', '${modeleId}', 1)`,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "checklist_point"
       ("id", "societe_id", "checklist_version_id", "section", "ordre", "libelle", "obligatoire", "type_reponse")
     VALUES ('${pointId}', '${societeId}', '${versionId}', 'Sécurité', 1, 'Point de test', true, 'conforme_non_conforme_sans_objet')`,
  );
  return { modeleId, versionId, pointId };
}

/**
 * Efface le modèle — RESTRICT protège le modèle tant qu'une version existe,
 * et le point tant qu'une réponse le désigne (D235) : on efface donc dans
 * l'ordre inverse de la filiation — réponses, puis version (qui CASCADE ses
 * points), puis le modèle.
 */
async function supprimerModele(modeleId: string): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "checklist_reponse" WHERE "checklist_point_id" IN (
       SELECT "p"."id" FROM "checklist_point" "p"
       JOIN "checklist_version" "v" ON "v"."id" = "p"."checklist_version_id"
       WHERE "v"."checklist_modele_id" = '${modeleId}'
     )`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "checklist_version" WHERE "checklist_modele_id" = '${modeleId}'`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "checklist_modele" WHERE "id" = '${modeleId}'`,
  );
}

/** Pose une réponse, RECOPIANT le point — hors chemin applicatif (CK2 l'écrira). */
async function poserReponse(
  interventionId: string,
  pointId: string,
  auteurId: string,
): Promise<string> {
  const id = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "checklist_reponse"
       ("id", "societe_id", "intervention_id", "checklist_point_id",
        "libelle", "section", "unite", "obligatoire", "valeur_conforme", "auteur_id")
     SELECT '${id}', "i"."societe_id", '${interventionId}', "p"."id",
            "p"."libelle", "p"."section", "p"."unite", "p"."obligatoire", 'conforme', '${auteurId}'
       FROM "intervention" "i", "checklist_point" "p"
      WHERE "i"."id" = '${interventionId}' AND "p"."id" = '${pointId}'`,
  );
  return id;
}

/** Une intervention jetable du client A2 (site A2-S1), pour les épreuves inter-clients. */
async function surUneInterventionDeClientA2(
  travail: (id: string) => Promise<void>,
): Promise<void> {
  const id = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention"
       ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "duree_estimee_min", "modifie_le")
     VALUES ('${id}', '${SOCIETE_A}', '${CLIENT_A2}', '${SITE_A2_S1}', '${AGENCE_A}', 'curatif', 'planifiee', 60, now())`,
  );
  try {
    await travail(id);
  } finally {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = '${id}'`,
    );
  }
}

describe("la forme « interne » (D94, D235) : checklist_modele, checklist_version, checklist_point", () => {
  it("TÉMOIN — RLS est en vigueur et elle MORD sur les trois tables", async () => {
    const { modeleId } = await poserModeleVersionPoint(SOCIETE_A, "TEMOIN");
    try {
      for (const table of [
        "checklist_modele",
        "checklist_version",
        "checklist_point",
      ]) {
        const [drapeaux] = await clientOwner().$queryRawUnsafe<
          Array<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>
        >(
          `SELECT "relrowsecurity", "relforcerowsecurity" FROM pg_class WHERE relname = '${table}'`,
        );
        expect(drapeaux, table).toEqual({
          relrowsecurity: true,
          relforcerowsecurity: true,
        });
      }

      // Sans aucun contexte posé, le rôle applicatif ne lit rien — alors que
      // le propriétaire voit bien la ligne qui vient d'être posée.
      expect(await clientApp().checklistModele.findMany()).toEqual([]);
      expect(await clientApp().checklistVersion.findMany()).toEqual([]);
      expect(await clientApp().checklistPoint.findMany()).toEqual([]);
      expect(
        await clientOwner().checklistModele.findUnique({
          where: { id: modeleId },
        }),
      ).not.toBeNull();
    } finally {
      await supprimerModele(modeleId);
    }
  });

  it("un compte PORTAIL ne lit AUCUNE ligne, même de SA société", async () => {
    const { modeleId } = await poserModeleVersionPoint(SOCIETE_A, "PORTAIL-1");
    try {
      const [modeles, versions, points] = await avecPortail(
        { societeId: SOCIETE_A, clientId: CLIENT_A1 },
        async (tx) => [
          await tx.checklistModele.findMany(),
          await tx.checklistVersion.findMany(),
          await tx.checklistPoint.findMany(),
        ],
      );
      expect(modeles).toEqual([]);
      expect(versions).toEqual([]);
      expect(points).toEqual([]);
    } finally {
      await supprimerModele(modeleId);
    }
  });

  it("le bureau lit les modèles de SA société, jamais ceux d'une autre", async () => {
    const { modeleId: idA } = await poserModeleVersionPoint(
      SOCIETE_A,
      "BUREAU-A",
    );
    const { modeleId: idB } = await poserModeleVersionPoint(
      SOCIETE_B,
      "BUREAU-B",
    );
    try {
      const vusParA = await clientApp().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT set_config('app.societe_id', '${SOCIETE_A}', true)`,
        );
        return tx.checklistModele.findMany({ select: { id: true } });
      });
      const ids = vusParA.map((m) => m.id);
      expect(ids).toContain(idA);
      expect(ids).not.toContain(idB);
    } finally {
      await supprimerModele(idA);
      await supprimerModele(idB);
    }
  });

  it("PREUVE — les clauses CHAÎNENT, aucune ne recopie une clause de société propre à l'étage fille", async () => {
    const [modele] = await clientOwner().$queryRawUnsafe<
      Array<{ qual: string }>
    >(`SELECT "qual" FROM pg_policies WHERE tablename = 'checklist_modele'`);
    expect(modele?.qual).toContain("app.societe_id");
    expect(modele?.qual).toContain("app.client_id");

    const [version] = await clientOwner().$queryRawUnsafe<
      Array<{ qual: string }>
    >(`SELECT "qual" FROM pg_policies WHERE tablename = 'checklist_version'`);
    expect(version?.qual).toContain("checklist_modele");
    expect(version?.qual).not.toContain("client_id");
    expect(version?.qual).not.toContain("societe_id");

    const [point] = await clientOwner().$queryRawUnsafe<
      Array<{ qual: string }>
    >(`SELECT "qual" FROM pg_policies WHERE tablename = 'checklist_point'`);
    expect(point?.qual).toContain("checklist_version");
    expect(point?.qual).not.toContain("client_id");
    expect(point?.qual).not.toContain("societe_id");
  });

  it("IMMUABLE — une version publiée ne se modifie pas, refusé EN BASE", async () => {
    const { modeleId, versionId } = await poserModeleVersionPoint(
      SOCIETE_A,
      "IMMUABLE-1",
    );
    try {
      await expect(
        clientApp().$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `SELECT set_config('app.societe_id', '${SOCIETE_A}', true)`,
          );
          await tx.$executeRawUnsafe(
            `UPDATE "checklist_version" SET "numero" = 99 WHERE "id" = '${versionId}'`,
          );
        }),
      ).rejects.toThrow();

      // La ligne n'a PAS changé : le refus est EN BASE, pas une discipline
      // d'écran qui aurait pu être contournée par un appel direct.
      const version = await clientOwner().checklistVersion.findUnique({
        where: { id: versionId },
      });
      expect(version?.numero).toBe(1);
    } finally {
      await supprimerModele(modeleId);
    }
  });

  it("IMMUABLE — un point ne se modifie ni ne s'efface, refusé EN BASE", async () => {
    const { modeleId, pointId } = await poserModeleVersionPoint(
      SOCIETE_A,
      "IMMUABLE-2",
    );
    try {
      await expect(
        clientApp().$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `SELECT set_config('app.societe_id', '${SOCIETE_A}', true)`,
          );
          await tx.$executeRawUnsafe(
            `DELETE FROM "checklist_point" WHERE "id" = '${pointId}'`,
          );
        }),
      ).rejects.toThrow();
    } finally {
      await supprimerModele(modeleId);
    }
  });
});

describe("la forme « filiation » (D103, D235) : checklist_reponse sur intervention", () => {
  it("un compte PORTAIL lit les réponses de SON intervention, jamais celles d'un autre client ni d'une autre société", async () => {
    const { modeleId: modeleA, pointId: pointA } =
      await poserModeleVersionPoint(SOCIETE_A, "REPONSE-A");
    const { modeleId: modeleB, pointId: pointB } =
      await poserModeleVersionPoint(SOCIETE_B, "REPONSE-B");
    await surUneInterventionDeClientA2(async (interventionA2) => {
      const idA1 = await poserReponse(
        INTERVENTION_A1,
        pointA,
        UTILISATEUR_INTERNE_A,
      );
      const idA2 = await poserReponse(
        interventionA2,
        pointA,
        UTILISATEUR_INTERNE_A,
      );
      const idB1 = await poserReponse(
        INTERVENTION_B1,
        pointB,
        UTILISATEUR_INTERNE_B,
      );
      try {
        const vues = await avecPortail(
          { societeId: SOCIETE_A, clientId: CLIENT_A1 },
          (tx) => tx.checklistReponse.findMany({ select: { id: true } }),
        );
        const ids = vues.map((v) => v.id);
        expect(ids).toContain(idA1);
        // Même société, AUTRE client (CLIENT_A2) : invisible.
        expect(ids).not.toContain(idA2);
        // Autre société : invisible.
        expect(ids).not.toContain(idB1);
      } finally {
        await clientOwner().$executeRawUnsafe(
          `DELETE FROM "checklist_reponse" WHERE "id" IN ('${idA1}', '${idA2}', '${idB1}')`,
        );
      }
    });
    await supprimerModele(modeleA);
    await supprimerModele(modeleB);
  });

  it("RECOPIE — la réponse porte son propre libellé, section, obligatoire : jamais relus depuis le point", async () => {
    const { modeleId, pointId } = await poserModeleVersionPoint(
      SOCIETE_A,
      "RECOPIE-1",
    );
    try {
      const id = await poserReponse(
        INTERVENTION_A1,
        pointId,
        UTILISATEUR_INTERNE_A,
      );
      const reponse = await clientOwner().checklistReponse.findUnique({
        where: { id },
      });
      expect(reponse?.libelle).toBe("Point de test");
      expect(reponse?.section).toBe("Sécurité");
      expect(reponse?.obligatoire).toBe(true);

      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "checklist_reponse" WHERE "id" = '${id}'`,
      );
    } finally {
      await supprimerModele(modeleId);
    }
  });

  it("PREUVE — la politique de checklist_reponse s'adosse à `intervention`, jamais à une colonne client/site propre", async () => {
    const [politique] = await clientOwner().$queryRawUnsafe<
      Array<{ qual: string; with_check: string }>
    >(
      `SELECT "qual", "with_check" FROM pg_policies WHERE tablename = 'checklist_reponse'`,
    );
    expect(politique?.qual).toContain("intervention");
    expect(politique?.qual).not.toContain("client_id");
    expect(politique?.qual).not.toContain("perimetre_sites");
    expect(politique?.with_check).not.toContain("client_id");
  });
});

describe("lib/checklists/depot.ts — créer un modèle, publier une version, lire la dernière publiée", () => {
  it("creerModele puis publierVersion puis dernierVersionPubliee — un aller-retour complet", async () => {
    const modeleId = await creerModele(
      INTERNE_A,
      { code: "DEPOT-1", libelle: "Gabarit déposé" },
      clientApp(),
    );
    try {
      await publierVersion(
        INTERNE_A,
        modeleId,
        [
          {
            typeReponse: "conforme_non_conforme_sans_objet",
            section: "Sécurité",
            ordre: 1,
            libelle: "Premier point",
            obligatoire: true,
          },
          {
            typeReponse: "valeur_mesuree",
            section: "Levage",
            ordre: 2,
            libelle: "Usure",
            unite: "mm",
          },
        ],
        clientApp(),
      );

      const version = await dernierVersionPubliee(
        INTERNE_A,
        modeleId,
        clientApp(),
      );
      expect(version?.numero).toBe(1);
      expect(version?.points).toHaveLength(2);
      expect(version?.points[0]?.libelle).toBe("Premier point");
      expect(version?.points[0]?.obligatoire).toBe(true);
      expect(version?.points[1]?.unite).toBe("mm");

      // Publier une SECONDE version incrémente le numéro — jamais une
      // réécriture de la première (D235).
      await publierVersion(
        INTERNE_A,
        modeleId,
        [
          {
            typeReponse: "case_faite",
            section: "Levage",
            ordre: 1,
            libelle: "Graissage",
          },
        ],
        clientApp(),
      );
      const derniere = await dernierVersionPubliee(
        INTERNE_A,
        modeleId,
        clientApp(),
      );
      expect(derniere?.numero).toBe(2);
      expect(derniere?.points).toHaveLength(1);

      // La PREMIÈRE version existe toujours, intacte.
      const premiere = await clientOwner().checklistVersion.findFirst({
        where: { checklist_modele_id: modeleId, numero: 1 },
        include: { points: true },
      });
      expect(premiere?.points).toHaveLength(2);
    } finally {
      await supprimerModele(modeleId);
    }
  });

  it("un modèle créé par A reste invisible à B — et jamais lu par un compte portail", async () => {
    const modeleId = await creerModele(
      INTERNE_A,
      { code: "DEPOT-2", libelle: "Gabarit A seul" },
      clientApp(),
    );
    try {
      const vuParB = await clientApp().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT set_config('app.societe_id', '${SOCIETE_B}', true)`,
        );
        return tx.checklistModele.findMany({ where: { id: modeleId } });
      });
      expect(vuParB).toEqual([]);

      const vuParPortail = await avecPortail(
        { societeId: SOCIETE_A, clientId: CLIENT_A1 },
        (tx) => tx.checklistModele.findMany({ where: { id: modeleId } }),
      );
      expect(vuParPortail).toEqual([]);
    } finally {
      await supprimerModele(modeleId);
    }
  });
});

import { afterAll, describe, expect, it } from "vitest";

import { type ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import {
  cloturer,
  enregistrerAccord,
  marquerDevisEnvoye,
  marquerPieceRecue,
  qualifierSuite,
} from "@/lib/suite-a-donner/depot";

import { avecPortail, clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_A2,
  INTERVENTION_A1,
  INTERVENTION_A2,
  INTERVENTION_B1,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * LA SUITE À DONNER (9J17-SUITE-A-DONNER-SCHEMA, D231).
 *
 * ## Ce que ce fichier mesure
 *
 * La forme **« filiation » (D103, septième entrée)** : une fille est visible
 * si son intervention D'ORIGINE l'est — les trois filtres de la forme
 * « parc » d'`intervention` s'y propagent sans qu'aucun soit réécrit, et
 * c'est précisément ce qu'il faut prouver en LISANT la clause (même
 * discipline que `tests/isolation/intervention-machines.test.ts`, D103).
 *
 * Et le chemin de production (`lib/suite-a-donner/depot.ts`), traversé par
 * les quatre fonctions du ticket, dont les CHECK en base (D231) : une
 * clôture `sans_suite` sans motif, une attente de pièce sans son horizon, ou
 * posée hors `accord_recu`.
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

const INTERNE_ADV = session(UTILISATEUR_INTERNE_A, SOCIETE_A, Role.adv);

/** Une intervention jetable du client A1 sur le site du périmètre. */
async function surUneInterventionJetable(
  travail: (id: string) => Promise<void>,
): Promise<void> {
  const id = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "type", "statut", "duree_estimee_min", "modifie_le")
     SELECT '${id}', "societe_id", "client_id", "site_id", "agence_id",
            "type", 'planifiee', 60, now()
       FROM "intervention" WHERE "id" = '${INTERVENTION_A1}'`,
  );
  try {
    await travail(id);
  } finally {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = '${id}'`,
    );
  }
}

/** Pose directement une ligne `suite_a_donner`, hors chemin applicatif. */
async function poserLigne(
  interventionOrigineId: string,
  statut = "a_qualifier",
): Promise<string> {
  const id = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "suite_a_donner"
       ("id", "societe_id", "intervention_origine_id", "statut", "modifie_le")
     SELECT '${id}', "societe_id", '${interventionOrigineId}',
            '${statut}'::"StatutSuiteADonner", now()
       FROM "intervention" WHERE "id" = '${interventionOrigineId}'`,
  );
  return id;
}

describe("la forme « filiation » : la fille suit son intervention d'origine (D103, D231)", () => {
  it("TÉMOIN — la politique est en vigueur et elle MORD", async () => {
    const idA1 = await poserLigne(INTERVENTION_A1);
    try {
      const [drapeaux] = await clientOwner().$queryRawUnsafe<
        Array<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>
      >(
        `SELECT "relrowsecurity", "relforcerowsecurity" FROM pg_class WHERE relname = 'suite_a_donner'`,
      );
      expect(drapeaux).toEqual({
        relrowsecurity: true,
        relforcerowsecurity: true,
      });

      expect(
        await clientApp().suiteADonner.findMany({ select: { id: true } }),
      ).toEqual([]);
      const [total] = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
        `SELECT count(*) AS n FROM "suite_a_donner"`,
      );
      expect(Number(total?.n ?? 0)).toBeGreaterThanOrEqual(1);
    } finally {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "suite_a_donner" WHERE "id" = '${idA1}'`,
      );
    }
  });

  it("un utilisateur interne voit les lignes de SA société, jamais d'une autre", async () => {
    const idA1 = await poserLigne(INTERVENTION_A1);
    const idB1 = await poserLigne(INTERVENTION_B1);
    try {
      const vues = await clientApp().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT set_config('app.societe_id', '${SOCIETE_A}', true)`,
        );
        return tx.suiteADonner.findMany({
          select: { intervention_origine_id: true },
        });
      });
      const ids = vues.map((l) => l.intervention_origine_id);
      expect(ids).toContain(INTERVENTION_A1);
      expect(ids).not.toContain(INTERVENTION_B1);
    } finally {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "suite_a_donner" WHERE "id" IN ('${idA1}', '${idB1}')`,
      );
    }
  });

  it("le filtre de PÉRIMÈTRE se propage — sans être écrit dans la politique fille", async () => {
    const idA1 = await poserLigne(INTERVENTION_A1);
    const idA2 = await poserLigne(INTERVENTION_A2);
    try {
      const vues = await avecPortail(
        {
          societeId: SOCIETE_A,
          clientId: CLIENT_A1,
          perimetreSites: [SITE_A1_S1],
        },
        (tx) =>
          tx.suiteADonner.findMany({
            select: { intervention_origine_id: true },
          }),
      );
      const ids = vues.map((l) => l.intervention_origine_id);
      expect(ids).toContain(INTERVENTION_A1);
      expect(ids).not.toContain(INTERVENTION_A2);
    } finally {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "suite_a_donner" WHERE "id" IN ('${idA1}', '${idA2}')`,
      );
    }
  });

  it("PREUVE que la politique fille ne recopie RIEN : elle ne nomme aucune variable de parc", async () => {
    const [politique] = await clientOwner().$queryRawUnsafe<
      Array<{ qual: string; with_check: string }>
    >(
      `SELECT "qual", "with_check" FROM pg_policies WHERE tablename = 'suite_a_donner'`,
    );
    expect(politique?.qual).toContain("intervention");
    expect(politique?.qual).not.toContain("client_id");
    expect(politique?.qual).not.toContain("perimetre_sites");
    expect(politique?.with_check).not.toContain("client_id");
    expect(politique?.with_check).not.toContain("perimetre_sites");
  });

  it("un compte d'un AUTRE client ne voit rien de ces lignes", async () => {
    const idA1 = await poserLigne(INTERVENTION_A1);
    try {
      const vues = await avecPortail(
        { societeId: SOCIETE_A, clientId: CLIENT_A2 },
        (tx) =>
          tx.suiteADonner.findMany({
            select: { intervention_origine_id: true },
          }),
      );
      expect(vues.map((l) => l.intervention_origine_id)).not.toContain(
        INTERVENTION_A1,
      );
    } finally {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "suite_a_donner" WHERE "id" = '${idA1}'`,
      );
    }
  });
});

describe("qualifierSuite — crée et qualifie dans le même geste", () => {
  it("pose une ligne `qualifiee`, avec l'auteur et la date", async () => {
    await surUneInterventionJetable(async (interventionId) => {
      const id = await qualifierSuite(INTERNE_ADV, interventionId, clientApp());

      const ligne = await clientOwner().suiteADonner.findUnique({
        where: { id },
      });
      expect(ligne?.statut).toBe("qualifiee");
      expect(ligne?.qualifiee_par).toBe(UTILISATEUR_INTERNE_A);
      expect(ligne?.qualifiee_le).not.toBeNull();

      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "suite_a_donner" WHERE "id" = '${id}'`,
      );
    });
  });
});

describe("marquerDevisEnvoye — qualifiee → accord_attendu (9K05)", () => {
  it("fait avancer une ligne `qualifiee`", async () => {
    await surUneInterventionJetable(async (interventionId) => {
      const id = await qualifierSuite(INTERNE_ADV, interventionId, clientApp());
      const resultat = await marquerDevisEnvoye(INTERNE_ADV, id, clientApp());
      expect(resultat.accepte).toBe(true);

      const ligne = await clientOwner().suiteADonner.findUnique({
        where: { id },
      });
      expect(ligne?.statut).toBe("accord_attendu");

      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "suite_a_donner" WHERE "id" = '${id}'`,
      );
    });
  });

  it("ÉPREUVE : refuse un statut de départ autre que `qualifiee`", async () => {
    await surUneInterventionJetable(async (interventionId) => {
      const id = await poserLigne(interventionId, "accord_attendu");
      const resultat = await marquerDevisEnvoye(INTERNE_ADV, id, clientApp());
      expect(resultat).toEqual({
        accepte: false,
        cle: "suites_a_donner.refus.pas_qualifiee",
      });

      const ligne = await clientOwner().suiteADonner.findUnique({
        where: { id },
      });
      expect(ligne?.statut).toBe("accord_attendu");

      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "suite_a_donner" WHERE "id" = '${id}'`,
      );
    });
  });
});

describe("enregistrerAccord — accord_recu, a_replanifier (accord sans pièce) ou sans_suite", () => {
  it("accord_recu avec attente de pièce pose les deux colonnes de l'horizon", async () => {
    await surUneInterventionJetable(async (interventionId) => {
      const id = await qualifierSuite(INTERNE_ADV, interventionId, clientApp());
      await marquerDevisEnvoye(INTERNE_ADV, id, clientApp());
      const resultat = await enregistrerAccord(
        INTERNE_ADV,
        id,
        {
          reponse: "accord_recu",
          pieceAttendueRef: "COURROIE-42",
          dateDispoPrevue: new Date("2026-12-01"),
        },
        clientApp(),
      );
      expect(resultat.accepte).toBe(true);

      const ligne = await clientOwner().suiteADonner.findUnique({
        where: { id },
      });
      expect(ligne?.statut).toBe("accord_recu");
      expect(ligne?.piece_attendue_ref).toBe("COURROIE-42");
      expect(ligne?.date_dispo_prevue).not.toBeNull();

      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "suite_a_donner" WHERE "id" = '${id}'`,
      );
    });
  });

  it("DÉCISION D'ALEXIS (08/11/2026) : accord_recu SANS pièce attendue saute directement à a_replanifier", async () => {
    await surUneInterventionJetable(async (interventionId) => {
      const id = await qualifierSuite(INTERNE_ADV, interventionId, clientApp());
      await marquerDevisEnvoye(INTERNE_ADV, id, clientApp());
      const resultat = await enregistrerAccord(
        INTERNE_ADV,
        id,
        { reponse: "accord_recu" },
        clientApp(),
      );
      expect(resultat.accepte).toBe(true);

      const ligne = await clientOwner().suiteADonner.findUnique({
        where: { id },
      });
      expect(ligne?.statut).toBe("a_replanifier");
      expect(ligne?.piece_attendue_ref).toBeNull();
      expect(ligne?.date_dispo_prevue).toBeNull();

      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "suite_a_donner" WHERE "id" = '${id}'`,
      );
    });
  });

  it("sans_suite exige et pose le motif, en texte libre", async () => {
    await surUneInterventionJetable(async (interventionId) => {
      const id = await qualifierSuite(INTERNE_ADV, interventionId, clientApp());
      await marquerDevisEnvoye(INTERNE_ADV, id, clientApp());
      await enregistrerAccord(
        INTERNE_ADV,
        id,
        { reponse: "sans_suite", motifSansSuite: "client injoignable" },
        clientApp(),
      );

      const ligne = await clientOwner().suiteADonner.findUnique({
        where: { id },
      });
      expect(ligne?.statut).toBe("sans_suite");
      expect(ligne?.motif_sans_suite).toBe("client injoignable");

      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "suite_a_donner" WHERE "id" = '${id}'`,
      );
    });
  });

  it("ÉPREUVE : refuse un statut de départ autre que `accord_attendu`", async () => {
    await surUneInterventionJetable(async (interventionId) => {
      const id = await qualifierSuite(INTERNE_ADV, interventionId, clientApp());
      const resultat = await enregistrerAccord(
        INTERNE_ADV,
        id,
        { reponse: "sans_suite", motifSansSuite: "client injoignable" },
        clientApp(),
      );
      expect(resultat).toEqual({
        accepte: false,
        cle: "suites_a_donner.refus.pas_accord_attendu",
      });

      const ligne = await clientOwner().suiteADonner.findUnique({
        where: { id },
      });
      expect(ligne?.statut).toBe("qualifiee");

      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "suite_a_donner" WHERE "id" = '${id}'`,
      );
    });
  });
});

describe("marquerPieceRecue — nulle l'attente, passe à a_replanifier", () => {
  it("nulle les deux colonnes de l'horizon dans la même transaction", async () => {
    await surUneInterventionJetable(async (interventionId) => {
      const id = await qualifierSuite(INTERNE_ADV, interventionId, clientApp());
      await marquerDevisEnvoye(INTERNE_ADV, id, clientApp());
      await enregistrerAccord(
        INTERNE_ADV,
        id,
        {
          reponse: "accord_recu",
          pieceAttendueRef: "COURROIE-42",
          dateDispoPrevue: new Date("2026-12-01"),
        },
        clientApp(),
      );

      const resultat = await marquerPieceRecue(INTERNE_ADV, id, clientApp());
      expect(resultat.accepte).toBe(true);

      const ligne = await clientOwner().suiteADonner.findUnique({
        where: { id },
      });
      expect(ligne?.statut).toBe("a_replanifier");
      expect(ligne?.piece_attendue_ref).toBeNull();
      expect(ligne?.date_dispo_prevue).toBeNull();

      // LA NOTIFICATION S'EFFACE AVANT LA SUITE (9J19-SUITE-A-DONNER-
      // NOTIFICATIONS) : `marquerPieceRecue` pose désormais une notification
      // « piece_recue » référençant cette ligne (clé étrangère RESTRICT).
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "notification" WHERE "suite_a_donner_id" = '${id}'`,
      );
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "suite_a_donner" WHERE "id" = '${id}'`,
      );
    });
  });

  it("ÉPREUVE : refuse un statut de départ autre que `accord_recu`", async () => {
    await surUneInterventionJetable(async (interventionId) => {
      const id = await qualifierSuite(INTERNE_ADV, interventionId, clientApp());
      const resultat = await marquerPieceRecue(INTERNE_ADV, id, clientApp());
      expect(resultat).toEqual({
        accepte: false,
        cle: "suites_a_donner.refus.pas_accord_recu",
      });

      const ligne = await clientOwner().suiteADonner.findUnique({
        where: { id },
      });
      expect(ligne?.statut).toBe("qualifiee");

      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "suite_a_donner" WHERE "id" = '${id}'`,
      );
    });
  });
});

describe("cloturer", () => {
  it("passe le statut à `cloturee`", async () => {
    await surUneInterventionJetable(async (interventionId) => {
      const id = await qualifierSuite(INTERNE_ADV, interventionId, clientApp());
      await marquerDevisEnvoye(INTERNE_ADV, id, clientApp());
      await enregistrerAccord(
        INTERNE_ADV,
        id,
        { reponse: "sans_suite", motifSansSuite: "doublon" },
        clientApp(),
      );
      await cloturer(INTERNE_ADV, id, clientApp());

      const ligne = await clientOwner().suiteADonner.findUnique({
        where: { id },
      });
      expect(ligne?.statut).toBe("cloturee");

      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "suite_a_donner" WHERE "id" = '${id}'`,
      );
    });
  });
});

describe("les ÉQUIVALENCES posées en base (D231) — pas seulement dans le dépôt", () => {
  it("ÉPREUVE : `sans_suite` sans motif est refusé", async () => {
    await surUneInterventionJetable(async (interventionId) => {
      await expect(
        clientOwner().$executeRawUnsafe(
          `INSERT INTO "suite_a_donner"
             ("id", "societe_id", "intervention_origine_id", "statut", "modifie_le")
           SELECT '${uuidv7()}', "societe_id", '${interventionId}',
                  'sans_suite'::"StatutSuiteADonner", now()
             FROM "intervention" WHERE "id" = '${interventionId}'`,
        ),
      ).rejects.toThrow();
    });
  });

  it("ÉPREUVE : une référence de pièce SANS date de disponibilité est refusée", async () => {
    await surUneInterventionJetable(async (interventionId) => {
      await expect(
        clientOwner().$executeRawUnsafe(
          `INSERT INTO "suite_a_donner"
             ("id", "societe_id", "intervention_origine_id", "statut",
              "piece_attendue_ref", "modifie_le")
           SELECT '${uuidv7()}', "societe_id", '${interventionId}',
                  'accord_recu'::"StatutSuiteADonner", 'COURROIE-42', now()
             FROM "intervention" WHERE "id" = '${interventionId}'`,
        ),
      ).rejects.toThrow();
    });
  });

  it("ÉPREUVE : une attente de pièce posée HORS `accord_recu` est refusée", async () => {
    await surUneInterventionJetable(async (interventionId) => {
      await expect(
        clientOwner().$executeRawUnsafe(
          `INSERT INTO "suite_a_donner"
             ("id", "societe_id", "intervention_origine_id", "statut",
              "piece_attendue_ref", "date_dispo_prevue", "modifie_le")
           SELECT '${uuidv7()}', "societe_id", '${interventionId}',
                  'a_replanifier'::"StatutSuiteADonner", 'COURROIE-42',
                  '2026-12-01', now()
             FROM "intervention" WHERE "id" = '${interventionId}'`,
        ),
      ).rejects.toThrow();
    });
  });
});

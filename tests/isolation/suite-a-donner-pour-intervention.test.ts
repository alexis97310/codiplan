import { afterAll, describe, expect, it } from "vitest";

import { type ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { qualifierSuite } from "@/lib/suite-a-donner/depot";
import { suiteADonnerPourIntervention } from "@/lib/suite-a-donner/lecture";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  INTERVENTION_A1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_INTERNE_B,
} from "./setup/fixtures";

/**
 * `suiteADonnerPourIntervention` (9K09-FICHE-CLOTURE-SUITE-ORIGINE, I5 de
 * l'étude du 08/11/2026) — ce que la fiche d'une intervention lit dans les
 * DEUX sens : `commeOrigine` (un dossier est né de cette intervention),
 * `commeReprise` (cette intervention EST la reprise d'un dossier).
 *
 * Le cloisonnement n'est pas écrit dans cette fonction (comme
 * `suitesADonnerDuRegistre` ci-dessus, I1) : c'est la politique RLS déjà
 * éprouvée par `tests/isolation/suite-a-donner.test.ts` qui le tient. Ce
 * fichier mesure seulement que la LECTURE PAR INTERVENTION traverse bien ce
 * même contexte applicatif — jamais une seconde comparaison de société.
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

const INTERNE_ADV_A = session(UTILISATEUR_INTERNE_A, SOCIETE_A, Role.adv);
const INTERNE_ADV_B = session(UTILISATEUR_INTERNE_B, SOCIETE_B, Role.adv);

/** Une intervention jetable du client A1, clonée de `INTERVENTION_A1`. */
async function interventionJetable(statut = "cloturee"): Promise<string> {
  const id = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "type", "statut", "duree_estimee_min", "modifie_le")
     SELECT '${id}', "societe_id", "client_id", "site_id", "agence_id",
            "type", '${statut}', 60, now()
       FROM "intervention" WHERE "id" = '${INTERVENTION_A1}'`,
  );
  return id;
}

async function effacerIntervention(id: string): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "id" = '${id}'`,
  );
}

async function effacerSuite(id: string): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "suite_a_donner" WHERE "id" = '${id}'`,
  );
}

describe("suiteADonnerPourIntervention — commeOrigine", () => {
  it("retrouve le dossier né de CETTE intervention, avec son statut", async () => {
    const origineId = await interventionJetable();
    try {
      const suiteId = await qualifierSuite(
        INTERNE_ADV_A,
        origineId,
        clientApp(),
      );
      try {
        const lecture = await suiteADonnerPourIntervention(
          INTERNE_ADV_A,
          origineId,
          clientApp(),
        );
        expect(lecture.commeOrigine).toEqual({
          id: suiteId,
          statut: "qualifiee",
        });
        expect(lecture.commeReprise).toBeNull();
      } finally {
        await effacerSuite(suiteId);
      }
    } finally {
      await effacerIntervention(origineId);
    }
  });

  it("rend `null` quand aucun dossier n'est né de cette intervention", async () => {
    const id = await interventionJetable();
    try {
      const lecture = await suiteADonnerPourIntervention(
        INTERNE_ADV_A,
        id,
        clientApp(),
      );
      expect(lecture.commeOrigine).toBeNull();
      expect(lecture.commeReprise).toBeNull();
    } finally {
      await effacerIntervention(id);
    }
  });

  it("une AUTRE société ne voit pas le dossier (cloisonnement)", async () => {
    const origineId = await interventionJetable();
    try {
      const suiteId = await qualifierSuite(
        INTERNE_ADV_A,
        origineId,
        clientApp(),
      );
      try {
        const lecture = await suiteADonnerPourIntervention(
          INTERNE_ADV_B,
          origineId,
          clientApp(),
        );
        expect(lecture.commeOrigine).toBeNull();
      } finally {
        await effacerSuite(suiteId);
      }
    } finally {
      await effacerIntervention(origineId);
    }
  });
});

describe("suiteADonnerPourIntervention — commeReprise", () => {
  it("retrouve l'intervention d'ORIGINE quand cette intervention en est la reprise", async () => {
    const origineId = await interventionJetable();
    const repriseId = await interventionJetable("planifiee");
    try {
      const suiteId = await qualifierSuite(
        INTERNE_ADV_A,
        origineId,
        clientApp(),
      );
      try {
        await clientOwner().suiteADonner.update({
          where: { id: suiteId },
          data: { intervention_reprise_id: repriseId },
        });

        const lecture = await suiteADonnerPourIntervention(
          INTERNE_ADV_A,
          repriseId,
          clientApp(),
        );
        expect(lecture.commeReprise?.id).toBe(origineId);
        expect(lecture.commeOrigine).toBeNull();
      } finally {
        await effacerSuite(suiteId);
      }
    } finally {
      await effacerIntervention(repriseId);
      await effacerIntervention(origineId);
    }
  });
});

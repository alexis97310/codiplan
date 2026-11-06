import { afterAll, describe, expect, it } from "vitest";

import { bonInterventionDuParc } from "@/app/(portail)/portail/interventions/depot";
import { type ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_A2,
  INTERVENTION_A1,
  INTERVENTION_B1,
  PORTAIL_A2_CLIENT,
  PORTAIL_A_CLIENT,
  SOCIETE_A,
} from "./setup/fixtures";

/**
 * LE BON DU PORTAIL — CE QU'IL OUVRE ET CE QU'IL REFUSE
 * (9J08A-REPRISE-9J08, CLI-2.6).
 *
 * Même décor que `9j07-portail-intervention-etat.test.ts` : la forme « parc »
 * (D84) seule, jamais `restrictionParPersonne`. La condition de CLÔTURE est
 * nouvelle (point 2 du ticket 9J08) — c'est elle que les deux premiers
 * scénarios distinguent, sur une intervention JETABLE (voir
 * `intervention-machines.test.ts`) plutôt que sur un fixture partagé, pour ne
 * jamais muter un état que d'autres fichiers lisent en parallèle.
 */

afterAll(fermerClients);

function contextePortailA1(): ContexteSession {
  return {
    utilisateurId: PORTAIL_A_CLIENT,
    societeId: SOCIETE_A,
    role: Role.client,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: CLIENT_A1,
  };
}

/**
 * Une intervention JETABLE du client A1, sur le site du périmètre — même
 * geste que `surUneInterventionJetable` (`intervention-machines.test.ts`),
 * jamais recopié : chaque fichier compose la sienne plutôt que d'en partager
 * une à travers un module de test (aucun n'en exporte).
 */
async function surUneInterventionJetable(
  cloturee: boolean,
  travail: (id: string) => Promise<void>,
): Promise<void> {
  const id = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "type", "statut", "duree_estimee_min", "modifie_le",
       "cloturee_le")
     SELECT '${id}', "societe_id", "client_id", "site_id", "agence_id",
            'curatif'::"TypeIntervention",
            '${cloturee ? "cloturee" : "terminee"}',
            60, now(), ${cloturee ? "now()" : "NULL"}
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

describe("bonInterventionDuParc — ce qu'il ouvre", () => {
  it("un compte portail lit le bon d'une intervention CLÔTURÉE de son client", async () => {
    await surUneInterventionJetable(true, async (id) => {
      const resultat = await bonInterventionDuParc(
        contextePortailA1(),
        id,
        clientApp(),
      );
      expect(resultat.etat).toBe("disponible");
      if (resultat.etat === "disponible") {
        expect(resultat.bon.ligne.id).toBe(id);
        expect(resultat.bon.clotureeLe).not.toBeNull();
        // AUCUN MONTANT N'EST EXIGÉ ICI : voir `tests/unit/portail/
        // bon-sans-montant.test.ts`, qui tient la garantie à l'écran — la
        // composition, elle, continue de porter `taux`/`montantTotal` comme
        // pour le back-office (jamais une seconde écriture de la mise en
        // forme), c'est l'écran qui ne les lit pas.
      }
    });
  });
});

describe("bonInterventionDuParc — ce qu'il refuse, et pourquoi", () => {
  it("refus NOMMÉ avant la clôture — une intervention seulement TERMINEE", async () => {
    await surUneInterventionJetable(false, async (id) => {
      const resultat = await bonInterventionDuParc(
        contextePortailA1(),
        id,
        clientApp(),
      );
      expect(resultat).toEqual({ etat: "non_cloturee" });
    });
  });

  it("une intervention CLÔTURÉE d'un AUTRE client de la MÊME société : introuvable, jamais le motif de clôture", async () => {
    await surUneInterventionJetable(true, async (id) => {
      const resultat = await bonInterventionDuParc(
        {
          utilisateurId: PORTAIL_A2_CLIENT,
          societeId: SOCIETE_A,
          role: Role.client,
          secondFacteurValide: true,
          adresseIp: null,
          clientId: CLIENT_A2,
        },
        id,
        clientApp(),
      );
      expect(resultat).toEqual({ etat: "introuvable" });
    });
  });

  it("une intervention d'une AUTRE société : introuvable", async () => {
    const resultat = await bonInterventionDuParc(
      contextePortailA1(),
      INTERVENTION_B1,
      clientApp(),
    );
    expect(resultat).toEqual({ etat: "introuvable" });
    // TÉMOIN — la ligne EXISTE : sans lui, « introuvable » prouverait
    // seulement qu'aucune intervention ne porte cet identifiant.
    const [existe] = await clientOwner().$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "intervention" WHERE "id" = $1::uuid`,
      INTERVENTION_B1,
    );
    expect(existe?.n).toBe(1);
  });
});

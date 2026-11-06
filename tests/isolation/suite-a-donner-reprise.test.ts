import { afterAll, describe, expect, it } from "vitest";

import { type ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import {
  enregistrerAccord,
  marquerPieceRecue,
  qualifierSuite,
} from "@/lib/suite-a-donner/depot";
import {
  cloturerSuiteSiReprise,
  creerReprise,
} from "@/lib/suite-a-donner/reprise";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  INTERVENTION_A1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * `creerReprise` ET `cloturerSuiteSiReprise` (9J18-SUITE-A-DONNER-ECRAN,
 * FLX-6/7/11, point 6).
 *
 * ## Ce que ce fichier mesure
 *
 * Que `creerReprise` rend EXACTEMENT le verdict que `jugerPose`
 * (`lib/interventions/depot.ts`) rendrait pour une pose ordinaire — un
 * chevauchement RÉEL avec une autre intervention du même technicien, le même
 * jour, le prouve (RG-PLA-03) — et que le lien ne se pose JAMAIS sans que
 * l'intervention de reprise existe réellement, y compris quand `jugerPose`
 * refuse : aucune ligne orpheline, aucun lien posé sur une suite qui n'a pas
 * sa reprise.
 *
 * `AGENCE_A`/`DEBUT_MINUTES` (09:00) reprennent la même agence que
 * `verdict-pose-lecture.test.ts` ; `LUNDI` (23/11/2026) est un lundi futur
 * dédié à CE fichier — ni le `14/09/2026` de `verdict-pose-lecture.test.ts`
 * (tombé dans le passé au fil des exécutions de ce dépôt), ni le `07/12/2026`
 * (« Férié fictif de décembre ZZ », `tests/isolation/setup/global.ts`).
 */

afterAll(fermerClients);

const INTERNE_ADV: ContexteSession = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien];
const LUNDI = new Date("2026-11-23T00:00:00.000Z");
const DEBUT_MINUTES = 9 * 60;
const DUREE_MIN = 60;

/**
 * Une intervention jetable, clonée de `INTERVENTION_A1` — même agence/site/
 * type. `priorite` se pose DANS l'INSERT, jamais par une écriture
 * ultérieure : une ligne `cloturee` est TERMINALE (D160) et refuse toute
 * modification, y compris pour en changer la priorité.
 */
async function interventionJetable(priorite = "p3"): Promise<string> {
  const id = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "type", "statut", "priorite", "duree_estimee_min", "modifie_le")
     SELECT '${id}', "societe_id", "client_id", "site_id", "agence_id",
            "type", 'cloturee', '${priorite}'::"PrioriteIntervention", 60, now()
       FROM "intervention" WHERE "id" = '${INTERVENTION_A1}'`,
  );
  return id;
}

/**
 * L'OBSTACLE — une intervention déjà posée pour CE technicien, CE jour, DANS
 * l'INSERT (jamais `cloturee`, donc librement posable d'emblée).
 */
async function interventionOccupante(
  technicienId: string,
  debut: Date,
  fin: Date,
): Promise<string> {
  const id = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "type", "statut", "technicien_id", "date_planifiee",
       "creneau_debut", "creneau_fin", "duree_estimee_min", "modifie_le")
     SELECT '${id}', "societe_id", "client_id", "site_id", "agence_id",
            "type", 'planifiee', '${technicienId}', '${LUNDI.toISOString()}',
            '${debut.toISOString()}', '${fin.toISOString()}', 60, now()
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

/** Qualifie, accorde et marque la pièce reçue — une suite au statut `a_replanifier`. */
async function suiteAReplanifier(
  interventionOrigineId: string,
): Promise<string> {
  const id = await qualifierSuite(
    INTERNE_ADV,
    interventionOrigineId,
    clientApp(),
  );
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
  await marquerPieceRecue(INTERNE_ADV, id, clientApp());
  return id;
}

describe("creerReprise — les mêmes refus qu'une pose ordinaire", () => {
  it("crée l'intervention, hérite la priorité, et lie la suite dans la MÊME transaction", async () => {
    const origineId = await interventionJetable("p1");
    let repriseId: string | null = null;
    try {
      const suiteId = await suiteAReplanifier(origineId);
      try {
        const resultat = await creerReprise(
          INTERNE_ADV,
          suiteId,
          {
            technicien_id: TECHNICIEN,
            date_planifiee: LUNDI,
            debut_minutes: DEBUT_MINUTES,
            duree_min: DUREE_MIN,
            confirmer_hors_ouverture: false,
            confirmer_date_passee: false,
          },
          clientApp(),
        );
        expect(resultat.accepte).toBe(true);
        if (!resultat.accepte) return;
        repriseId = resultat.fiche.id;
        expect(resultat.fiche.type).toBe("curatif");
        expect(resultat.fiche.priorite).toBe("p1");
        expect(resultat.fiche.statut).toBe("planifiee");
        expect(resultat.fiche.technicien_id).toBe(TECHNICIEN);

        const suite = await clientOwner().suiteADonner.findUnique({
          where: { id: suiteId },
        });
        expect(suite?.intervention_reprise_id).toBe(resultat.fiche.id);
        expect(suite?.statut).toBe("a_replanifier");
      } finally {
        // LA SUITE S'EFFACE AVANT L'INTERVENTION — `intervention_reprise_id`
        // est une clé étrangère RESTRICT (voir le docblock de
        // `creerReprise`) : la supprimer dans l'autre ordre échoue.
        await effacerSuite(suiteId);
      }
    } finally {
      if (repriseId !== null) {
        await effacerIntervention(repriseId);
      }
      await effacerIntervention(origineId);
    }
  });

  it("refuse si la suite n'est pas `a_replanifier`", async () => {
    const origineId = await interventionJetable();
    try {
      const suiteId = await qualifierSuite(INTERNE_ADV, origineId, clientApp());
      try {
        const resultat = await creerReprise(
          INTERNE_ADV,
          suiteId,
          {
            technicien_id: TECHNICIEN,
            date_planifiee: LUNDI,
            debut_minutes: DEBUT_MINUTES,
            duree_min: DUREE_MIN,
            confirmer_hors_ouverture: false,
            confirmer_date_passee: false,
          },
          clientApp(),
        );
        expect(resultat.accepte).toBe(false);
        if (resultat.accepte) return;
        expect(resultat.cle).toBe("suites_a_donner.refus.statut_invalide");

        const suite = await clientOwner().suiteADonner.findUnique({
          where: { id: suiteId },
        });
        expect(suite?.intervention_reprise_id).toBeNull();
      } finally {
        await effacerSuite(suiteId);
      }
    } finally {
      await effacerIntervention(origineId);
    }
  });

  it("refuse le CHEVAUCHEMENT (RG-PLA-03) — et ne laisse AUCUNE trace : ni ligne orpheline, ni lien posé", async () => {
    // L'OBSTACLE — le même technicien, le même jour, 09:00–10:00 LOCAL
    // (Nouméa, UTC+11 : la veille 22:00Z–23:00Z).
    const occupanteId = await interventionOccupante(
      TECHNICIEN,
      new Date("2026-11-22T22:00:00.000Z"),
      new Date("2026-11-22T23:00:00.000Z"),
    );
    const origineId = await interventionJetable();
    try {
      const suiteId = await suiteAReplanifier(origineId);
      try {
        const avantLignes = await clientOwner().intervention.count();

        const resultat = await creerReprise(
          INTERNE_ADV,
          suiteId,
          {
            // 09:30, EN PLEIN MILIEU DE L'OBSTACLE — recouvrement certain.
            technicien_id: TECHNICIEN,
            date_planifiee: LUNDI,
            debut_minutes: DEBUT_MINUTES + 30,
            duree_min: DUREE_MIN,
            confirmer_hors_ouverture: false,
            confirmer_date_passee: false,
          },
          clientApp(),
        );
        expect(resultat.accepte).toBe(false);
        if (resultat.accepte) return;
        expect(resultat.cle).toBe("intervention.refus.chevauchement");

        const apresLignes = await clientOwner().intervention.count();
        expect(apresLignes).toBe(avantLignes);

        const suite = await clientOwner().suiteADonner.findUnique({
          where: { id: suiteId },
        });
        expect(suite?.intervention_reprise_id).toBeNull();
        expect(suite?.statut).toBe("a_replanifier");
      } finally {
        await effacerSuite(suiteId);
      }
    } finally {
      await effacerIntervention(origineId);
      await effacerIntervention(occupanteId);
    }
  });
});

describe("cloturerSuiteSiReprise — le déclencheur applicatif (I5, point 6)", () => {
  it("clôt la suite dont la reprise vient d'être clôturée", async () => {
    // LA REPRISE EST INSÉRÉE DIRECTEMENT `cloturee` — jamais traversée par
    // `creerReprise` (déjà prouvée par les trois épreuves ci-dessus) ni par
    // la matrice D8 des transitions, hors sujet ici : ce test mesure
    // `cloturerSuiteSiReprise` SEULE, pas le chemin qui amène une
    // intervention à `cloturee`.
    const origineId = await interventionJetable();
    const repriseId = await interventionJetable();
    try {
      const suiteId = await suiteAReplanifier(origineId);
      try {
        await clientOwner().suiteADonner.update({
          where: { id: suiteId },
          data: { intervention_reprise_id: repriseId },
        });

        await cloturerSuiteSiReprise(INTERNE_ADV, repriseId, clientApp());

        const suite = await clientOwner().suiteADonner.findUnique({
          where: { id: suiteId },
        });
        expect(suite?.statut).toBe("cloturee");
      } finally {
        // LA SUITE S'EFFACE AVANT L'INTERVENTION (clé étrangère RESTRICT).
        await effacerSuite(suiteId);
      }
    } finally {
      await effacerIntervention(repriseId);
      await effacerIntervention(origineId);
    }
  });

  it("ne touche à rien quand l'intervention n'est la reprise d'aucune suite", async () => {
    const interventionId = await interventionJetable();
    try {
      await expect(
        cloturerSuiteSiReprise(INTERNE_ADV, interventionId, clientApp()),
      ).resolves.toBeUndefined();
    } finally {
      await effacerIntervention(interventionId);
    }
  });
});

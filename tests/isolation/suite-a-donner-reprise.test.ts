import { afterAll, describe, expect, it } from "vitest";

import { type ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import {
  enregistrerAccord,
  marquerDevisEnvoye,
  marquerPieceRecue,
  qualifierSuite,
} from "@/lib/suite-a-donner/depot";
import {
  cloturerSuiteSiReprise,
  creerReprise,
} from "@/lib/suite-a-donner/reprise";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CONTACT_A1_COMPTABLE,
  INTERVENTION_A1,
  MACHINE_A1,
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
 * type. `priorite`, `contact_id` et `reference_client` se posent DANS
 * l'INSERT, jamais par une écriture ultérieure : une ligne `cloturee` est
 * TERMINALE (D160) et refuse toute modification, y compris pour en changer
 * la priorité — ou, depuis I6, le contact ou la référence client.
 */
async function interventionJetable(options?: {
  readonly priorite?: string;
  readonly contactId?: string;
  readonly referenceClient?: string;
}): Promise<string> {
  const id = uuidv7();
  const priorite = options?.priorite ?? "p3";
  const contactId = options?.contactId ?? null;
  const referenceClient = options?.referenceClient ?? null;
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "type", "statut", "priorite", "duree_estimee_min",
       "contact_id", "reference_client", "modifie_le")
     SELECT '${id}', "societe_id", "client_id", "site_id", "agence_id",
            "type", 'cloturee', '${priorite}'::"PrioriteIntervention", 60,
            ${contactId === null ? "NULL" : `'${contactId}'`},
            ${referenceClient === null ? "NULL" : `'${referenceClient}'`}, now()
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
  // LA NOTIFICATION S'EFFACE AVANT LA SUITE (9J19-SUITE-A-DONNER-
  // NOTIFICATIONS) : `suiteAReplanifier` appelle `marquerPieceRecue`, qui
  // pose désormais une notification « piece_recue » référençant cette ligne
  // (clé étrangère RESTRICT) — la supprimer dans l'autre ordre échoue.
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "notification" WHERE "suite_a_donner_id" = '${id}'`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "suite_a_donner" WHERE "id" = '${id}'`,
  );
}

/** Rattache une machine à une intervention — même forme que les autres dépôts (hors `creerReprise`). */
async function rattacherMachine(
  interventionId: string,
  machineId: string,
): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention_machine" ("id", "societe_id", "intervention_id", "machine_id", "modifie_le")
     SELECT '${uuidv7()}', "societe_id", '${interventionId}', '${machineId}', now()
       FROM "intervention" WHERE "id" = '${interventionId}'`,
  );
}

/**
 * Une machine JETABLE, clonée de `MACHINE_A1` — même modèle/client/site —
 * mais avec le STATUT demandé, pour éprouver `STATUTS_HORS_PARC_ACTIF`
 * (`lib/machines/depot.ts`) sans toucher aux machines partagées par d'autres
 * fichiers d'isolation.
 */
async function machineJetable(statut: string): Promise<string> {
  const id = uuidv7();
  const jeton = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "machine" ("id", "societe_id", "modele_id", "client_id", "site_id", "qr_token", "numero_serie", "statut", "modifie_le")
     SELECT '${id}', "societe_id", "modele_id", "client_id", "site_id", '${jeton}', 'SN-JETABLE-9K10', '${statut}'::"StatutMachine", now()
       FROM "machine" WHERE "id" = '${MACHINE_A1}'`,
  );
  return id;
}

async function effacerMachine(id: string): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "machine" WHERE "id" = '${id}'`,
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
  await marquerPieceRecue(INTERNE_ADV, id, clientApp());
  return id;
}

describe("creerReprise — les mêmes refus qu'une pose ordinaire", () => {
  it("crée l'intervention, hérite la priorité, et lie la suite dans la MÊME transaction", async () => {
    const origineId = await interventionJetable({ priorite: "p1" });
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

describe("creerReprise — I6 : reprise complète (machine, contact, référence client)", () => {
  it("recopie la machine ACTIVE, le contact et la référence client de l'origine", async () => {
    const origineId = await interventionJetable({
      contactId: CONTACT_A1_COMPTABLE,
      referenceClient: "BON-9K10-A",
    });
    let repriseId: string | null = null;
    try {
      await rattacherMachine(origineId, MACHINE_A1);
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
        expect(resultat.fiche.machines).toEqual([{ machine_id: MACHINE_A1 }]);

        const reprise = await clientOwner().intervention.findUnique({
          where: { id: repriseId },
          select: { contact_id: true, reference_client: true },
        });
        expect(reprise?.contact_id).toBe(CONTACT_A1_COMPTABLE);
        expect(reprise?.reference_client).toBe("BON-9K10-A");
      } finally {
        await effacerSuite(suiteId);
      }
    } finally {
      if (repriseId !== null) {
        await effacerIntervention(repriseId);
      }
      await effacerIntervention(origineId);
    }
  });

  it("crée la reprise SANS machine, sans refus, quand celle de l'origine est hors parc actif", async () => {
    const machineFerraillee = await machineJetable("ferraillee");
    try {
      const origineId = await interventionJetable();
      let repriseId: string | null = null;
      try {
        await rattacherMachine(origineId, machineFerraillee);
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
          expect(resultat.fiche.machines).toEqual([]);
        } finally {
          await effacerSuite(suiteId);
        }
      } finally {
        if (repriseId !== null) {
          await effacerIntervention(repriseId);
        }
        await effacerIntervention(origineId);
      }
    } finally {
      await effacerMachine(machineFerraillee);
    }
  });

  it("crée la reprise SANS machine quand l'origine n'en porte aucune", async () => {
    const origineId = await interventionJetable();
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
        expect(resultat.fiche.machines).toEqual([]);
      } finally {
        await effacerSuite(suiteId);
      }
    } finally {
      if (repriseId !== null) {
        await effacerIntervention(repriseId);
      }
      await effacerIntervention(origineId);
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

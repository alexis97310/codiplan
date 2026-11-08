import { afterAll, afterEach, describe, expect, it } from "vitest";

import { type ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import { listerNotifications } from "@/lib/notifications/depot";
import { uuidv7 } from "@/lib/db/uuid";
import {
  accordAttenduEnRetard,
  devisEnRetard,
  enregistrerAccord,
  marquerDevisEnvoye,
  marquerPieceRecue,
  qualifierSuite,
} from "@/lib/suite-a-donner/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  INTERVENTION_A1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * FLX-2, FLX-3, FLX-8 (9J19-SUITE-A-DONNER-NOTIFICATIONS).
 *
 * ## Ce que ce fichier mesure
 *
 * Que `devisEnRetard`/`accordAttenduEnRetard` ne posent AUCUNE notification
 * tant que `delai_relance_suite_jours` est NUL (CLAUDE.md §8 — une absence de
 * réglage n'est pas un réglage à zéro jour) ; qu'elles en posent UNE, et une
 * seule même rejouées, dès le délai dépassé ; et que `marquerPieceRecue` pose
 * la sienne dans la MÊME transaction que le passage à `a_replanifier`.
 *
 * Et que le filtre de capacité (`consulter_parc_complet`) tient : un rôle qui
 * la détient la lit, un rôle qui n'en tient AUCUN niveau ne la lit pas.
 * **`responsable_sav` n'est volontairement PAS ce second rôle** : la matrice
 * actuelle (`lib/auth/habilitations.ts`) le place au ● de
 * `consulter_parc_complet`, comme ADV et responsable_materiel — le rôle « sans
 * la capacité » ici est `admin_plateforme`, seul rôle de portée PLATEFORME
 * (D37) qui n'y figure à aucun niveau.
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
const SANS_CAPACITE = session(
  UTILISATEUR_PAR_ROLE[Role.admin_plateforme],
  SOCIETE_A,
  Role.admin_plateforme,
);

afterEach(async () => {
  // Aucun test de ce fichier ne doit laisser le réglage posé pour le suivant.
  await clientOwner().societe.update({
    where: { id: SOCIETE_A },
    data: { delai_relance_suite_jours: null },
  });
});

async function reglerDelai(jours: number): Promise<void> {
  await clientOwner().societe.update({
    where: { id: SOCIETE_A },
    data: { delai_relance_suite_jours: jours },
  });
}

/** Une intervention jetable du client A1, même patron que `suite-a-donner.test.ts`. */
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

async function reculerQualifieeLe(id: string, jours: number): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `UPDATE "suite_a_donner" SET "qualifiee_le" = now() - interval '${jours} days' WHERE "id" = '${id}'`,
  );
}

/**
 * Pose directement une ligne `accord_attendu`, en contrôlant `modifie_le`
 * (nécessaire pour FLX-3) — `marquerDevisEnvoye` (9K05) écrit cette
 * transition en production, mais ne permet pas de choisir l'ancienneté de
 * l'entrée dans l'état, que ce test doit maîtriser.
 */
async function poserLigneAccordAttendu(
  interventionOrigineId: string,
  joursEcoules: number,
): Promise<string> {
  const id = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "suite_a_donner"
       ("id", "societe_id", "intervention_origine_id", "statut", "modifie_le")
     SELECT '${id}', "societe_id", '${interventionOrigineId}',
            'accord_attendu'::"StatutSuiteADonner",
            now() - interval '${joursEcoules} days'
       FROM "intervention" WHERE "id" = '${interventionOrigineId}'`,
  );
  return id;
}

async function supprimerSuite(id: string): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "notification" WHERE "suite_a_donner_id" = '${id}'`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "suite_a_donner" WHERE "id" = '${id}'`,
  );
}

describe("devisEnRetard — FLX-2", () => {
  it("réglage NUL : aucune ligne rendue, aucune notification posée", async () => {
    await surUneInterventionJetable(async (interventionId) => {
      const id = await qualifierSuite(INTERNE_ADV, interventionId, clientApp());
      await reculerQualifieeLe(id, 365);

      const resultat = await devisEnRetard(INTERNE_ADV, clientApp());
      expect(resultat).not.toContain(id);

      const notifs = await clientOwner().notification.findMany({
        where: { suite_a_donner_id: id },
      });
      expect(notifs).toEqual([]);

      await supprimerSuite(id);
    });
  });

  it("délai posé mais PAS encore dépassé : aucune ligne, aucune notification", async () => {
    await surUneInterventionJetable(async (interventionId) => {
      const id = await qualifierSuite(INTERNE_ADV, interventionId, clientApp());
      await reculerQualifieeLe(id, 1);
      await reglerDelai(5);

      const resultat = await devisEnRetard(INTERNE_ADV, clientApp());
      expect(resultat).not.toContain(id);

      const notifs = await clientOwner().notification.findMany({
        where: { suite_a_donner_id: id },
      });
      expect(notifs).toEqual([]);

      await supprimerSuite(id);
    });
  });

  it("délai posé ET dépassé : pose UNE notification, lue par consulter_parc_complet", async () => {
    await surUneInterventionJetable(async (interventionId) => {
      const id = await qualifierSuite(INTERNE_ADV, interventionId, clientApp());
      await reculerQualifieeLe(id, 10);
      await reglerDelai(5);

      const resultat = await devisEnRetard(INTERNE_ADV, clientApp());
      expect(resultat).toContain(id);

      const notifs = await clientOwner().notification.findMany({
        where: { suite_a_donner_id: id, evenement: "devis_en_retard" },
      });
      expect(notifs).toHaveLength(1);
      expect(notifs[0]?.capacite_requise).toBe("consulter_parc_complet");
      expect(notifs[0]?.intervention_id).toBeNull();
      expect(notifs[0]?.demande_id).toBeNull();

      const vueAvecCapacite = await listerNotifications(
        INTERNE_ADV,
        clientApp(),
      );
      expect(vueAvecCapacite.map((n) => n.id)).toContain(notifs[0]?.id);

      const vueSansCapacite = await listerNotifications(
        SANS_CAPACITE,
        clientApp(),
      );
      expect(vueSansCapacite.map((n) => n.id)).not.toContain(notifs[0]?.id);

      await supprimerSuite(id);
    });
  });

  it("un second appel ne pose pas une seconde notification pour le même dossier", async () => {
    await surUneInterventionJetable(async (interventionId) => {
      const id = await qualifierSuite(INTERNE_ADV, interventionId, clientApp());
      await reculerQualifieeLe(id, 10);
      await reglerDelai(5);

      await devisEnRetard(INTERNE_ADV, clientApp());
      await devisEnRetard(INTERNE_ADV, clientApp());

      const notifs = await clientOwner().notification.findMany({
        where: { suite_a_donner_id: id, evenement: "devis_en_retard" },
      });
      expect(notifs).toHaveLength(1);

      await supprimerSuite(id);
    });
  });
});

describe("accordAttenduEnRetard — FLX-3", () => {
  it("délai posé ET dépassé : pose UNE notification « en attente », pas « refusé »", async () => {
    await surUneInterventionJetable(async (interventionId) => {
      const id = await poserLigneAccordAttendu(interventionId, 10);
      await reglerDelai(5);

      const resultat = await accordAttenduEnRetard(INTERNE_ADV, clientApp());
      expect(resultat).toContain(id);

      const notifs = await clientOwner().notification.findMany({
        where: {
          suite_a_donner_id: id,
          evenement: "accord_attendu_en_retard",
        },
      });
      expect(notifs).toHaveLength(1);
      expect(notifs[0]?.capacite_requise).toBe("consulter_parc_complet");

      await supprimerSuite(id);
    });
  });

  it("réglage NUL : aucune notification, même avec un dossier très ancien", async () => {
    await surUneInterventionJetable(async (interventionId) => {
      const id = await poserLigneAccordAttendu(interventionId, 365);

      const resultat = await accordAttenduEnRetard(INTERNE_ADV, clientApp());
      expect(resultat).not.toContain(id);

      const notifs = await clientOwner().notification.findMany({
        where: { suite_a_donner_id: id },
      });
      expect(notifs).toEqual([]);

      await supprimerSuite(id);
    });
  });
});

describe("marquerPieceRecue — pose piece_recue dans la MÊME transaction (FLX-8)", () => {
  it("la notification existe dès que le statut passe à a_replanifier", async () => {
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

      await marquerPieceRecue(INTERNE_ADV, id, clientApp());

      const ligne = await clientOwner().suiteADonner.findUniqueOrThrow({
        where: { id },
      });
      expect(ligne.statut).toBe("a_replanifier");

      const notifs = await clientOwner().notification.findMany({
        where: { suite_a_donner_id: id, evenement: "piece_recue" },
      });
      expect(notifs).toHaveLength(1);
      expect(notifs[0]?.capacite_requise).toBe("consulter_parc_complet");
      expect(notifs[0]?.destinataire_id).toBeNull();

      await supprimerSuite(id);
    });
  });
});

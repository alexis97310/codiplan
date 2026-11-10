import { afterAll, describe, expect, it } from "vitest";

import { type ContexteSession } from "@/lib/auth/contexte";
import {
  checklistDeLIntervention,
  enregistrerReponses,
} from "@/lib/checklists/depot";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  FAMILLE_A,
  MACHINE_A1,
  SITE_A1_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * 9K18-CHECKLIST-DOMAINE — LA SAISIE TERRAIN, SUR LE CHEMIN DE PRODUCTION RÉEL
 * (`checklistDeLIntervention`, `enregistrerReponses`).
 *
 * Toute scène nettoie ce qu'elle crée : AUCUNE écriture n'est posée sur une
 * intervention du harnais partagé (`INTERVENTION_A1`, etc.) — `enregistrer
 * Reponses` PIN la version sur la ligne, un effet qui survivrait à ce fichier
 * et fausserait les épreuves suivantes. Chaque scénario pose sa PROPRE
 * intervention jetable, et l'efface en `finally`.
 */

afterAll(fermerClients);

const TECHNICIEN_A = UTILISATEUR_PAR_ROLE[Role.technicien];

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

const TERRAIN_A = session(TECHNICIEN_A, SOCIETE_A, Role.technicien);
const COMPLET_B = session(
  UTILISATEUR_INTERNE_A,
  SOCIETE_B,
  Role.responsable_materiel,
);

/** Pose un modèle + une version — SANS point, ni rattachement (générique) par défaut. */
async function poserModeleEtVersion(
  societeId: string,
  code: string,
  rattachement: { readonly famille_id?: string } = {},
): Promise<{ modeleId: string; versionId: string }> {
  const modeleId = uuidv7();
  const versionId = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "checklist_modele" ("id", "societe_id", "code", "libelle", "famille_id", "modifie_le")
     VALUES ('${modeleId}', '${societeId}', '${code}', 'Modèle de test', ${
       rattachement.famille_id === undefined
         ? "NULL"
         : `'${rattachement.famille_id}'`
     }, now())`,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "checklist_version" ("id", "societe_id", "checklist_modele_id", "numero")
     VALUES ('${versionId}', '${societeId}', '${modeleId}', 1)`,
  );
  return { modeleId, versionId };
}

async function publierSecondeVersion(
  societeId: string,
  modeleId: string,
): Promise<string> {
  const versionId = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "checklist_version" ("id", "societe_id", "checklist_modele_id", "numero")
     VALUES ('${versionId}', '${societeId}', '${modeleId}', 2)`,
  );
  return versionId;
}

async function poserPoint(
  societeId: string,
  versionId: string,
  typeReponse: string,
  obligatoire: boolean,
): Promise<string> {
  const pointId = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "checklist_point"
       ("id", "societe_id", "checklist_version_id", "section", "ordre", "libelle", "obligatoire", "type_reponse")
     VALUES ('${pointId}', '${societeId}', '${versionId}', 'Section', 1, 'Point', ${obligatoire}, '${typeReponse}')`,
  );
  return pointId;
}

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

type InterventionJetable = {
  readonly societeId: string;
  readonly clientId: string;
  readonly siteId: string;
  readonly agenceId: string;
  readonly technicienId: string | null;
  readonly statut?: string;
  readonly machineId?: string;
};

/** Une intervention JETABLE — jamais une du harnais partagé (voir l'en-tête). */
async function surUneInterventionJetable(
  params: InterventionJetable,
  travail: (interventionId: string) => Promise<void>,
): Promise<void> {
  const id = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention"
       ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "technicien_id", "duree_estimee_min", "modifie_le")
     VALUES ('${id}', '${params.societeId}', '${params.clientId}', '${params.siteId}', '${params.agenceId}', 'curatif', '${params.statut ?? "planifiee"}', ${
       params.technicienId === null ? "NULL" : `'${params.technicienId}'`
     }, 60, now())`,
  );
  if (params.machineId !== undefined) {
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "intervention_machine" ("id", "societe_id", "intervention_id", "machine_id", "modifie_le")
       VALUES ('${uuidv7()}', '${params.societeId}', '${id}', '${params.machineId}', now())`,
    );
  }
  try {
    await travail(id);
  } finally {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = '${id}'`,
    );
  }
}

describe("société B ne lit ni n'écrit les réponses de la société A", () => {
  it("enregistrerReponses et checklistDeLIntervention rendent `null` sous le contexte de B", async () => {
    const { modeleId, versionId } = await poserModeleEtVersion(
      SOCIETE_A,
      "ISO-SOCIETE",
    );
    const pointId = await poserPoint(
      SOCIETE_A,
      versionId,
      "conforme_non_conforme_sans_objet",
      false,
    );
    try {
      await surUneInterventionJetable(
        {
          societeId: SOCIETE_A,
          clientId: CLIENT_A1,
          siteId: SITE_A1_S1,
          agenceId: AGENCE_A,
          technicienId: TECHNICIEN_A,
        },
        async (interventionId) => {
          const ecritureParA = await enregistrerReponses(
            TERRAIN_A,
            interventionId,
            [{ checklistPointId: pointId, valeur: "conforme" }],
            clientApp(),
          );
          expect(ecritureParA).toEqual({ id: interventionId });

          const luParB = await checklistDeLIntervention(
            COMPLET_B,
            interventionId,
            clientApp(),
          );
          expect(luParB).toBeNull();

          const ecritureParB = await enregistrerReponses(
            COMPLET_B,
            interventionId,
            [{ checklistPointId: pointId, valeur: "conforme" }],
            clientApp(),
          );
          expect(ecritureParB).toBeNull();

          const luParA = await checklistDeLIntervention(
            TERRAIN_A,
            interventionId,
            clientApp(),
          );
          expect(luParA).toMatchObject({
            disponible: true,
            checklistModeleLibelle: "Modèle de test",
          });
        },
      );
    } finally {
      await supprimerModele(modeleId);
    }
  });
});

describe("le PIN — posé à la première réponse acceptée, jamais avant", () => {
  it("checklist_version_id est NUL avant toute réponse, posé APRÈS", async () => {
    const { modeleId, versionId } = await poserModeleEtVersion(
      SOCIETE_A,
      "ISO-PIN",
    );
    const pointId = await poserPoint(SOCIETE_A, versionId, "case_faite", false);
    try {
      await surUneInterventionJetable(
        {
          societeId: SOCIETE_A,
          clientId: CLIENT_A1,
          siteId: SITE_A1_S1,
          agenceId: AGENCE_A,
          technicienId: TECHNICIEN_A,
        },
        async (interventionId) => {
          const avant = await clientOwner().intervention.findUnique({
            where: { id: interventionId },
            select: { checklist_version_id: true },
          });
          expect(avant?.checklist_version_id).toBeNull();

          const ecrite = await enregistrerReponses(
            TERRAIN_A,
            interventionId,
            [{ checklistPointId: pointId, valeur: true }],
            clientApp(),
          );
          expect(ecrite).toEqual({ id: interventionId });

          const apres = await clientOwner().intervention.findUnique({
            where: { id: interventionId },
            select: { checklist_version_id: true },
          });
          expect(apres?.checklist_version_id).toBe(versionId);
        },
      );
    } finally {
      await supprimerModele(modeleId);
    }
  });
});

describe("`checklist.refus.point_hors_version` — un point d'une AUTRE version que celle pinnée", () => {
  it("refuse, nommément, sans rien écrire", async () => {
    const { modeleId, versionId: versionUn } = await poserModeleEtVersion(
      SOCIETE_A,
      "ISO-HORS-VERSION",
    );
    const pointUn = await poserPoint(SOCIETE_A, versionUn, "case_faite", false);
    const versionDeux = await publierSecondeVersion(SOCIETE_A, modeleId);
    const pointDeux = await poserPoint(
      SOCIETE_A,
      versionDeux,
      "case_faite",
      false,
    );
    try {
      await surUneInterventionJetable(
        {
          societeId: SOCIETE_A,
          clientId: CLIENT_A1,
          siteId: SITE_A1_S1,
          agenceId: AGENCE_A,
          technicienId: TECHNICIEN_A,
        },
        async (interventionId) => {
          // PIN sur la version 1 (la plus récente au moment de la résolution
          // initiale... mais ici DEUX versions existent déjà : la cascade
          // résout le MODÈLE, puis prend la DERNIÈRE version publiée — donc
          // la version 2. On pin donc explicitement sur la version 1, en
          // posant le pin à la main, pour isoler le refus sous épreuve :
          // « un point de la version 2 sur une intervention pinnée en 1 ».
          await clientOwner().$executeRawUnsafe(
            `UPDATE "intervention" SET "checklist_version_id" = '${versionUn}' WHERE "id" = '${interventionId}'`,
          );

          const refus = await enregistrerReponses(
            TERRAIN_A,
            interventionId,
            [{ checklistPointId: pointDeux, valeur: true }],
            clientApp(),
          );
          expect(refus).toEqual({
            refuse: true,
            cle: "checklist.refus.point_hors_version",
          });

          // RIEN N'A ÉTÉ ÉCRIT (I6) — ni pour ce point hors version, ni pour
          // le point valide de la MÊME différence.
          const reponses = await clientOwner().checklistReponse.findMany({
            where: { intervention_id: interventionId },
          });
          expect(reponses).toHaveLength(0);

          // Le point de la version PINNÉE, lui, est accepté normalement.
          const accepte = await enregistrerReponses(
            TERRAIN_A,
            interventionId,
            [{ checklistPointId: pointUn, valeur: true }],
            clientApp(),
          );
          expect(accepte).toEqual({ id: interventionId });
        },
      );
    } finally {
      await supprimerModele(modeleId);
    }
  });
});

describe("une réponse modifiée remet à zéro la validation du rapport (RG-INT-03, D135)", () => {
  it("rapport_valide_par/le reviennent à NULL après enregistrerReponses", async () => {
    const { modeleId, versionId } = await poserModeleEtVersion(
      SOCIETE_A,
      "ISO-VALIDATION",
    );
    const pointId = await poserPoint(SOCIETE_A, versionId, "case_faite", false);
    try {
      await surUneInterventionJetable(
        {
          societeId: SOCIETE_A,
          clientId: CLIENT_A1,
          siteId: SITE_A1_S1,
          agenceId: AGENCE_A,
          technicienId: TECHNICIEN_A,
        },
        async (interventionId) => {
          await clientOwner().$executeRawUnsafe(
            `UPDATE "intervention"
               SET "rapport_valide_par" = '${UTILISATEUR_INTERNE_A}', "rapport_valide_le" = now()
             WHERE "id" = '${interventionId}'`,
          );

          await enregistrerReponses(
            TERRAIN_A,
            interventionId,
            [{ checklistPointId: pointId, valeur: true }],
            clientApp(),
          );

          const apres = await clientOwner().intervention.findUnique({
            where: { id: interventionId },
            select: { rapport_valide_par: true, rapport_valide_le: true },
          });
          expect(apres?.rapport_valide_par).toBeNull();
          expect(apres?.rapport_valide_le).toBeNull();
        },
      );
    } finally {
      await supprimerModele(modeleId);
    }
  });
});

describe("un technicien NON AFFECTÉ est refusé — même refus que l'intervention invisible (D35, D50)", () => {
  it("rend `null`, sans distinguer « non affecté » de « introuvable »", async () => {
    const { modeleId, versionId } = await poserModeleEtVersion(
      SOCIETE_A,
      "ISO-NON-AFFECTE",
    );
    const pointId = await poserPoint(SOCIETE_A, versionId, "case_faite", false);
    try {
      await surUneInterventionJetable(
        {
          societeId: SOCIETE_A,
          clientId: CLIENT_A1,
          siteId: SITE_A1_S1,
          agenceId: AGENCE_A,
          technicienId: TECHNICIEN_A,
        },
        async (interventionId) => {
          const unAutreTechnicien = session(
            UTILISATEUR_INTERNE_A,
            SOCIETE_A,
            Role.technicien,
          );
          const refus = await enregistrerReponses(
            unAutreTechnicien,
            interventionId,
            [{ checklistPointId: pointId, valeur: true }],
            clientApp(),
          );
          expect(refus).toBeNull();
        },
      );
    } finally {
      await supprimerModele(modeleId);
    }
  });
});

describe("une intervention FIGÉE (annulée, clôturée) refuse nommément — jamais une écriture silencieuse", () => {
  it.each(["annulee", "cloturee"] as const)("statut « %s »", async (statut) => {
    const { modeleId, versionId } = await poserModeleEtVersion(
      SOCIETE_A,
      `ISO-FIGEE-${statut}`,
    );
    const pointId = await poserPoint(SOCIETE_A, versionId, "case_faite", false);
    try {
      await surUneInterventionJetable(
        {
          societeId: SOCIETE_A,
          clientId: CLIENT_A1,
          siteId: SITE_A1_S1,
          agenceId: AGENCE_A,
          technicienId: TECHNICIEN_A,
          statut,
        },
        async (interventionId) => {
          const refus = await enregistrerReponses(
            TERRAIN_A,
            interventionId,
            [{ checklistPointId: pointId, valeur: true }],
            clientApp(),
          );
          expect(refus).toEqual({
            refuse: true,
            cle:
              statut === "annulee"
                ? "intervention.refus.annulee_figee"
                : "intervention.refus.cloturee_figee",
          });
        },
      );
    } finally {
      await supprimerModele(modeleId);
    }
  });
});

describe("la cascade, de bout en bout, via le dépôt — niveau FAMILLE", () => {
  it("une machine de FAMILLE_A résout le modèle rattaché à cette famille, jamais le générique", async () => {
    const { modeleId: generique } = await poserModeleEtVersion(
      SOCIETE_A,
      "ISO-CASCADE-GENERIQUE",
    );
    const { modeleId: famille, versionId: versionFamille } =
      await poserModeleEtVersion(SOCIETE_A, "ISO-CASCADE-FAMILLE", {
        famille_id: FAMILLE_A,
      });
    const pointFamille = await poserPoint(
      SOCIETE_A,
      versionFamille,
      "case_faite",
      false,
    );
    try {
      await surUneInterventionJetable(
        {
          societeId: SOCIETE_A,
          clientId: CLIENT_A1,
          siteId: SITE_A1_S1,
          agenceId: AGENCE_A,
          technicienId: TECHNICIEN_A,
          machineId: MACHINE_A1,
        },
        async (interventionId) => {
          const checklist = await checklistDeLIntervention(
            TERRAIN_A,
            interventionId,
            clientApp(),
          );
          expect(checklist).toMatchObject({
            disponible: true,
            checklistVersionId: versionFamille,
            checklistModeleLibelle: "Modèle de test",
          });
          if (checklist?.disponible === true) {
            expect(checklist.points.map((p) => p.id)).toEqual([pointFamille]);
          }
        },
      );
    } finally {
      await supprimerModele(famille);
      await supprimerModele(generique);
    }
  });
});

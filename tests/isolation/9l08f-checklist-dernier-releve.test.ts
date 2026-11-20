import { afterAll, describe, expect, it } from "vitest";

import { type ContexteSession } from "@/lib/auth/contexte";
import { checklistDeLIntervention } from "@/lib/checklists/depot";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  MACHINE_A1,
  SITE_A1_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * 9L08F-CHECKLIST-DERNIER-RELEVE — LE DERNIER RELEVÉ DE LA MÊME MACHINE, SUR
 * LE CHEMIN DE PRODUCTION RÉEL (`checklistDeLIntervention`).
 *
 * RELEVÉ SEUL, AUCUNE TOLÉRANCE (décisions d'Alexis du 11/11 et du
 * 16/11/2026) — ce fichier ne mesure QUE la lecture : quelle intervention
 * antérieure compte (`terminee`/`cloturee`, jamais une autre), laquelle
 * gagne (la plus RÉCENTE par `repondu_le`, pas la plus récente par statut),
 * et que le cloisonnement société borne cette lecture comme toute autre.
 *
 * Toute scène pose sa PROPRE intervention jetable sur `MACHINE_A1` (même
 * discipline que `checklist-domaine.test.ts`) — jamais une écriture sur le
 * harnais partagé — et nettoie en `finally`, dans l'ordre : interventions
 * (dont les réponses CASCADENT), puis le modèle de test.
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

/** Un modèle + une version GÉNÉRIQUE (aucun type, aucune famille) — résolue pour toute intervention, même patron que `checklist-domaine.test.ts`. */
async function poserModeleEtVersion(
  societeId: string,
  code: string,
): Promise<{ modeleId: string; versionId: string }> {
  const modeleId = uuidv7();
  const versionId = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "checklist_modele" ("id", "societe_id", "code", "libelle", "modifie_le")
     VALUES ('${modeleId}', '${societeId}', '${code}', 'Modèle de test 9L08F', now())`,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "checklist_version" ("id", "societe_id", "checklist_modele_id", "numero")
     VALUES ('${versionId}', '${societeId}', '${modeleId}', 1)`,
  );
  return { modeleId, versionId };
}

async function poserPointMesure(
  societeId: string,
  versionId: string,
  section: string,
  libelle: string,
  unite: string,
): Promise<string> {
  const pointId = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "checklist_point"
       ("id", "societe_id", "checklist_version_id", "section", "ordre", "libelle", "obligatoire", "type_reponse", "unite")
     VALUES ('${pointId}', '${societeId}', '${versionId}', '${section}', 1, '${libelle}', false, 'valeur_mesuree', '${unite}')`,
  );
  return pointId;
}

async function supprimerModele(modeleId: string): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "checklist_version" WHERE "checklist_modele_id" = '${modeleId}'`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "checklist_modele" WHERE "id" = '${modeleId}'`,
  );
}

/** Pose une réponse CHIFFRÉE, RECOPIANT section/libellé/unité du point — avec un `repondu_le` CHOISI (jamais `now()`), pour éprouver « la plus récente gagne ». */
async function poserReponseMesuree(
  interventionId: string,
  societeId: string,
  pointId: string,
  valeur: number,
  auteurId: string,
  reponduLe: string,
): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "checklist_reponse"
       ("id", "societe_id", "intervention_id", "checklist_point_id",
        "libelle", "section", "unite", "obligatoire", "valeur_mesuree", "auteur_id", "repondu_le")
     SELECT '${uuidv7()}', '${societeId}', '${interventionId}', "p"."id",
            "p"."libelle", "p"."section", "p"."unite", "p"."obligatoire", ${valeur}, '${auteurId}', '${reponduLe}'
       FROM "checklist_point" "p"
      WHERE "p"."id" = '${pointId}'`,
  );
}

type InterventionJetable = {
  readonly societeId: string;
  readonly clientId: string;
  readonly siteId: string;
  readonly agenceId: string;
  readonly technicienId: string | null;
  readonly statut: string;
  readonly machineId: string;
};

/** Une intervention JETABLE, rattachée à une machine — jamais une du harnais partagé. */
async function surUneInterventionJetable(
  params: InterventionJetable,
  travail: (interventionId: string) => Promise<void>,
): Promise<void> {
  const id = uuidv7();
  // LE RATTACHEMENT DE LA MACHINE, SOUS L'EXEMPTION « fixture_isolation »
  // (9L14-FIGE-A-LA-CLOTURE) — une intervention `cloturee`/`annulee` figée
  // refuse désormais `intervention_machine` en base ; ce réglage, LOCAL À
  // CETTE TRANSACTION (`SET LOCAL`), dit au déclencheur que la ligne
  // JETABLE n'a jamais été « vivante » avant d'être close — voir le
  // docblock du déclencheur dans la migration.
  // `temps_valide_min` POSÉ SI `cloturee` (9L19, garde 4) : une clôture sans
  // temps validé strictement positif est refusée en base.
  await clientOwner().$transaction([
    clientOwner().$executeRawUnsafe(
      `SET LOCAL "fige_a_la_cloture.exemption" = 'fixture_isolation'`,
    ),
    clientOwner().$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "technicien_id", "duree_estimee_min", "modifie_le", "temps_valide_min")
       VALUES ('${id}', '${params.societeId}', '${params.clientId}', '${params.siteId}', '${params.agenceId}', 'curatif', '${params.statut}', ${
         params.technicienId === null ? "NULL" : `'${params.technicienId}'`
       }, 60, now(), ${params.statut === "cloturee" ? "60" : "NULL"})`,
    ),
    clientOwner().$executeRawUnsafe(
      `INSERT INTO "intervention_machine" ("id", "societe_id", "intervention_id", "machine_id", "modifie_le")
       VALUES ('${uuidv7()}', '${params.societeId}', '${id}', '${params.machineId}', now())`,
    ),
  ]);
  try {
    await travail(id);
  } finally {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = '${id}'`,
    );
  }
}

describe("le dernier relevé — la plus RÉCENTE gagne, une intervention non figée n'est jamais prise", () => {
  it("terminee et cloturee comptent, en_cours jamais — même plus récente qu'elles", async () => {
    const { modeleId, versionId } = await poserModeleEtVersion(
      SOCIETE_A,
      "9L08F-RELEVE",
    );
    const pointId = await poserPointMesure(
      SOCIETE_A,
      versionId,
      "Mesures 9L08F",
      "Pression 9L08F",
      "bar",
    );
    try {
      await surUneInterventionJetable(
        {
          societeId: SOCIETE_A,
          clientId: CLIENT_A1,
          siteId: SITE_A1_S1,
          agenceId: AGENCE_A,
          technicienId: TECHNICIEN_A,
          statut: "cloturee",
          machineId: MACHINE_A1,
        },
        async (ancienneCloturee) => {
          await poserReponseMesuree(
            ancienneCloturee,
            SOCIETE_A,
            pointId,
            5.5,
            TECHNICIEN_A,
            "2026-01-01T08:00:00Z",
          );
          await surUneInterventionJetable(
            {
              societeId: SOCIETE_A,
              clientId: CLIENT_A1,
              siteId: SITE_A1_S1,
              agenceId: AGENCE_A,
              technicienId: TECHNICIEN_A,
              statut: "terminee",
              machineId: MACHINE_A1,
            },
            async (plusRecenteTerminee) => {
              await poserReponseMesuree(
                plusRecenteTerminee,
                SOCIETE_A,
                pointId,
                6.2,
                TECHNICIEN_A,
                "2026-06-01T08:00:00Z",
              );
              await surUneInterventionJetable(
                {
                  societeId: SOCIETE_A,
                  clientId: CLIENT_A1,
                  siteId: SITE_A1_S1,
                  agenceId: AGENCE_A,
                  technicienId: TECHNICIEN_A,
                  // LA PLUS RÉCENTE DES TROIS PAR LA DATE — mais `en_cours`
                  // n'est NI `terminee` NI `cloturee` : elle ne doit JAMAIS
                  // être prise, même si elle est postérieure aux deux autres.
                  statut: "en_cours",
                  machineId: MACHINE_A1,
                },
                async (nonFigee) => {
                  await poserReponseMesuree(
                    nonFigee,
                    SOCIETE_A,
                    pointId,
                    9.9,
                    TECHNICIEN_A,
                    "2026-10-01T08:00:00Z",
                  );
                  await surUneInterventionJetable(
                    {
                      societeId: SOCIETE_A,
                      clientId: CLIENT_A1,
                      siteId: SITE_A1_S1,
                      agenceId: AGENCE_A,
                      technicienId: TECHNICIEN_A,
                      statut: "en_cours",
                      machineId: MACHINE_A1,
                    },
                    async (courante) => {
                      const checklist = await checklistDeLIntervention(
                        TERRAIN_A,
                        courante,
                        clientApp(),
                      );
                      expect(checklist).toMatchObject({ disponible: true });
                      if (checklist === null || !checklist.disponible) {
                        throw new Error("témoin : checklist indisponible");
                      }
                      const point = checklist.points.find(
                        (p) => p.id === pointId,
                      );
                      expect(point?.dernierReleve).toEqual({
                        valeur: 6.2,
                        unite: "bar",
                        date: new Date("2026-06-01T08:00:00Z"),
                      });
                    },
                  );
                },
              );
            },
          );
        },
      );
    } finally {
      await supprimerModele(modeleId);
    }
  });
});

describe("le cloisonnement société borne cette lecture comme toute autre", () => {
  it("un relevé de la société A n'apparaît jamais sous le contexte de la société B", async () => {
    const { modeleId, versionId } = await poserModeleEtVersion(
      SOCIETE_A,
      "9L08F-SOCIETE",
    );
    const pointId = await poserPointMesure(
      SOCIETE_A,
      versionId,
      "Mesures 9L08F bis",
      "Pression 9L08F bis",
      "bar",
    );
    try {
      await surUneInterventionJetable(
        {
          societeId: SOCIETE_A,
          clientId: CLIENT_A1,
          siteId: SITE_A1_S1,
          agenceId: AGENCE_A,
          technicienId: TECHNICIEN_A,
          statut: "cloturee",
          machineId: MACHINE_A1,
        },
        async (ancienne) => {
          await poserReponseMesuree(
            ancienne,
            SOCIETE_A,
            pointId,
            7.7,
            TECHNICIEN_A,
            "2026-02-01T08:00:00Z",
          );
          await surUneInterventionJetable(
            {
              societeId: SOCIETE_A,
              clientId: CLIENT_A1,
              siteId: SITE_A1_S1,
              agenceId: AGENCE_A,
              technicienId: TECHNICIEN_A,
              statut: "en_cours",
              machineId: MACHINE_A1,
            },
            async (courante) => {
              // TÉMOIN — sous le contexte qui la pose, la fiche se lit.
              const luParA = await checklistDeLIntervention(
                TERRAIN_A,
                courante,
                clientApp(),
              );
              expect(luParA).toMatchObject({ disponible: true });

              // Sous la société B, l'intervention elle-même disparaît —
              // jamais seulement son `dernierReleve` : la RLS d'`intervention`
              // referme la porte avant que ce lot n'ait son mot à dire.
              const luParB = await checklistDeLIntervention(
                COMPLET_B,
                courante,
                clientApp(),
              );
              expect(luParB).toBeNull();
            },
          );
        },
      );
    } finally {
      await supprimerModele(modeleId);
    }
  });
});

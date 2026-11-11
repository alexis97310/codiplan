import { afterAll, describe, expect, it } from "vitest";

import { type ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import { enregistrerReponses } from "@/lib/checklists/depot";
import { uuidv7 } from "@/lib/db/uuid";
import { lireFicheIntervention } from "@/lib/interventions/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  INTERVENTION_A1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * 9K25-CHECKLIST-FICHE-BUREAU, CK9 — LA TUILE CHECKLIST DE LA FICHE BUREAU,
 * VIA `checklistDeLaFiche` (`lib/checklists/depot.ts`), lue PAR
 * `lireFicheIntervention`.
 *
 * Même discipline que `9k24-checklist-bons.test.ts` : chaque scénario pose sa
 * PROPRE intervention jetable, jamais le harnais partagé, et l'efface en
 * `finally`.
 */

afterAll(fermerClients);

const TECHNICIEN_A = UTILISATEUR_PAR_ROLE[Role.technicien] as string;

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
const ADV_A = session(UTILISATEUR_INTERNE_A, SOCIETE_A, Role.adv);

async function poserModeleEtVersion(code: string): Promise<{
  readonly modeleId: string;
  readonly versionId: string;
}> {
  const modeleId = uuidv7();
  const versionId = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "checklist_modele" ("id", "societe_id", "code", "libelle", "modifie_le")
     VALUES ('${modeleId}', '${SOCIETE_A}', '${code}', 'Modèle de test CK9', now())`,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "checklist_version" ("id", "societe_id", "checklist_modele_id", "numero")
     VALUES ('${versionId}', '${SOCIETE_A}', '${modeleId}', 1)`,
  );
  return { modeleId, versionId };
}

async function poserPoint(
  versionId: string,
  params: {
    readonly section: string;
    readonly ordre: number;
    readonly libelle: string;
    readonly typeReponse: string;
  },
): Promise<string> {
  const pointId = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "checklist_point"
       ("id", "societe_id", "checklist_version_id", "section", "ordre", "libelle", "obligatoire", "type_reponse")
     VALUES ('${pointId}', '${SOCIETE_A}', '${versionId}', '${params.section}', ${params.ordre},
             '${params.libelle}', false, '${params.typeReponse}')`,
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

/** Une intervention JETABLE, « terminee » — héritée d'`INTERVENTION_A1`. */
async function surUneInterventionTerminee(
  travail: (interventionId: string) => Promise<void>,
): Promise<void> {
  const id = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention"
       ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut",
        "technicien_id", "duree_estimee_min", "temps_valide_min",
        "rapport_valide_par", "rapport_valide_le", "modifie_le")
     SELECT '${id}', "societe_id", "client_id", "site_id", "agence_id",
            'curatif'::"TypeIntervention", 'terminee'::"StatutIntervention",
            '${TECHNICIEN_A}', 60, 60, '${UTILISATEUR_INTERNE_A}', now(), now()
       FROM "intervention" WHERE "id" = '${INTERVENTION_A1}'`,
  );
  try {
    await travail(id);
  } finally {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "checklist_reponse" WHERE "intervention_id" = '${id}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = '${id}'`,
    );
  }
}

describe("la tuile checklist de la fiche bureau — aucune version figée, aucune tuile", () => {
  it("une intervention sans aucune réponse : `fiche.checklist` est `null`", async () => {
    await surUneInterventionTerminee(async (id) => {
      const fiche = await lireFicheIntervention(ADV_A, id, clientApp());
      expect(fiche?.checklist).toBeNull();
    });
  });
});

describe("la tuile checklist de la fiche bureau — composition, provenance, auteur et heure", () => {
  it("provenance (libellé du modèle), résumé, sections, et QUI a répondu CHAQUE point, et QUAND", async () => {
    const { modeleId, versionId } = await poserModeleEtVersion("CK9-FICHE");
    try {
      const pointConforme = await poserPoint(versionId, {
        section: "Sécurité",
        ordre: 1,
        libelle: "Protections en place",
        typeReponse: "conforme_non_conforme_sans_objet",
      });
      const pointNonConforme = await poserPoint(versionId, {
        section: "Sécurité",
        ordre: 2,
        libelle: "Dispositif de sécurité testé",
        typeReponse: "conforme_non_conforme_sans_objet",
      });

      await surUneInterventionTerminee(async (id) => {
        const avant = new Date();
        const ecriture = await enregistrerReponses(
          TERRAIN_A,
          id,
          [
            { checklistPointId: pointConforme, valeur: "conforme" },
            { checklistPointId: pointNonConforme, valeur: "non_conforme" },
          ],
          clientApp(),
        );
        expect(ecriture).toEqual({ id });

        const fiche = await lireFicheIntervention(ADV_A, id, clientApp());
        expect(fiche?.checklist).not.toBeNull();
        const checklist = fiche!.checklist!;

        expect(checklist.checklistModeleLibelle).toBe("Modèle de test CK9");
        expect(checklist.resume).toEqual({
          conformes: 1,
          nonConformes: 1,
          sansObjet: 0,
        });

        expect(checklist.sections.map((s) => s.section)).toEqual(["Sécurité"]);
        const [conforme, nonConforme] = checklist.sections[0]!.points;
        expect(conforme).toMatchObject({
          libelle: "Protections en place",
          rendu: { nature: "conforme", valeur: "conforme" },
        });
        expect(nonConforme).toMatchObject({
          libelle: "Dispositif de sécurité testé",
          rendu: { nature: "conforme", valeur: "non_conforme" },
        });

        // L'AUTEUR — résolu, jamais l'UUID brut (I10) ni « — » (la personne
        // EST dans le périmètre : c'est le technicien affecté lui-même).
        for (const point of [conforme, nonConforme]) {
          expect(point!.auteur).not.toBe("—");
          expect(point!.auteur.length).toBeGreaterThan(0);
          expect(point!.reponduLe.getTime()).toBeGreaterThanOrEqual(
            avant.getTime(),
          );
        }
      });
    } finally {
      await supprimerModele(modeleId);
    }
  });
});

describe("la tuile checklist de la fiche bureau — isolation", () => {
  it("une AUTRE société ne lit aucune réponse", async () => {
    const { modeleId, versionId } =
      await poserModeleEtVersion("CK9-FICHE-SOCIETE");
    try {
      const pointId = await poserPoint(versionId, {
        section: "Section",
        ordre: 1,
        libelle: "Point",
        typeReponse: "texte_libre",
      });

      await surUneInterventionTerminee(async (id) => {
        await enregistrerReponses(
          TERRAIN_A,
          id,
          [{ checklistPointId: pointId, valeur: "texte" }],
          clientApp(),
        );

        const ficheAutreSociete = await lireFicheIntervention(
          session(UTILISATEUR_INTERNE_A, SOCIETE_B, Role.adv),
          id,
          clientApp(),
        );
        expect(ficheAutreSociete).toBeNull();
      });
    } finally {
      await supprimerModele(modeleId);
    }
  });
});

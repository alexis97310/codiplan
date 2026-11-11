import { afterAll, describe, expect, it } from "vitest";

import { type ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import { enregistrerReponses } from "@/lib/checklists/depot";
import { uuidv7 } from "@/lib/db/uuid";
import { lireBonDuParc, lireBonIntervention } from "@/lib/interventions/bon";

import { avecPortail, clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_A2,
  INTERVENTION_A1,
  PORTAIL_A_CLIENT,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * 9K24-CHECKLIST-BONS, CK8 — LA TUILE CHECKLIST SUR LE BON, BUREAU ET
 * PORTAIL, VIA `composerBon` PARTAGÉE (`lib/interventions/bon.ts`).
 *
 * Même discipline que `checklist-domaine.test.ts` : chaque scénario pose sa
 * PROPRE intervention jetable, jamais le harnais partagé, et l'efface en
 * `finally` — `enregistrerReponses` pin la version SUR LA LIGNE, un effet qui
 * survivrait à ce fichier.
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

function contextePortail(
  utilisateurId: string,
  clientId: string,
): ContexteSession {
  return {
    utilisateurId,
    societeId: SOCIETE_A,
    role: Role.client,
    secondFacteurValide: true,
    adresseIp: null,
    clientId,
  };
}

async function poserModeleEtVersion(code: string): Promise<{
  readonly modeleId: string;
  readonly versionId: string;
}> {
  const modeleId = uuidv7();
  const versionId = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "checklist_modele" ("id", "societe_id", "code", "libelle", "modifie_le")
     VALUES ('${modeleId}', '${SOCIETE_A}', '${code}', 'Modèle de test CK8', now())`,
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
    readonly unite?: string;
  },
): Promise<string> {
  const pointId = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "checklist_point"
       ("id", "societe_id", "checklist_version_id", "section", "ordre", "libelle", "obligatoire", "type_reponse", "unite")
     VALUES ('${pointId}', '${SOCIETE_A}', '${versionId}', '${params.section}', ${params.ordre},
             '${params.libelle}', false, '${params.typeReponse}',
             ${params.unite === undefined ? "NULL" : `'${params.unite}'`})`,
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

/**
 * Une intervention JETABLE, « terminee » — `enregistrerReponses` l'accepte
 * (seules `cloturee`/`annulee` sont figées, voir `estFige`), et la matrice
 * D8 (D160) n'autorise `cloturee` QUE depuis `terminee`, avec le temps validé
 * ET le rapport validé déjà posés : les deux le sont dès l'INSERT, pour que
 * `cloturer` ci-dessous soit une simple transition, jamais un second geste.
 */
async function surUneInterventionTerminee(
  travail: (interventionId: string) => Promise<void>,
): Promise<void> {
  const id = uuidv7();
  // SOCIETE/CLIENT/SITE/AGENCE HÉRITÉS d'`INTERVENTION_A1` (même geste que
  // `9j22-portail-bon-technicien-temps.test.ts`) : le périmètre « parc » du
  // compte portail (`PORTAIL_A_CLIENT`) se mesure sur ce chaînage RÉEL,
  // jamais sur un couple client/site assemblé à la main.
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

/**
 * `enregistrerReponses` ANNULE LA VALIDATION DU RAPPORT (RG-INT-03, D135) à
 * chaque réponse écrite — cette transition la REPOSE au même geste, pour que
 * la garde de clôture (RG-INT-03, tenue en base) la retrouve déjà vraie.
 */
async function cloturer(id: string): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `UPDATE "intervention"
        SET "statut" = 'cloturee', "cloturee_le" = now(),
            "rapport_valide_par" = '${UTILISATEUR_INTERNE_A}', "rapport_valide_le" = now()
      WHERE "id" = '${id}'`,
  );
}

describe("la tuile checklist du bon — aucune version figée, aucune tuile", () => {
  it("une intervention close SANS aucune réponse : `bon.checklist` est `null`", async () => {
    await surUneInterventionTerminee(async (id) => {
      await cloturer(id);
      const bon = await lireBonIntervention(ADV_A, id, clientApp());
      expect(bon?.checklist).toBeNull();
    });
  });
});

describe("la tuile checklist du bon — composition depuis les réponses RECOPIÉES", () => {
  it("résumé par nature, points groupés par section, mesure avec son unité, non conforme compté", async () => {
    const { modeleId, versionId } = await poserModeleEtVersion("CK8-COMPOSITION");
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
      const pointMesure = await poserPoint(versionId, {
        section: "Mesures",
        ordre: 3,
        libelle: "Température huile",
        typeReponse: "valeur_mesuree",
        unite: "°C",
      });
      const pointTexte = await poserPoint(versionId, {
        section: "Mesures",
        ordre: 4,
        libelle: "Observations",
        typeReponse: "texte_libre",
      });

      await surUneInterventionTerminee(async (id) => {
        const ecriture = await enregistrerReponses(
          TERRAIN_A,
          id,
          [
            { checklistPointId: pointConforme, valeur: "conforme" },
            { checklistPointId: pointNonConforme, valeur: "non_conforme" },
            { checklistPointId: pointMesure, valeur: 23.5 },
            { checklistPointId: pointTexte, valeur: "Rien à signaler" },
          ],
          clientApp(),
        );
        expect(ecriture).toEqual({ id });
        await cloturer(id);

        const bon = await lireBonIntervention(ADV_A, id, clientApp());
        expect(bon?.checklist).not.toBeNull();
        const checklist = bon!.checklist!;

        expect(checklist.resume).toEqual({
          conformes: 1,
          nonConformes: 1,
          sansObjet: 0,
        });

        expect(checklist.sections.map((s) => s.section)).toEqual([
          "Sécurité",
          "Mesures",
        ]);
        const securite = checklist.sections[0]!;
        expect(securite.points).toHaveLength(2);
        expect(securite.points[0]).toMatchObject({
          libelle: "Protections en place",
          rendu: { nature: "conforme", valeur: "conforme" },
        });
        expect(securite.points[1]).toMatchObject({
          libelle: "Dispositif de sécurité testé",
          rendu: { nature: "conforme", valeur: "non_conforme" },
        });

        const mesures = checklist.sections[1]!;
        expect(mesures.points[0]).toMatchObject({
          libelle: "Température huile",
          rendu: { nature: "mesure", valeur: 23.5, unite: "°C" },
        });
        expect(mesures.points[1]).toMatchObject({
          libelle: "Observations",
          rendu: { nature: "texte", valeur: "Rien à signaler" },
        });
      });
    } finally {
      await supprimerModele(modeleId);
    }
  });

  it("le libellé vient de la RÉPONSE, jamais relu sur le point — même après une correction posée directement sur `checklist_point`", async () => {
    const { modeleId, versionId } = await poserModeleEtVersion(
      "CK8-RECOPIE",
    );
    try {
      const pointId = await poserPoint(versionId, {
        section: "Section",
        ordre: 1,
        libelle: "Libellé au moment de la réponse",
        typeReponse: "case_faite",
      });

      await surUneInterventionTerminee(async (id) => {
        await enregistrerReponses(
          TERRAIN_A,
          id,
          [{ checklistPointId: pointId, valeur: true }],
          clientApp(),
        );
        await cloturer(id);

        // UNE MODIFICATION DU POINT, HORS DU FLUX NORMAL (celui-ci est
        // immuable en production, D235) — pour prouver que `checklistDuBon`
        // ne la verrait de toute façon jamais : elle ne lit QUE la réponse.
        await clientOwner().$executeRawUnsafe(
          `UPDATE "checklist_point" SET "libelle" = 'Libellé modifié après coup' WHERE "id" = '${pointId}'`,
        );

        const bon = await lireBonIntervention(ADV_A, id, clientApp());
        const point = bon!.checklist!.sections[0]!.points[0]!;
        expect(point.libelle).toBe("Libellé au moment de la réponse");
        expect(point.rendu).toEqual({ nature: "case" });
      });
    } finally {
      await supprimerModele(modeleId);
    }
  });
});

describe("la tuile checklist du bon — isolation", () => {
  it("le bon du PORTAIL, pour le client DE l'intervention, rend les mêmes réponses (D235)", async () => {
    const { modeleId, versionId } = await poserModeleEtVersion(
      "CK8-PORTAIL",
    );
    try {
      const pointId = await poserPoint(versionId, {
        section: "Section",
        ordre: 1,
        libelle: "Point visible au client",
        typeReponse: "conforme_non_conforme_sans_objet",
      });

      await surUneInterventionTerminee(async (id) => {
        await enregistrerReponses(
          TERRAIN_A,
          id,
          [{ checklistPointId: pointId, valeur: "sans_objet" }],
          clientApp(),
        );
        await cloturer(id);

        const bon = await lireBonDuParc(
          contextePortail(PORTAIL_A_CLIENT, CLIENT_A1),
          id,
          clientApp(),
        );
        expect(bon?.checklist?.sections[0]?.points[0]).toMatchObject({
          libelle: "Point visible au client",
          rendu: { nature: "conforme", valeur: "sans_objet" },
        });

        // LA MESURE DIRECTE — un AUTRE client de la même société ne lit
        // AUCUNE ligne de `checklist_reponse` pour cette intervention : la
        // politique « cloisonnement_filiation » (9K08-CHECKLIST-SCHEMA)
        // referme, indépendamment de la composition de l'écran.
        const vuParA2 = await avecPortail(
          { societeId: SOCIETE_A, clientId: CLIENT_A2 },
          (tx) => tx.checklistReponse.count({ where: { intervention_id: id } }),
        );
        expect(vuParA2).toBe(0);
      });
    } finally {
      await supprimerModele(modeleId);
    }
  });

  it("une AUTRE société ne lit aucune réponse", async () => {
    const { modeleId, versionId } = await poserModeleEtVersion(
      "CK8-SOCIETE",
    );
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
        await cloturer(id);

        const bonAutreSociete = await lireBonIntervention(
          session(UTILISATEUR_INTERNE_A, SOCIETE_B, Role.adv),
          id,
          clientApp(),
        );
        expect(bonAutreSociete).toBeNull();
      });
    } finally {
      await supprimerModele(modeleId);
    }
  });
});

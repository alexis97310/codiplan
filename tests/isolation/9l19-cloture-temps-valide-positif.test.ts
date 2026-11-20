import { afterAll, afterEach, describe, expect, it } from "vitest";

import { uuidv7 } from "@/lib/db/uuid";

import { clientOwner, fermerClients } from "./setup/db";
import { AGENCE_A, CLIENT_A1, SITE_A1_S1, SOCIETE_A } from "./setup/fixtures";

/**
 * 9L19-GARDES-BASE-CHEVAUCHEMENT-SEGMENTS, point 4 — UNE CLÔTURE EXIGE UN
 * TEMPS VALIDÉ STRICTEMENT POSITIF, SAUF L'ARCHIVE QUI N'EN PORTE AUCUN.
 *
 * Décision d'Alexis du 10/11/2026. `schemaCloture` (`lib/interventions/
 * saisie.ts`) exige déjà `.positive()` à la saisie. `intervention_cycle_de_
 * vie` refuse déjà la clôture quand `temps_valide_min` est NUL — mais un
 * ZÉRO, ou une valeur NÉGATIVE, passait : cette contrainte referme ce qu'il
 * laissait passer, et juge aussi l'`INSERT` (une ligne qui NAÎT clôturée),
 * que le déclencheur ne garde pas.
 *
 * **L'exemption nommée** (voir la migration) : `creerInterventionsRepriseEnLot`
 * (`lib/interventions/depot-reprise.ts`, D127) clôture l'archive SANS AUCUN
 * temps — `temps_mesure_min`, `temps_valide_par` et `temps_valide_le` tous
 * NULS. Les scénarios « MESURÉE » ci-dessous posent `temps_mesure_min` pour
 * sortir délibérément de cette exemption et mesurer la règle qu'elle
 * n'efface pas ; le scénario « L'ARCHIVE » mesure l'exemption elle-même.
 */

const jetables: string[] = [];

afterAll(fermerClients);

afterEach(async () => {
  for (const id of jetables.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
      id,
    );
  }
});

/**
 * `statut_facturation` est posé à `non_facturable` : la contrainte NOT VALID
 * `intervention_cloture_a_son_statut_facturation` l'exige dès l'ÉCRITURE
 * (NOT VALID ne dispense que le rattrapage des lignes déjà en base, jamais
 * les nouvelles) — sans lui, ce scénario mesurerait ce refus-là, pas celui
 * qu'il vise.
 *
 * `mesuree` sort délibérément de l'exemption nommée en posant `temps_valide_
 * par`/`temps_valide_le` (jamais `temps_mesure_min` : cette colonne porte son
 * PROPRE déclencheur, `intervention_temps_mesure_du_compteur`, qui exige
 * qu'elle égale la somme des segments — zéro ici, faute de segment posé —, et
 * la poser à une autre valeur mesurerait CE refus, pas celui que ce fichier
 * vise). Par défaut `mesuree` est faux : c'est la forme exacte de l'archive.
 */
async function poserIntervention(
  tempsValideMin: number | null,
  mesuree = false,
): Promise<string> {
  const id = uuidv7();
  jetables.push(id);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention"
       ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
        "statut", "duree_estimee_min", "temps_valide_par", "temps_valide_le",
        "temps_valide_min", "statut_facturation", "cloturee_le", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
             'cloturee', 60, $6::uuid, $7, $8,
             'non_facturable'::"StatutFacturation", now(), now())`,
    id,
    SOCIETE_A,
    CLIENT_A1,
    SITE_A1_S1,
    AGENCE_A,
    mesuree ? uuidv7() : null,
    mesuree ? new Date() : null,
    tempsValideMin,
  );
  return id;
}

describe("une intervention CLÔTURÉE porte un temps validé strictement positif", () => {
  it("TÉMOIN — MESURÉE, un temps validé positif passe", async () => {
    await expect(poserIntervention(60, true)).resolves.toBeTypeOf("string");
  });

  it("MESURÉE, ZÉRO validé — refusé", async () => {
    await expect(poserIntervention(0, true)).rejects.toThrow(
      /intervention_cloturee_a_son_temps_valide_positif/,
    );
  });

  it("MESURÉE, NÉGATIF validé — refusé", async () => {
    await expect(poserIntervention(-15, true)).rejects.toThrow(
      /intervention_cloturee_a_son_temps_valide_positif/,
    );
  });

  it("L'ARCHIVE — aucun temps mesuré ni validé par personne, temps_valide_min NUL passe", async () => {
    // La forme exacte de creerInterventionsRepriseEnLot (depot-reprise.ts) :
    // temps_mesure_min, temps_valide_par, temps_valide_le tous NULS.
    await expect(poserIntervention(null)).resolves.toBeTypeOf("string");
  });

  it("LE JUMEAU : la contrainte retirée, une ligne MESURÉE à zéro passe", async () => {
    await clientOwner()
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `ALTER TABLE "intervention" DROP CONSTRAINT "intervention_cloturee_a_son_temps_valide_positif"`,
        );
        const id = uuidv7();
        jetables.push(id);
        const ecrit = await tx.$executeRawUnsafe(
          `INSERT INTO "intervention"
             ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
              "statut", "duree_estimee_min", "temps_valide_par",
              "temps_valide_le", "temps_valide_min", "statut_facturation",
              "cloturee_le", "modifie_le")
           VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
                   'cloturee', 60, $6::uuid, now(), 0,
                   'non_facturable'::"StatutFacturation", now(), now())`,
          id,
          SOCIETE_A,
          CLIENT_A1,
          SITE_A1_S1,
          AGENCE_A,
          uuidv7(),
        );
        expect(ecrit).toBe(1);
        throw new Error("rollback volontaire");
      })
      .catch((erreur: unknown) => {
        expect(String(erreur)).toContain("rollback volontaire");
      });
  });
});

import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { lireBonIntervention } from "@/lib/interventions/bon";
import { cloturerIntervention } from "@/lib/interventions/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  MACHINE_A1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * LE BON D'INTERVENTION IMPRIMABLE (lot 16, BON-1) — CE QUE LA BASE PORTE
 * DÉJÀ, lu à travers `lireBonIntervention`.
 *
 * Même décor que `valorisation-intervention.test.ts` : une intervention
 * close, avec taux, forfait, machine et segments réels — le bon ne recalcule
 * rien, il lit ce que la clôture (`cloturerIntervention`, DÉJÀ éprouvée
 * ailleurs) a déjà produit, et lit en plus les segments de travail que la
 * fiche n'affichait pas.
 */

afterAll(fermerClients);

const SESSION = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const DEVISE = "XPF";
const TAUX_MINEUR = BigInt(9000);
const FORFAIT_MINEUR = BigInt(3500);

/** Un créneau entièrement dans l'ouverture du lundi de `CALENDRIER_A` (8 h–12 h). */
const CRENEAU_DEBUT = "2026-09-14T09:00:00+11:00";
const CRENEAU_FIN = "2026-09-14T10:45:00+11:00";
/** Deux allers du même technicien : 45 min, une pause, 45 min — 90 min mesurées. */
const SEGMENT_1 = {
  debut: "2026-09-14T09:00:00+11:00",
  fin: "2026-09-14T09:45:00+11:00",
};
const SEGMENT_2 = {
  debut: "2026-09-14T10:00:00+11:00",
  fin: "2026-09-14T10:45:00+11:00",
};
const TEMPS_MESURE_MIN = 90;

const TECHNICIEN = UTILISATEUR_PAR_ROLE.technicien;

const jetables: string[] = [];
const techniciensPoses: string[] = [];
const tauxPoses: string[] = [];

async function poserLeTaux(): Promise<string> {
  const id = uuidv7();
  tauxPoses.push(id);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "taux_horaire" ("id","societe_id","date_effet","montant_mineur","devise_code")
     VALUES ('${id}', '${SOCIETE_A}', DATE '2020-01-01', ${TAUX_MINEUR}, '${DEVISE}')
     ON CONFLICT DO NOTHING`,
  );
  return id;
}

async function poserUnForfait(): Promise<string> {
  const id = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "forfait" ("id","societe_id","code","libelle","type","rang",
       "montant_mineur","devise_code","zone_geo","type_intervention","cumulable_temps","actif")
     VALUES ('${id}', '${SOCIETE_A}', 'BON-${id.slice(-6)}', 'Déplacement bon', 'deplacement',
             ${Math.floor(Math.random() * 100000)}, ${FORFAIT_MINEUR}, '${DEVISE}',
             NULL, NULL, true, true)`,
  );
  return id;
}

async function poserLeTechnicien(): Promise<void> {
  const id = uuidv7();
  const pose = await clientOwner().$executeRawUnsafe(
    `INSERT INTO "technicien" ("id","societe_id","utilisateur_id","agence_id","modifie_le")
     VALUES ('${id}', '${SOCIETE_A}', '${TECHNICIEN}', '${AGENCE_A}', now())
     ON CONFLICT DO NOTHING`,
  );
  if (pose > 0) {
    techniciensPoses.push(id);
  }
}

/** Une intervention close, avec machine, deux segments et un forfait — le décor du bon. */
async function interventionClose(forfaitId: string): Promise<string> {
  const id = uuidv7();
  jetables.push(id);
  await poserLeTechnicien();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id","societe_id","client_id","site_id","agence_id",
       "type","statut","mode_valorisation","forfait_deplacement_id",
       "technicien_id","creneau_debut","creneau_fin","modifie_le")
     SELECT '${id}', "societe_id", "client_id", "site_id", '${AGENCE_A}',
            'curatif', 'en_cours', 'temps_passe'::"ModeValorisation",
            '${forfaitId}',
            '${TECHNICIEN}', '${CRENEAU_DEBUT}'::timestamptz,
            '${CRENEAU_FIN}'::timestamptz, now()
       FROM "intervention" WHERE "statut" = 'planifiee' AND "societe_id" = '${SOCIETE_A}' LIMIT 1`,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention_machine" ("id","societe_id","intervention_id","machine_id","modifie_le")
     VALUES ('${uuidv7()}', '${SOCIETE_A}', '${id}', '${MACHINE_A1}', now())`,
  );
  for (const segment of [SEGMENT_1, SEGMENT_2]) {
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "segment_travail" ("id","societe_id","intervention_id","utilisateur_id","debut","fin","modifie_le")
       VALUES ('${uuidv7()}', '${SOCIETE_A}', '${id}', '${TECHNICIEN}',
               '${segment.debut}'::timestamptz, '${segment.fin}'::timestamptz, now())`,
    );
  }
  await clientOwner().$executeRawUnsafe(
    `UPDATE "intervention" SET "temps_mesure_min" = ${TEMPS_MESURE_MIN} WHERE "id" = '${id}'`,
  );
  return id;
}

afterEach(async () => {
  for (const id of techniciensPoses.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "technicien" WHERE "id" = '${id}'`,
    );
  }
  for (const id of jetables.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = '${id}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = '${id}'`,
    );
  }
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "forfait" WHERE "code" LIKE 'BON-%'`,
  );
  for (const id of tauxPoses.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "taux_horaire" WHERE "id" = '${id}'`,
    );
  }
});

describe("le bon d'une intervention close rend ce que la base porte déjà", () => {
  it("en-tête société, machine, segments avec leur durée, taux, forfait et montant", async () => {
    await poserLeTaux();
    const forfaitId = await poserUnForfait();
    const id = await interventionClose(forfaitId);

    const cloture = await cloturerIntervention(
      SESSION,
      { intervention_id: id, temps_valide_min: TEMPS_MESURE_MIN },
      clientApp(),
    );
    expect(cloture.accepte).toBe(true);

    const bon = await lireBonIntervention(SESSION, id, clientApp());
    expect(bon).not.toBeNull();
    if (bon === null) return;

    // L'EN-TÊTE SOCIÉTÉ — la raison sociale telle que le harnais la sème.
    expect(bon.societe.raisonSociale).toBe("Société A");

    // LA MACHINE — rattachée par `intervention_machine`.
    expect(bon.ligne.machines.map((m) => m.machine_id)).toContain(MACHINE_A1);

    // LES SEGMENTS DE TRAVAIL — DEUX allers, chacun avec sa durée, et la somme.
    expect(bon.segments).toHaveLength(2);
    expect(bon.segments[0]?.minutes).toBe(45);
    expect(bon.segments[1]?.minutes).toBe(45);
    expect(bon.segments.every((s) => s.technicien !== "—")).toBe(true);
    expect(bon.minutesTotal).toBe(TEMPS_MESURE_MIN);

    // LE TAUX EN VIGUEUR À LA DATE — lu par `tauxEnVigueur`, jamais recalculé.
    expect(bon.taux?.valeur).toBe(TAUX_MINEUR);

    // LE FORFAIT DE DÉPLACEMENT.
    expect(bon.forfaitMontant?.valeur).toBe(FORFAIT_MINEUR);
    expect(bon.forfaitLibelle).not.toBeNull();

    // LE MONTANT — exactement celui que la clôture a figé en base, jamais
    // recomposé une seconde fois ici.
    const [enBase] = await clientOwner().$queryRawUnsafe<
      Array<{ montant_ht: bigint | null }>
    >(`SELECT "montant_ht" FROM "intervention" WHERE "id" = '${id}'`);
    expect(enBase?.montant_ht).not.toBeNull();
    expect(bon.montantTotal?.valeur).toBe(enBase?.montant_ht);
  });
});

describe("sans taux en vigueur à la date, le bon nomme l'absence et ne rend aucun montant", () => {
  it("le taux disparu APRÈS la clôture efface le total, même figé en base", async () => {
    const tauxId = await poserLeTaux();
    const forfaitId = await poserUnForfait();
    const id = await interventionClose(forfaitId);

    const cloture = await cloturerIntervention(
      SESSION,
      { intervention_id: id, temps_valide_min: TEMPS_MESURE_MIN },
      clientApp(),
    );
    expect(cloture.accepte).toBe(true);

    // LE TÉMOIN : le montant est bien écrit en base avant qu'on retire le taux.
    const [avant] = await clientOwner().$queryRawUnsafe<
      Array<{ montant_ht: bigint | null }>
    >(`SELECT "montant_ht" FROM "intervention" WHERE "id" = '${id}'`);
    expect(avant?.montant_ht).not.toBeNull();

    // Un historique modifié après coup — le cas que ce test mesure : plus
    // aucune ligne de `taux_horaire` ne couvre la date de cette intervention.
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "taux_horaire" WHERE "id" = '${tauxId}'`,
    );

    const bon = await lireBonIntervention(SESSION, id, clientApp());
    expect(bon).not.toBeNull();
    if (bon === null) return;

    expect(bon.taux).toBeNull();
    // Le montant reste TU, alors même que `montant_ht` porte encore une
    // valeur en base : un total qu'on ne peut plus reconstituer ne s'affiche
    // pas, quelle que soit la colonne qui le porte encore.
    expect(bon.montantTotal).toBeNull();
  });
});

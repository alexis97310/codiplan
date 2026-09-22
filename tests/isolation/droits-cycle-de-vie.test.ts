import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import {
  arreterLeCompteur,
  demarrerLeCompteur,
} from "@/lib/interventions/depot-compteur";
import {
  cloturerIntervention,
  reprendreIntervention,
  suspendreIntervention,
} from "@/lib/interventions/depot";
import {
  enregistrerVerification,
  schemaVerificationVgp,
} from "@/lib/vgp/verification";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  INTERVENTION_A1,
  MACHINE_A2,
  SOCIETE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * D131 (23/09/2026, DROITS-1) — QUI CLÔTURE, QUI ANNULE, QUI SUSPEND, QUI
 * ENREGISTRE UNE VGP, ET SUR QUELLE INTERVENTION.
 *
 * ## CE QUE LA MESURE DU 23/09 A ÉTABLI
 *
 * Cinq routes qui ÉCRIVENT n'exigeaient aucune capacité : n'importe quel
 * compte de la société, technicien compris, pouvait clôturer, annuler,
 * suspendre ou reprendre l'intervention d'un COLLÈGUE, et enregistrer une VGP
 * sur n'importe quelle machine. `tests/unit/auth/porte.test.ts` et
 * `tests/unit/auth/habilitations.test.ts` prouvent que la PORTE ferme
 * désormais ce trou au niveau du RÔLE (un client, ou un technicien sur
 * « annuler », n'atteint plus le dépôt du tout).
 *
 * **Ce fichier prouve l'autre moitié : le PÉRIMÈTRE.** La porte laisse
 * passer le ○ du technicien ; c'est le dépôt — `cloturerIntervention`,
 * `suspendreIntervention`, `reprendreIntervention`, `enregistrerVerification`
 * — qui juge s'IL est le technicien affecté. Une confrontation à la base est
 * la seule façon de le prouver : ces fonctions LISENT et ÉCRIVENT sous RLS.
 */

afterAll(fermerClients);

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien] as string;
/** Un second technicien, jamais authentifié dans ce fichier : il n'existe que
 * comme VALEUR posée sur `technicien_id` — aucune ligne `utilisateur_societe`
 * ne le porte, et `technicien_id` n'a pas de clé étrangère (mesuré sur le
 * schéma). C'est le COLLÈGUE dont l'intervention n'appartient pas à
 * `TECHNICIEN`. */
const COLLEGUE = "aaaaaaaa-0000-7000-8000-0000000007c1";

const SESSION_TECH = {
  utilisateurId: TECHNICIEN,
  societeId: SOCIETE_A,
  role: Role.technicien,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const SESSION_BUREAU = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.adv] as string,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const jetables: string[] = [];
const tauxPoses: string[] = [];
const verificationsPosees: string[] = [];

async function poserLeTaux(): Promise<void> {
  const id = uuidv7();
  tauxPoses.push(id);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "taux_horaire" ("id","societe_id","date_effet","montant_mineur","devise_code")
     VALUES ('${id}', '${SOCIETE_A}', DATE '2020-01-01', 5000, 'XPF')
     ON CONFLICT DO NOTHING`,
  );
}

/** Une intervention jetable, clonée du décor de `INTERVENTION_A1`, affectée à `technicienId` (ou aucun). */
async function jetable(
  technicienId: string | null,
  statut: "planifiee" | "suspendue" = "planifiee",
): Promise<string> {
  const id = uuidv7();
  jetables.push(id);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id","societe_id","client_id","site_id","agence_id",
       "type","statut","date_planifiee","technicien_id","modifie_le")
     SELECT '${id}', "societe_id", "client_id", "site_id", "agence_id",
            'curatif', 'planifiee', DATE '2026-09-14',
            ${technicienId === null ? "NULL" : `'${technicienId}'`}, now()
       FROM "intervention" WHERE "id" = '${INTERVENTION_A1}'`,
  );
  if (statut === "suspendue") {
    await clientOwner().$executeRawUnsafe(
      `UPDATE "intervention" SET "statut" = 'suspendue',
         "motif_suspension" = 'épreuve', "suspendue_le" = now()
       WHERE "id" = '${id}'`,
    );
  }
  return id;
}

/** L'état brut d'une ligne, lu SOUS LE PROPRIÉTAIRE — hors RLS, la vérité de base. */
async function etat(
  id: string,
): Promise<{ statut: string; technicien_id: string | null }> {
  const [ligne] = await clientOwner().$queryRawUnsafe<
    Array<{ statut: string; technicien_id: string | null }>
  >(`SELECT "statut", "technicien_id" FROM "intervention" WHERE "id" = '${id}'`);
  if (ligne === undefined) {
    throw new Error("intervention introuvable — le harnais est cassé");
  }
  return ligne;
}

async function relier(interventionId: string, machineId: string): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention_machine" ("id","societe_id","intervention_id","machine_id","modifie_le")
     VALUES ('${uuidv7()}', '${SOCIETE_A}', '${interventionId}', '${machineId}', now())
     ON CONFLICT DO NOTHING`,
  );
}

afterEach(async () => {
  for (const id of verificationsPosees.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "vgp_verification" WHERE "id" = '${id}'`,
    );
  }
  for (const id of tauxPoses.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "taux_horaire" WHERE "id" = '${id}'`,
    );
  }
  for (const id of jetables.splice(0)) {
    // `intervention_machine` est en CASCADE sur `intervention` (schéma) : la
    // supprimer ici suffit.
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = '${id}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = '${id}'`,
    );
  }
});

describe("CLÔTURER — le ○ du technicien est scopé à SA PROPRE intervention", () => {
  it("un technicien REFUSÉ sur l'intervention d'un collègue — et RIEN ne change en base", async () => {
    const id = await jetable(COLLEGUE);
    const avant = await etat(id);

    const resultat = await cloturerIntervention(
      SESSION_TECH,
      { intervention_id: id, temps_valide_min: 60 },
      clientApp(),
    );

    // Même clé que « intervention introuvable » — hors périmètre et
    // inexistante rendent LA MÊME chose (D35, D50) : distinguer les deux
    // dirait à un technicien qu'une intervention d'un collègue existe.
    expect(resultat).toEqual({
      accepte: false,
      cle: "intervention.refus.inconnue",
    });
    expect(await etat(id)).toEqual(avant);
  });

  it("le technicien clôture SA PROPRE intervention affectée", async () => {
    await poserLeTaux();
    const id = await jetable(TECHNICIEN);
    await demarrerLeCompteur(
      SESSION_TECH,
      id,
      new Date("2026-09-14T08:00:00.000Z"),
      clientApp(),
    );
    await arreterLeCompteur(
      SESSION_TECH,
      new Date("2026-09-14T09:30:00.000Z"),
      clientApp(),
    );

    const resultat = await cloturerIntervention(
      SESSION_TECH,
      { intervention_id: id, temps_valide_min: 90 },
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
    expect((await etat(id)).statut).toBe("cloturee");
  });

  it("le bureau clôture N'IMPORTE QUELLE intervention, même celle d'un technicien qui n'est pas lui", async () => {
    await poserLeTaux();
    const id = await jetable(TECHNICIEN);
    await demarrerLeCompteur(
      SESSION_TECH,
      id,
      new Date("2026-09-14T08:00:00.000Z"),
      clientApp(),
    );
    await arreterLeCompteur(
      SESSION_TECH,
      new Date("2026-09-14T09:00:00.000Z"),
      clientApp(),
    );

    const resultat = await cloturerIntervention(
      SESSION_BUREAU,
      { intervention_id: id, temps_valide_min: 60 },
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
  });
});

describe("SUSPENDRE / REPRENDRE — même périmètre scopé que « clôturer »", () => {
  it("un technicien REFUSÉ sur la suspension d'une intervention d'un collègue", async () => {
    const id = await jetable(COLLEGUE);
    const avant = await etat(id);

    const resultat = await suspendreIntervention(
      SESSION_TECH,
      {
        intervention_id: id,
        motif: "Client absent",
        piece_attendue_ref: null,
        date_dispo_prevue: null,
      },
      clientApp(),
    );
    expect(resultat).toEqual({
      accepte: false,
      cle: "intervention.refus.inconnue",
    });
    expect(await etat(id)).toEqual(avant);
  });

  it("le technicien suspend puis reprend SA PROPRE intervention affectée", async () => {
    const id = await jetable(TECHNICIEN);
    const suspension = await suspendreIntervention(
      SESSION_TECH,
      {
        intervention_id: id,
        motif: "Client absent",
        piece_attendue_ref: null,
        date_dispo_prevue: null,
      },
      clientApp(),
    );
    expect(suspension.accepte).toBe(true);
    expect((await etat(id)).statut).toBe("suspendue");

    const reprise = await reprendreIntervention(
      SESSION_TECH,
      { intervention_id: id },
      clientApp(),
    );
    expect(reprise.accepte).toBe(true);
    expect((await etat(id)).statut).not.toBe("suspendue");
  });

  it("un technicien REFUSÉ sur la reprise d'une suspension d'un collègue — et rien ne change", async () => {
    const id = await jetable(COLLEGUE, "suspendue");
    const avant = await etat(id);

    const resultat = await reprendreIntervention(
      SESSION_TECH,
      { intervention_id: id },
      clientApp(),
    );
    expect(resultat).toEqual({
      accepte: false,
      cle: "intervention.refus.inconnue",
    });
    expect(await etat(id)).toEqual(avant);
  });

  it("le bureau suspend et reprend N'IMPORTE QUELLE intervention", async () => {
    const id = await jetable(COLLEGUE);
    const suspension = await suspendreIntervention(
      SESSION_BUREAU,
      {
        intervention_id: id,
        motif: "Attente pièce",
        piece_attendue_ref: null,
        date_dispo_prevue: null,
      },
      clientApp(),
    );
    expect(suspension.accepte).toBe(true);

    const reprise = await reprendreIntervention(
      SESSION_BUREAU,
      { intervention_id: id },
      clientApp(),
    );
    expect(reprise.accepte).toBe(true);
  });
});

describe("ENREGISTRER UNE VGP — restreint aux machines des interventions NON ANNULÉES du technicien", () => {
  // MACHINE_A2 — et JAMAIS `MACHINE_A1` — parce que le harnais d'isolation
  // (`tests/isolation/setup/global.ts`) rattache DÉJÀ `MACHINE_A1` à
  // `INTERVENTION_A1`, elle-même affectée en dur à `TECHNICIEN` (R5-01, pour
  // que « mes interventions » ait une population). Mesurer le périmètre sur
  // `MACHINE_A1` aurait donc TOUJOURS réussi, par la fixture, jamais par ce
  // que ce fichier pose — un vert qui ne prouve rien. `MACHINE_A2` n'a aucun
  // rattachement de fixture : son périmètre ne vient que d'ici.
  async function enregistrer(
    machineId: string,
    contexte: typeof SESSION_TECH | typeof SESSION_BUREAU = SESSION_TECH,
  ) {
    const fiche = await enregistrerVerification(
      contexte,
      schemaVerificationVgp.parse({
        machine_id: machineId,
        date_verification: new Date("2026-09-14T00:00:00.000Z"),
        organisme: "APAVE",
        origine: "rapport_organisme",
      }),
      clientApp(),
    );
    verificationsPosees.push(fiche.id);
    return fiche;
  }

  it("le technicien enregistre sur une machine d'UNE DE SES interventions non annulées", async () => {
    const id = await jetable(TECHNICIEN);
    await relier(id, MACHINE_A2);
    const fiche = await enregistrer(MACHINE_A2);
    expect(fiche.organisme).toBe("APAVE");
  });

  it("le technicien REFUSÉ sur une machine hors de son périmètre — et rien n'est écrit", async () => {
    const id = await jetable(COLLEGUE);
    await relier(id, MACHINE_A2);

    await expect(enregistrer(MACHINE_A2)).rejects.toThrow();

    const restantes = await clientOwner().$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "vgp_verification" WHERE "machine_id" = '${MACHINE_A2}'
         AND "date_verification" = DATE '2026-09-14'`,
    );
    expect(restantes).toHaveLength(0);
  });

  it("une intervention ANNULÉE ne rouvre pas le périmètre du technicien", async () => {
    const id = await jetable(TECHNICIEN);
    await relier(id, MACHINE_A2);
    await clientOwner().$executeRawUnsafe(
      `UPDATE "intervention" SET "statut" = 'annulee',
         "motif_annulation" = 'épreuve', "annulee_le" = now()
       WHERE "id" = '${id}'`,
    );

    await expect(enregistrer(MACHINE_A2)).rejects.toThrow();
  });

  it("le bureau enregistre sur N'IMPORTE QUELLE machine, sans lien d'intervention", async () => {
    const fiche = await enregistrer(MACHINE_A2, SESSION_BUREAU);
    expect(fiche.organisme).toBe("APAVE");
  });
});

import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { instantAMinutes, lireCleJour } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";
import { deplacerIntervention, jugerPose } from "@/lib/interventions/depot";
import {
  schemaDeplacement,
  type Deplacement,
} from "@/lib/interventions/saisie";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  FUSEAU_SOCIETE_A,
  SITE_A1_S1,
  SOCIETE_A,
  TERRITOIRE_A,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_PAR_ROLE,
  feriesFixture,
} from "./setup/fixtures";

/**
 * PG-B1-VERDICT-LECTURE — LE VERDICT DE LECTURE ÉGALE L'ISSUE DE L'ÉCRITURE.
 *
 * `jugerPose` (`lib/interventions/depot.ts`) est désormais la SEULE fonction
 * que `deplacerIntervention` (l'écriture) ET la route `verdict-pose` (la
 * lecture, `app/api/interventions/[id]/verdict-pose/route.ts`) appellent pour
 * juger une pose. Ce fichier ne mesure donc pas une règle métier — chacune a
 * déjà son scénario ailleurs (`pose-habilitation.test.ts`, `absence.test.ts`,
 * `intervention.test.ts`) — il mesure que **les deux chemins restent le même
 * chemin** : pour chaque cas, le verdict rendu par `jugerPose` seule (aucune
 * écriture) est confronté à ce que `deplacerIntervention` fait RÉELLEMENT sur
 * la même ligne, avec la même saisie. *Deux lectures d'un même critère
 * divergent en silence dès que l'un des deux chemins change* (§9, 01/09) — et
 * c'est exactement le risque qu'une extraction fait courir si un appelant
 * cesse d'appeler l'autre.
 *
 * ## LE CAS « PLANIFIÉE SANS DURÉE » N'A PAS DE JUMEAU EN ÉCRITURE, ET C'EST
 * ATTENDU
 *
 * `intervention_planifiee_a_sa_duree` (PG-A4, migration du 23/09/2026) est
 * `NOT VALID` : elle ne juge PAS les cinq lignes déjà `planifiee` sans durée
 * qui existaient en production à sa création, mais elle REFUSE toute
 * nouvelle ligne qui entrerait dans cet état — y compris dans cette base de
 * test. *Il est donc IMPOSSIBLE de fabriquer, par un INSERT ou un UPDATE
 * légitime, la ligne que `peutEcrireSansDuree` existe pour expliquer avant
 * que la base ne la refuse par `23514`* — la garde TypeScript n'a jamais
 * d'autre rôle que d'annoncer, pour les lignes grand-père, ce que la
 * contrainte va de toute façon faire. Ce cas est donc éprouvé par un appel
 * direct à `jugerPose`, avec une ligne SYNTHÉTIQUE (jamais écrite) — la seule
 * façon de l'atteindre sans écrire une donnée que PostgreSQL refuserait.
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

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien];

/** UN LUNDI, dans la plage 08:00–12:00 du calendrier de l'agence A. */
const JOUR_LUNDI = lireCleJour("2026-09-14");
const LUNDI = new Date("2026-09-14T00:00:00.000Z");
const DEBUT_MINUTES = 9 * 60;
const DUREE_MIN = 60;

/**
 * UN FÉRIÉ QUE L'AGENCE A CHÔME — le second de son territoire sur l'horizon
 * (`feriesFixture`), à la différence de `FERIE_TRAVAILLE_A` : lui seul porte
 * l'écart local qui le fait travailler (voir `tests/isolation/setup/global.ts`).
 * `premierLundi` garantit que c'est un lundi, donc un jour normalement ouvert
 * — ce qui isole la question posée : c'est le FÉRIÉ qui ferme, pas la semaine.
 */
const FERIE_CHOME = feriesFixture(TERRITOIRE_A)[1]!.date;
const DATE_FERIE_CHOME = new Date(`${FERIE_CHOME}T00:00:00.000Z`);

const interventionsPosees: string[] = [];
const absencesPosees: string[] = [];
let habilitationId = "";
let exigenceId = "";

/** Une intervention `PGB1-`, jetable, prête à être jugée puis déplacée. */
async function creerIntervention(dureeEstimee: number | null): Promise<string> {
  const id = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "type", "statut", "duree_estimee_min", "description",
       "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
             'a_planifier', $6, 'PGB1-scenario', now())`,
    id,
    SOCIETE_A,
    CLIENT_A1,
    SITE_A1_S1,
    AGENCE_A,
    dureeEstimee,
  );
  interventionsPosees.push(id);
  return id;
}

/** Une voisine déjà POSÉE sur le technicien, pour fabriquer un chevauchement. */
async function creerVoisinePosee(
  debutMinutes: number,
  dureeMin: number,
): Promise<string> {
  const id = uuidv7();
  const debut = instantAMinutes(JOUR_LUNDI, debutMinutes, FUSEAU_SOCIETE_A);
  const fin = new Date(debut.getTime() + dureeMin * 60_000);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "type", "statut", "duree_estimee_min", "date_planifiee",
       "creneau_debut", "creneau_fin", "technicien_id", "description",
       "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
             'planifiee', $6, $7, $8, $9, $10::uuid, 'PGB1-voisine', now())`,
    id,
    SOCIETE_A,
    CLIENT_A1,
    SITE_A1_S1,
    AGENCE_A,
    dureeMin,
    LUNDI,
    debut,
    fin,
    TECHNICIEN,
  );
  interventionsPosees.push(id);
  return id;
}

async function creerAbsence(du: Date, au: Date): Promise<void> {
  const id = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "absence" ("id", "societe_id", "utilisateur_id", "du", "au", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::date, $5::date, now())`,
    id,
    SOCIETE_A,
    TECHNICIEN,
    du,
    au,
  );
  absencesPosees.push(id);
}

async function poserExigenceBloquante(): Promise<void> {
  habilitationId = uuidv7();
  exigenceId = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "habilitation" ("id", "societe_id", "code", "libelle")
     VALUES ($1::uuid, $2::uuid, $3, $4)`,
    habilitationId,
    SOCIETE_A,
    `PGB1-${habilitationId.slice(-6)}`,
    "PGB1 — habilitation bloquante",
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "site_habilitation_requise"
       ("id", "societe_id", "site_id", "habilitation_id", "bloquant")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, true)`,
    exigenceId,
    SOCIETE_A,
    SITE_A1_S1,
    habilitationId,
  );
}

afterEach(async () => {
  if (habilitationId !== "") {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "site_habilitation_requise" WHERE "id" = $1::uuid`,
      exigenceId,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "habilitation" WHERE "id" = $1::uuid`,
      habilitationId,
    );
    habilitationId = "";
    exigenceId = "";
  }
  for (const id of absencesPosees.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "absence" WHERE "id" = $1::uuid`,
      id,
    );
  }
  for (const id of interventionsPosees.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
      id,
    );
  }
});

/** Le verdict de LECTURE — `jugerPose` seule, sous le contexte cloisonné. */
async function jugerViaLecture(saisie: Deplacement) {
  return avecContexteApplicatif(
    SESSION,
    async (tx) => {
      const ligne = await tx.intervention.findFirst({
        where: { id: saisie.intervention_id },
        select: {
          id: true,
          statut: true,
          agence_id: true,
          site_id: true,
          duree_estimee_min: true,
        },
      });
      if (ligne === null) {
        throw new Error("ligne introuvable — le scénario est mal posé");
      }
      return jugerPose(tx, SESSION, ligne, saisie);
    },
    clientApp(),
  );
}

/**
 * Confronte le verdict de LECTURE à l'issue de l'ÉCRITURE réelle, sur la
 * MÊME ligne et la MÊME saisie — c'est tout l'objet de ce fichier.
 */
async function comparer(saisie: Deplacement) {
  const jugement = await jugerViaLecture(saisie);
  const ecriture = await deplacerIntervention(SESSION, saisie, clientApp());

  if (!ecriture.accepte) {
    expect(jugement.verdict).toEqual({ refuse: true, cle: ecriture.cle });
  } else {
    expect(jugement.verdict).toEqual({ refuse: false });
    expect(jugement.avertissements).toEqual(ecriture.avertissements);
  }
  return { jugement, ecriture };
}

function deplacement(
  interventionId: string,
  valeurs: Partial<Omit<Deplacement, "intervention_id">> = {},
): Deplacement {
  return schemaDeplacement.parse({
    intervention_id: interventionId,
    date_planifiee: LUNDI,
    debut_minutes: DEBUT_MINUTES,
    duree_min: DUREE_MIN,
    technicien_id: TECHNICIEN,
    ...valeurs,
  });
}

describe("PG-B1 — le verdict de lecture égale l'issue de l'écriture", () => {
  it("ACCEPTÉE — les quatre valeurs, un jour ouvert, personne en face", async () => {
    const id = await creerIntervention(null);
    const { ecriture } = await comparer(deplacement(id));
    expect(ecriture.accepte).toBe(true);
  });

  it("FÉRIÉ CHÔMÉ — le jour visé n'ouvre pas", async () => {
    const id = await creerIntervention(null);
    const { ecriture } = await comparer(
      deplacement(id, { date_planifiee: DATE_FERIE_CHOME }),
    );
    expect(ecriture).toEqual({
      accepte: false,
      cle: "intervention.refus.jour_ferme",
    });
  });

  it("HORS HEURES — le jour ouvre, l'heure demandée est en dehors de la plage", async () => {
    const id = await creerIntervention(null);
    // La plage de l'agence A est 08:00–12:00 (`PLAGE_A`) : 13:00 tombe après.
    const { ecriture } = await comparer(
      deplacement(id, { debut_minutes: 13 * 60 }),
    );
    expect(ecriture).toEqual({
      accepte: false,
      cle: "intervention.refus.hors_ouverture",
    });
  });

  it("ABSENCE — une absence validée couvre le jour visé", async () => {
    const id = await creerIntervention(null);
    await creerAbsence(LUNDI, LUNDI);
    const { ecriture } = await comparer(deplacement(id));
    expect(ecriture).toEqual({
      accepte: false,
      cle: "intervention.refus.absence",
    });
  });

  it("CHEVAUCHEMENT — le technicien tient déjà ce créneau", async () => {
    const voisine = await creerVoisinePosee(DEBUT_MINUTES, DUREE_MIN);
    const id = await creerIntervention(null);
    const { ecriture } = await comparer(deplacement(id));
    expect(ecriture).toEqual({
      accepte: false,
      cle: "intervention.refus.chevauchement",
    });
    // Le témoin n'est pas comptée deux fois : elle reste seule en face.
    expect(voisine).not.toBe(id);
  });

  it("HABILITATION BLOQUANTE — le site l'exige, le technicien ne l'a pas", async () => {
    await poserExigenceBloquante();
    const id = await creerIntervention(null);
    const { ecriture } = await comparer(deplacement(id));
    expect(ecriture).toEqual({
      accepte: false,
      cle: "intervention.refus.habilitation",
    });
  });

  it("PLANIFIÉE SANS DURÉE — jugée sur une ligne synthétique, jamais écrite (voir l'entête)", async () => {
    // Cette ligne n'est JAMAIS insérée : `intervention_planifiee_a_sa_duree`
    // (NOT VALID depuis PG-A4) refuse toute NOUVELLE ligne qui entrerait dans
    // cet état, et il n'existe donc aucune façon légitime de la fabriquer ici
    // pour la confronter à une écriture réelle. `jugerPose` ne lit ni n'écrit
    // la table `intervention` pour la ligne qu'on lui passe — elle n'est
    // qu'un objet TypeScript — donc rien n'est violé en le lui soumettant.
    const ligneSynthetique = {
      id: uuidv7(),
      statut: "planifiee",
      agence_id: AGENCE_A,
      site_id: SITE_A1_S1,
      duree_estimee_min: null,
    };
    const saisie = schemaDeplacement.parse({
      intervention_id: ligneSynthetique.id,
      // Seul le TECHNICIEN change : ni heure ni durée, ce que « Déplacer »
      // envoie quand on touche uniquement l'affectation d'une ligne déjà
      // planifiée (voir `demandeDeDeplacement`, `depot.ts`).
      date_planifiee: LUNDI,
      debut_minutes: null,
      duree_min: null,
      technicien_id: TECHNICIEN,
    });
    const jugement = await avecContexteApplicatif(
      SESSION,
      (tx) => jugerPose(tx, SESSION, ligneSynthetique, saisie),
      clientApp(),
    );
    expect(jugement.verdict).toEqual({
      refuse: true,
      cle: "intervention.refus.planifiee_sans_duree",
    });
  });
});

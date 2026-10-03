import { afterAll, afterEach, describe, expect, it } from "vitest";

import { lireLesAbsences } from "@/lib/absences/ecran";
import { Role } from "@/lib/auth/roles";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";
import { type PerimetrePlanning } from "@/lib/interventions/perimetre-technicien";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { AGENCE_A, SOCIETE_A, UTILISATEUR_PAR_ROLE } from "./setup/fixtures";

/**
 * LES ABSENCES DU TECHNICIEN RESTREINT (QT-2, D152, choix D), ÉPROUVÉES SUR
 * LA VRAIE TABLE.
 *
 * `lireLesAbsences` lit sous `avecContexteApplicatif` (la forme « interne »
 * de `absence`, D94) ; le périmètre par personne qui s'y ajoute depuis QT-2
 * est une clause DE PLUS, écrite à part de ce cloisonnement — ce fichier
 * l'éprouve pour elle-même, au-delà de `tests/isolation/absence.test.ts` qui
 * éprouve déjà la forme « interne ».
 *
 * Les deux lignes sont posées DIRECTEMENT en SQL plutôt que par
 * `declarerAbsence` : cette dernière déplanifie les interventions de la
 * période (R3-14), un effet de bord que ce fichier n'a aucune raison de
 * déclencher pour juger d'une simple LECTURE.
 */

afterAll(fermerClients);

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien] as string;
/** Une personne de la société A, posée dans `utilisateur_societe` par le
 * harnais — sa propre absence doit rester invisible au technicien restreint. */
const COLLEGUE = UTILISATEUR_PAR_ROLE[Role.adv] as string;

const SESSION_TECH = {
  utilisateurId: TECHNICIEN,
  societeId: SOCIETE_A,
  role: Role.technicien,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const PERIMETRE_RESTREINT: PerimetrePlanning = {
  acces: "restreint",
  technicienId: TECHNICIEN,
};
const PERIMETRE_COMPLET: PerimetrePlanning = { acces: "complet" };

const FENETRE = {
  du: new Date("2031-01-01T00:00:00.000Z"),
  au: new Date("2031-01-31T00:00:00.000Z"),
};

const jetables: string[] = [];

async function absenceJetable(
  utilisateurId: string,
  du: string,
  au: string,
): Promise<string> {
  const id = uuidv7();
  jetables.push(id);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "absence" ("id","societe_id","utilisateur_id","du","au","modifie_le")
     VALUES ('${id}', '${SOCIETE_A}', '${utilisateurId}', DATE '${du}', DATE '${au}', now())`,
  );
  return id;
}

afterEach(async () => {
  for (const id of jetables.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "absence" WHERE "id" = '${id}'`,
    );
  }
});

/**
 * `declarables` lit la table `technicien` (L'ÉCRAN A BESOIN DE LA SAVOIR
 * ACTIVE) — le harnais global n'en pose AUCUNE ligne (mesuré sur
 * `tests/isolation/setup/global.ts`) ; même geste que l'alerte de rupture de
 * service dans `tests/isolation/absence.test.ts`, posée et retirée ici.
 */
const techniciensPoses: string[] = [];

async function poserUnTechnicien(utilisateurId: string): Promise<void> {
  const id = uuidv7();
  const pose = await clientOwner().$executeRawUnsafe(
    `INSERT INTO "technicien" ("id","societe_id","utilisateur_id","agence_id","modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, now())
     ON CONFLICT DO NOTHING`,
    id,
    SOCIETE_A,
    utilisateurId,
    AGENCE_A,
  );
  if (pose > 0) {
    techniciensPoses.push(id);
  }
}

afterEach(async () => {
  for (const id of techniciensPoses.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "technicien" WHERE "id" = $1::uuid`,
      id,
    );
  }
});

describe("un technicien restreint ne lit que SA PROPRE absence", () => {
  it("l'absence d'un collègue n'apparaît pas dans `absences`, la sienne si", async () => {
    const mienne = await absenceJetable(TECHNICIEN, "2031-01-05", "2031-01-06");
    const duCollegue = await absenceJetable(
      COLLEGUE,
      "2031-01-05",
      "2031-01-06",
    );

    const vue = await avecContexteApplicatif(
      SESSION_TECH,
      (tx) => lireLesAbsences(tx, FENETRE, PERIMETRE_RESTREINT),
      clientApp(),
    );
    const ids = vue.absences.map((a) => a.id);
    expect(ids).toContain(mienne);
    expect(ids).not.toContain(duCollegue);
  });

  it("`declarables` ne porte QUE le technicien lui-même", async () => {
    await poserUnTechnicien(TECHNICIEN);
    await poserUnTechnicien(COLLEGUE);
    const vue = await avecContexteApplicatif(
      SESSION_TECH,
      (tx) => lireLesAbsences(tx, FENETRE, PERIMETRE_RESTREINT),
      clientApp(),
    );
    expect(vue.declarables.map((d) => d.utilisateurId)).toEqual([TECHNICIEN]);
  });

  it("un accès COMPLET voit les deux absences — le périmètre ne le restreint pas", async () => {
    const mienne = await absenceJetable(TECHNICIEN, "2031-01-05", "2031-01-06");
    const duCollegue = await absenceJetable(
      COLLEGUE,
      "2031-01-05",
      "2031-01-06",
    );

    const vue = await avecContexteApplicatif(
      SESSION_TECH,
      (tx) => lireLesAbsences(tx, FENETRE, PERIMETRE_COMPLET),
      clientApp(),
    );
    const ids = vue.absences.map((a) => a.id);
    expect(ids).toContain(mienne);
    expect(ids).toContain(duCollegue);
  });
});

import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { apercuAbsence } from "@/lib/absences/depot";
import { uuidv7 } from "@/lib/db/uuid";
import { deplacerIntervention } from "@/lib/interventions/depot";
import { schemaDeplacement } from "@/lib/interventions/saisie";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_INTERNE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * L'APERÇU D'UN BLOCAGE — CLOISONNEMENT (SAV-12, 59-ABSENCES-2).
 *
 * ## Ce que ce fichier mesure, et que rien d'autre ne mesurerait
 *
 * `apercuAbsence` lit par le MÊME chemin cloisonné que `declarerAbsence` —
 * `interventionsPoseesSurLaPeriode`, dans `lib/absences/depot.ts` — et ce
 * critère est déjà éprouvé sans base dans `tests/unit/absences/` ainsi que sous
 * le rôle applicatif, pour `declarerAbsence`, par `tests/isolation/absence.test.ts`.
 * Ce que CE fichier éprouve est ce qu'une lecture SANS écriture ne doit jamais
 * faire : traverser une société. Un aperçu qui verrait l'intervention d'une
 * autre société annoncerait un impact qu'une pose réelle ne produirait jamais —
 * la politique refusant l'écriture au moment de `declarerAbsence` — et
 * l'écran mentirait avant même d'avoir posé quoi que ce soit.
 */

afterAll(fermerClients);

const SESSION_A = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const SESSION_B = {
  utilisateurId: UTILISATEUR_INTERNE_B,
  societeId: SOCIETE_B,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien];

/** Un lundi de la plage 08:00–12:00 du calendrier de l'agence A. */
const LUNDI = new Date("2026-09-14T00:00:00.000Z");
const PERIODE = {
  du: new Date("2026-09-14T00:00:00.000Z"),
  au: new Date("2026-09-18T00:00:00.000Z"),
};

let interventionId = "";

function deplacement(jour: Date) {
  return schemaDeplacement.parse({
    intervention_id: interventionId,
    date_planifiee: jour,
    debut_minutes: 9 * 60,
    duree_min: 60,
    technicien_id: TECHNICIEN,
  });
}

beforeEach(async () => {
  interventionId = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "type", "statut", "duree_estimee_min", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
             'planifiee', 60, now())`,
    interventionId,
    SOCIETE_A,
    CLIENT_A1,
    SITE_A1_S1,
    AGENCE_A,
  );
});

afterEach(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
    interventionId,
  );
});

describe("apercuAbsence, sous le rôle applicatif", () => {
  it("voit l'intervention posée, SOUS LA SOCIÉTÉ QUI L'A POSÉE", async () => {
    const pose = await deplacerIntervention(
      SESSION_A,
      deplacement(LUNDI),
      clientApp(),
    );
    expect(pose.accepte).toBe(true);

    const touchees = await apercuAbsence(
      SESSION_A,
      { utilisateur_id: TECHNICIEN, ...PERIODE },
      clientApp(),
    );
    expect(touchees).toEqual([interventionId]);
  });

  it("NE LA VOIT PAS SOUS UNE AUTRE SOCIÉTÉ — le critère ne traverse rien", async () => {
    const pose = await deplacerIntervention(
      SESSION_A,
      deplacement(LUNDI),
      clientApp(),
    );
    expect(pose.accepte).toBe(true);

    // MÊME technicien, MÊME période — seule la société de la session change.
    // *La politique décide, une comparaison écrite au-dessus serait une
    // seconde lecture d'un même critère* (§9, 01/09) : ce scénario mesure la
    // politique, pas une hypothèse sur elle.
    const touchees = await apercuAbsence(
      SESSION_B,
      { utilisateur_id: TECHNICIEN, ...PERIODE },
      clientApp(),
    );
    expect(touchees).toEqual([]);
  });

  it("N'ÉCRIT RIEN — l'intervention reste posée après l'aperçu", async () => {
    const pose = await deplacerIntervention(
      SESSION_A,
      deplacement(LUNDI),
      clientApp(),
    );
    expect(pose.accepte).toBe(true);

    await apercuAbsence(
      SESSION_A,
      { utilisateur_id: TECHNICIEN, ...PERIODE },
      clientApp(),
    );

    const [ligne] = await clientOwner().$queryRawUnsafe<
      Array<{ date_planifiee: Date | null; technicien_id: string | null }>
    >(
      `SELECT "date_planifiee", "technicien_id" FROM "intervention" WHERE "id" = $1::uuid`,
      interventionId,
    );
    expect(ligne.date_planifiee).not.toBeNull();
    expect(ligne.technicien_id).toBe(TECHNICIEN);

    const absences = await clientOwner().$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "absence" WHERE "utilisateur_id" = $1::uuid`,
      TECHNICIEN,
    );
    expect(absences).toHaveLength(0);
  });
});

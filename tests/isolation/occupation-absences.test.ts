import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { deciderAbsence, declarerAbsence } from "@/lib/absences/depot";
import { schemaCreationAbsence } from "@/lib/absences/saisie";
import { uuidv7 } from "@/lib/db/uuid";
import { occupationsDuPlanning } from "@/lib/interventions/occupation";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * LE TAUX D'OCCUPATION, ABSENCES DÉDUITES (L3-17, D76, RG-PLA-06).
 *
 * ## Le défaut, mesuré avant d'écrire une ligne
 *
 * Le dénominateur venait du seul calendrier. **Un technicien absent toute la
 * semaine gardait donc une semaine ouvrable entière**, et son taux
 * d'occupation tombait près de zéro.
 *
 * > *Rien ne distinguait « il était absent » de « il n'a rien fait ».*
 *
 * C'est la troisième fois que ce module rencontre cette famille : D76 avait
 * déjà séparé « pas de calendrier » de « n'a rien fait » — l'un rend `null`,
 * l'autre `0 %` —, et voici la troisième cause, qui se corrige encore
 * autrement. *Un registre à moitié rempli ressemble à un registre complet*
 * (D88).
 *
 * ## Ce que ce fichier mesure et que l'unitaire ne mesure pas
 *
 * L'unitaire éprouve la FUSION des périodes sur des tableaux. Ici on mesure que
 * le dénominateur BOUGE réellement, à travers la lecture cloisonnée, le
 * calendrier de l'agence et la règle — c'est-à-dire à travers le chemin que
 * l'écran emprunte.
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

/** La semaine du lundi 14 septembre 2026, bornes larges. */
const DU = new Date("2026-09-14T00:00:00.000Z");
const AU = new Date("2026-09-21T00:00:00.000Z");

let interventionId = "";
const absencesPosees: string[] = [];

async function declarerEtDecider(
  du: string,
  au: string,
  decision: "validee" | "refusee" | null,
): Promise<void> {
  const saisie = schemaCreationAbsence.parse({
    utilisateur_id: TECHNICIEN,
    du: new Date(`${du}T00:00:00.000Z`),
    au: new Date(`${au}T00:00:00.000Z`),
    motif: "conge",
    precision: null,
  });
  const posee = await declarerAbsence(SESSION, saisie, clientApp());
  if (!posee.accepte) throw new Error(`déclaration refusée : ${posee.cle}`);
  absencesPosees.push(posee.fiche.id);
  if (decision !== null) {
    await deciderAbsence(
      SESSION,
      { absence_id: posee.fiche.id, decision },
      clientApp(),
    );
  }
}

/** Les minutes ouvrables du technicien sur la semaine, telles que l'écran les lit. */
async function ouvrables(): Promise<number> {
  const lignes = await occupationsDuPlanning(
    SESSION,
    [
      {
        technicien_id: TECHNICIEN,
        agence_id: AGENCE_A,
        statut: "planifiee",
        temps_reel_min: null,
        duree_estimee_min: 60,
      },
    ],
    DU,
    AU,
    clientApp(),
  );
  const ligne = lignes.find((l) => l.technicienId === TECHNICIEN);
  if (ligne === undefined) throw new Error("aucune ligne pour le technicien");
  return ligne.occupation.minutesOuvrables;
}

beforeEach(async () => {
  interventionId = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "technicien_id", "type", "statut", "date_planifiee",
       "duree_estimee_min", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
             'curatif', 'planifiee', DATE '2026-09-14', 60, now())`,
    interventionId,
    SOCIETE_A,
    CLIENT_A1,
    SITE_A1_S1,
    AGENCE_A,
    TECHNICIEN,
  );
});

afterEach(async () => {
  for (const id of absencesPosees.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "absence" WHERE "id" = $1::uuid`,
      id,
    );
  }
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
    interventionId,
  );
});

describe("le dénominateur du taux d'occupation", () => {
  it("TÉMOIN — sans absence, il est NON NUL", async () => {
    // *Sans lui, tout ce qui suit serait vert sur un dénominateur déjà nul*,
    // c'est-à-dire sur rien : une soustraction de zéro à zéro rend zéro.
    expect(await ouvrables()).toBeGreaterThan(0);
  });

  it("une absence VALIDÉE le fait DIMINUER", async () => {
    const avant = await ouvrables();
    await declarerEtDecider("2026-09-14", "2026-09-14", "validee");
    const apres = await ouvrables();
    expect(apres).toBeLessThan(avant);
    // Et il ne tombe pas à zéro : un seul jour d'absence sur la semaine.
    expect(apres).toBeGreaterThan(0);
  });

  it("une absence DEMANDÉE ne change RIEN — le vert pour sa propre raison", async () => {
    // Son voisin lui ressemble à un mot près. *Retrancher une demande en
    // attente ferait baisser un dénominateur qu'un refus rétablirait le
    // lendemain, sans que personne comprenne pourquoi le taux a bougé.*
    const avant = await ouvrables();
    await declarerEtDecider("2026-09-14", "2026-09-14", null);
    expect(await ouvrables()).toBe(avant);
  });

  it("une absence REFUSÉE ne change rien non plus", async () => {
    const avant = await ouvrables();
    await declarerEtDecider("2026-09-14", "2026-09-14", "refusee");
    expect(await ouvrables()).toBe(avant);
  });

  it("DEUX ABSENCES QUI SE RECOUVRENT ne retranchent pas deux fois", async () => {
    // **Le scénario qui empêche un taux supérieur à 100 %.** Un congé prolongé
    // par un arrêt est le cas ordinaire ; retranchées séparément, les journées
    // communes seraient comptées deux fois et le dénominateur pourrait passer
    // sous zéro.
    await declarerEtDecider("2026-09-14", "2026-09-16", "validee");
    await declarerEtDecider("2026-09-15", "2026-09-18", "validee");
    const apres = await ouvrables();
    expect(apres).toBeGreaterThanOrEqual(0);

    // Et il vaut exactement ce que vaut LA RÉUNION des deux : le même
    // dénominateur qu'une absence unique du 14 au 18.
    for (const id of absencesPosees.splice(0)) {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "absence" WHERE "id" = $1::uuid`,
        id,
      );
    }
    await declarerEtDecider("2026-09-14", "2026-09-18", "validee");
    expect(await ouvrables()).toBe(apres);
  });

  it("une absence qui couvre TOUTE la semaine rend le dénominateur NUL", async () => {
    // *Et un dénominateur nul se lit `null`, jamais « 0 % »* — c'est la règle
    // que D76 a posée pour « pas de calendrier », et elle sert ici la troisième
    // cause : « il était absent ».
    await declarerEtDecider("2026-09-07", "2026-09-28", "validee");
    expect(await ouvrables()).toBe(0);
  });
});

import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import {
  arreterLeCompteur,
  demarrerLeCompteur,
} from "@/lib/interventions/depot-compteur";
import {
  enregistrerSignature,
  terminerIntervention,
} from "@/lib/interventions/depot-rapport-terrain";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  INTERVENTION_A1,
  SOCIETE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * 9F4H4B-OUVERTURE-A-FROID, addendum n°1 du pilote — `depuisFile` distingue
 * un renvoi depuis la file (hors réseau) du tout premier essai EN LIGNE, qui
 * envoie la même paire `operation_id`/`instant_appareil` (9F4H2, pour le
 * rejeu lie-fi) SANS jamais avoir été hors réseau. Mesure faite sur
 * `c39b6332` (9F4H3AB) : un démarrer EN LIGNE marquait `saisi_hors_reseau`
 * vrai, et refusait un téléphone en avance de plus de 5 min — ce que ce
 * fichier éprouve corrigé.
 */

afterAll(fermerClients);

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien];

const SESSION_TECH = {
  utilisateurId: TECHNICIEN,
  societeId: SOCIETE_A,
  role: Role.technicien,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const jetables: string[] = [];

/** Une intervention jetable, clonée du décor de `INTERVENTION_A1`. */
async function jetable(technicienId: string): Promise<string> {
  const id = uuidv7();
  jetables.push(id);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id","societe_id","client_id","site_id","agence_id",
       "type","statut","date_planifiee","technicien_id","duree_estimee_min","modifie_le")
     SELECT '${id}', "societe_id", "client_id", "site_id", "agence_id",
            'curatif', 'planifiee', DATE '2026-09-14',
            '${technicienId}', 60, now()
       FROM "intervention" WHERE "id" = '${INTERVENTION_A1}'`,
  );
  return id;
}

async function segmentsDe(interventionId: string): Promise<
  Array<{
    id: string;
    debut: Date;
    fin: Date | null;
    saisi_hors_reseau: boolean;
  }>
> {
  return clientOwner().$queryRawUnsafe(
    `SELECT "id", "debut", "fin", "saisi_hors_reseau"
       FROM "segment_travail" WHERE "intervention_id" = '${interventionId}'`,
  );
}

afterEach(async () => {
  for (const id of jetables.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = '${id}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention_signature" WHERE "intervention_id" = '${id}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = '${id}'`,
    );
  }
});

describe("depuisFile=false — le tout premier essai EN LIGNE n'est jamais hors réseau", () => {
  it("démarrer : une heure d'appareil 10 min dans le futur est ACCEPTÉE, saisi_hors_reseau faux, l'heure gardée est celle du SERVEUR", async () => {
    const id = await jetable(TECHNICIEN);
    const instantServeur = new Date("2026-09-14T08:00:00.000Z");
    const dansLeFutur = new Date("2026-09-14T08:10:00.000Z");

    const resultat = await demarrerLeCompteur(
      SESSION_TECH,
      id,
      instantServeur,
      clientApp(),
      {
        instantAppareil: dansLeFutur,
        operationId: uuidv7(),
        depuisFile: false,
      },
    );
    expect(resultat.accepte).toBe(true);

    const [segment] = await segmentsDe(id);
    expect(segment.saisi_hors_reseau).toBe(false);
    expect(segment.debut).toEqual(instantServeur);
  });

  it("arrêter : même heure future acceptée (pas de bornes), saisi_hors_reseau faux — mais `fin` reste l'heure de l'appareil, car ARRÊTER n'a AUCUN autre mécanisme de rejeu", async () => {
    const id = await jetable(TECHNICIEN);
    const h8 = new Date("2026-09-14T08:00:00.000Z");
    await demarrerLeCompteur(SESSION_TECH, id, h8, clientApp(), {
      instantAppareil: h8,
      operationId: uuidv7(),
      depuisFile: false,
    });

    const instantServeur = new Date("2026-09-14T08:30:00.000Z");
    const dansLeFutur = new Date("2026-09-14T08:40:00.000Z");
    const resultat = await arreterLeCompteur(
      SESSION_TECH,
      instantServeur,
      clientApp(),
      { instantAppareil: dansLeFutur, depuisFile: false },
    );
    expect(resultat.accepte).toBe(true);

    const [segment] = await segmentsDe(id);
    expect(segment.saisi_hors_reseau).toBe(false);
    // Contrairement à démarrer/terminer (rejeu par `id`/`terminer_operation_id`,
    // voir leurs propres épreuves ci-dessus et ci-dessous), arrêter ne se
    // reconnaît qu'à L'INSTANT exact déjà fermé (`dejaFerme`). Faire varier
    // `fin` selon `depuisFile` romprait ce rejeu pour un essai en ligne dont
    // la réponse se perd — MESURÉ sur `tests/e2e/offline/
    // 9f4h3a-file-sans-perte.spec.ts`, qui rejoue un arrêt EN LIGNE par une
    // requête brute, sans `depuis_file`.
    expect(segment.fin).toEqual(dansLeFutur);
  });

  it("arrêter : un rejeu EN LIGNE (depuisFile=false des deux côtés, même instant_appareil) retrouve le même segment fermé, sans en fermer un second", async () => {
    const id = await jetable(TECHNICIEN);
    const h8 = new Date("2026-09-14T08:00:00.000Z");
    await demarrerLeCompteur(SESSION_TECH, id, h8, clientApp(), {
      instantAppareil: h8,
      operationId: uuidv7(),
      depuisFile: false,
    });
    const instantArret = new Date("2026-09-14T08:05:00.000Z");

    const premier = await arreterLeCompteur(
      SESSION_TECH,
      new Date("2026-09-14T08:05:01.000Z"),
      clientApp(),
      { instantAppareil: instantArret, depuisFile: false },
    );
    expect(premier.accepte).toBe(true);

    const rejeu = await arreterLeCompteur(
      SESSION_TECH,
      new Date("2026-09-14T08:05:02.000Z"),
      clientApp(),
      { instantAppareil: instantArret, depuisFile: false },
    );
    expect(rejeu.accepte).toBe(true);

    const segments = await segmentsDe(id);
    expect(segments).toHaveLength(1);
    expect(segments[0].saisi_hors_reseau).toBe(false);
  });

  it("terminer : même heure future acceptée, saisi_hors_reseau faux sur le segment fermé", async () => {
    const id = await jetable(TECHNICIEN);
    const h8 = new Date("2026-09-14T08:00:00.000Z");
    await demarrerLeCompteur(SESSION_TECH, id, h8, clientApp());
    await enregistrerSignature(
      SESSION_TECH,
      id,
      {
        issue: "signee",
        image_base64: "data:image/png;base64,AAAA",
        signataire_nom: "Jean Dupont",
      },
      clientApp(),
    );

    const instantServeur = new Date("2026-09-14T08:45:00.000Z");
    const dansLeFutur = new Date("2026-09-14T08:55:00.000Z");
    const resultat = await terminerIntervention(
      SESSION_TECH,
      id,
      instantServeur,
      clientApp(),
      {
        instantAppareil: dansLeFutur,
        operationId: uuidv7(),
        depuisFile: false,
      },
    );
    expect(resultat.accepte).toBe(true);

    const [segment] = await segmentsDe(id);
    expect(segment.saisi_hors_reseau).toBe(false);
    expect(segment.fin).toEqual(instantServeur);
  });

  it("le rejeu par operation_id reste valable — deux démarrages avec le même id et depuisFile=false ne créent qu'un segment", async () => {
    const id = await jetable(TECHNICIEN);
    const instantServeur = new Date("2026-09-14T08:00:00.000Z");
    const OP = uuidv7();

    const premier = await demarrerLeCompteur(
      SESSION_TECH,
      id,
      instantServeur,
      clientApp(),
      { instantAppareil: instantServeur, operationId: OP, depuisFile: false },
    );
    expect(premier.accepte).toBe(true);

    const second = await demarrerLeCompteur(
      SESSION_TECH,
      id,
      instantServeur,
      clientApp(),
      { instantAppareil: instantServeur, operationId: OP, depuisFile: false },
    );
    expect(second.accepte).toBe(true);

    expect(await segmentsDe(id)).toHaveLength(1);
  });
});

describe("depuisFile omis — garde l'ancien contrat (hors réseau) des appelants directs", () => {
  it("démarrer sans depuisFile refuse toujours une heure future, comme avant 9F4H4B", async () => {
    const id = await jetable(TECHNICIEN);
    const instantServeur = new Date("2026-09-14T08:00:00.000Z");
    const dansLeFutur = new Date("2026-09-14T08:10:00.000Z");

    const resultat = await demarrerLeCompteur(
      SESSION_TECH,
      id,
      instantServeur,
      clientApp(),
      { instantAppareil: dansLeFutur, operationId: uuidv7() },
    );
    expect(resultat).toEqual({
      accepte: false,
      cle: "compteur.refus.instant_futur",
    });
  });
});

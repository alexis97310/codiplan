import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { absencesDeLaPeriode } from "@/lib/absences/depot";
import {
  piecesRemplacees,
  prestationsRealisees,
  derniereSignature,
} from "@/lib/interventions/depot-rapport-terrain";
import {
  pausesDeLIntervention,
  segmentsDeLIntervention,
} from "@/lib/interventions/depot";
import {
  datesDesMachines,
  donneesMaterielDesMachines,
  machinesDesSites,
} from "@/lib/machines/depot";

import {
  instrumenter,
  profondeurSequentielle,
} from "../performance/instrument";
import { clientApp, fermerClients } from "./setup/db";
import {
  INTERVENTION_A1,
  MACHINE_A1,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * 9ID-PERFORMANCES-MESURE-ET-CORRECTIFS — MESURE DE /interventions/[id].
 *
 * `PageIntervention` (`app/(back-office)/interventions/[id]/page.tsx`, audit
 * du 04/11/2026) enchaînait, entre autres, DEUX groupes de lectures
 * indépendantes en `await` isolés plutôt qu'en `Promise.all` : les DEUX
 * lectures d'absences (blocage à la date, disponibilité 90 jours), puis HUIT
 * lectures (machines du site, matériel de la fiche, dates des machines,
 * segments, pauses, prestations, signature, pièces remplacées). Ce scénario
 * mesure ces deux groupes — ceux que l'instrument peut atteindre : les trois
 * lectures de `lib/societes/identite.ts` et `lireSite` n'acceptent aucun
 * client injectable (elles passent toujours par le singleton `prisma` de
 * production) et ne sont donc pas instrumentées ici ; leur gain, réel mais
 * modeste (un à deux allers-retours), est documenté en passation sans
 * mesure chiffrée.
 */

afterAll(fermerClients);

const SESSION = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.adv] as string,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const anciennEnv = process.env.MESURE_PERFORMANCE_DELAI_MS;
afterAll(() => {
  if (anciennEnv === undefined) {
    delete process.env.MESURE_PERFORMANCE_DELAI_MS;
  } else {
    process.env.MESURE_PERFORMANCE_DELAI_MS = anciennEnv;
  }
});

const DATE_A = new Date("2026-09-15T00:00:00.000Z");
const DATE_B = new Date("2026-09-16T00:00:00.000Z");

/** L'ORDRE D'AVANT 9ID : dix lectures indépendantes, une après l'autre. */
async function mesurerOrdreAncien(client: ReturnType<typeof clientApp>) {
  await absencesDeLaPeriode(SESSION, DATE_A, DATE_A, client);
  await absencesDeLaPeriode(SESSION, DATE_A, DATE_B, client);
  await machinesDesSites(SESSION, [SITE_A1_S1], client);
  await donneesMaterielDesMachines(SESSION, [MACHINE_A1], client);
  await datesDesMachines(SESSION, [MACHINE_A1], client);
  await segmentsDeLIntervention(SESSION, INTERVENTION_A1, client);
  await pausesDeLIntervention(SESSION, INTERVENTION_A1, client);
  await prestationsRealisees(SESSION, INTERVENTION_A1, client);
  await derniereSignature(SESSION, INTERVENTION_A1, client);
  await piecesRemplacees(SESSION, INTERVENTION_A1, client);
}

/** L'ORDRE D'APRÈS 9ID : deux paliers, chacun en `Promise.all`. */
async function mesurerOrdreNouveau(client: ReturnType<typeof clientApp>) {
  await Promise.all([
    absencesDeLaPeriode(SESSION, DATE_A, DATE_A, client),
    absencesDeLaPeriode(SESSION, DATE_A, DATE_B, client),
  ]);
  await Promise.all([
    machinesDesSites(SESSION, [SITE_A1_S1], client),
    donneesMaterielDesMachines(SESSION, [MACHINE_A1], client),
    datesDesMachines(SESSION, [MACHINE_A1], client),
    segmentsDeLIntervention(SESSION, INTERVENTION_A1, client),
    pausesDeLIntervention(SESSION, INTERVENTION_A1, client),
    prestationsRealisees(SESSION, INTERVENTION_A1, client),
    derniereSignature(SESSION, INTERVENTION_A1, client),
    piecesRemplacees(SESSION, INTERVENTION_A1, client),
  ]);
}

describe("mesure de /interventions/[id] — les deux groupes instrumentables (9ID, points 2 et 3)", () => {
  it("le NOUVEAU (deux paliers) est bien moins profond que l'ANCIEN (dix allers-retours), sur la MÊME fiche", async () => {
    process.env.MESURE_PERFORMANCE_DELAI_MS = "50";

    const ancien = instrumenter(clientApp());
    const debutAncien = Date.now();
    await mesurerOrdreAncien(ancien.client);
    const dureeAncienne = Date.now() - debutAncien;
    const profondeurAncienne = profondeurSequentielle(dureeAncienne, 50);

    const nouveau = instrumenter(clientApp());
    const debutNouveau = Date.now();
    await mesurerOrdreNouveau(nouveau.client);
    const dureeNouvelle = Date.now() - debutNouveau;
    const profondeurNouvelle = profondeurSequentielle(dureeNouvelle, 50);

    // eslint-disable-next-line no-console -- la mesure EST le résultat attendu de ce scénario (9ID, point 2).
    console.log(
      `[9ID fiche] avant: ${ancien.compteur.transactions} transactions, ${ancien.compteur.requetes} requêtes, ${dureeAncienne}ms, profondeur≈${profondeurAncienne} — ` +
        `après: ${nouveau.compteur.transactions} transactions, ${nouveau.compteur.requetes} requêtes, ${dureeNouvelle}ms, profondeur≈${profondeurNouvelle}`,
    );

    expect(profondeurNouvelle).toBeLessThan(profondeurAncienne);
    // LE GARDE-FOU (point 4) : mesuré à 5 (contre 26 avant) — plafond posé à
    // 10 pour absorber le bruit de mesure sans masquer une régression qui
    // réintroduirait un `await` isolé entre deux lectures indépendantes.
    expect(profondeurNouvelle).toBeLessThanOrEqual(10);
  });
});

import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { schemaRechercheClient } from "@/lib/clients/saisie";
import {
  compterClients,
  comptesVueClients,
  libelleCodeExterneDeLaSociete,
  rechercherClients,
  resumeDesCartesClients,
  sitesParClient,
} from "@/lib/clients/depot";
import { lireBonIntervention } from "@/lib/interventions/bon";
import {
  compteurEnCours,
  mesureDeLIntervention,
} from "@/lib/interventions/depot-compteur";
import {
  compterInterventions,
  compterParVue,
  interventionsEnRetard,
  lireFicheIntervention,
  listerInterventions,
  listerPlanning,
} from "@/lib/interventions/depot";
import {
  derniereSignature,
  dernieresIssuesSignature,
  lireRapportTexte,
  piecesRemplacees,
  prestationsRealisees,
} from "@/lib/interventions/depot-rapport-terrain";
import { schemaRechercheInterventions } from "@/lib/interventions/saisie";
import {
  compterLeParc,
  compterPanneAvecInterventionOuverte,
  datesDesMachines,
  donneesMaterielDesMachines,
  libellesDesMachines,
  optionsDeFiltreDuParc,
  rechercherLeParc,
} from "@/lib/machines/depot";
import { schemaRechercheParc } from "@/lib/machines/saisie";
import { listerLesPrestations } from "@/lib/prestations/depot";
import { photosDeLIntervention } from "@/lib/documents/depot";

import {
  instrumenter,
  profondeurSequentielle,
} from "../performance/instrument";
import { clientApp, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  INTERVENTION_A1,
  SOCIETE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * 9ID-PERFORMANCES-MESURE-ET-CORRECTIFS — MESURE DES PAGES NON CORRIGÉES.
 *
 * Ces cinq pages étaient déjà, pour l'essentiel, construites en paliers
 * `Promise.all` (audit du 04/11/2026) — aucun des trois pires cas de ce lot.
 * Chaque scénario mesure la chaîne RÉELLE que la page appelle, avec
 * MESURE_PERFORMANCE_DELAI_MS, et fige un plafond de profondeur séquentielle
 * (point 4) sur l'état ACTUEL, inchangé par ce lot.
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

async function mesurer(
  travail: (client: ReturnType<typeof clientApp>) => Promise<unknown>,
): Promise<{ profondeur: number; transactions: number; requetes: number }> {
  process.env.MESURE_PERFORMANCE_DELAI_MS = "50";
  const { client, compteur } = instrumenter(clientApp());
  const debut = Date.now();
  await travail(client);
  const duree = Date.now() - debut;
  return {
    profondeur: profondeurSequentielle(duree, 50),
    transactions: compteur.transactions,
    requetes: compteur.requetes,
  };
}

describe("mesure des pages déjà construites en paliers (9ID, points 2 et 4)", () => {
  it("/interventions — liste (round 1 : 6 en parallèle, round 2 : 4 en parallèle)", async () => {
    const criteres = schemaRechercheInterventions.parse({});
    const resultat = await mesurer(async (client) => {
      const [lignes] = await Promise.all([
        listerInterventions(SESSION, criteres, client),
        compterInterventions(SESSION, criteres, client),
        compterParVue(SESSION, criteres, client),
      ]);
      await Promise.all([
        libellesDesMachines(
          SESSION,
          lignes.flatMap((l) => l.machines.map((m) => m.machine_id)),
          client,
        ),
        dernieresIssuesSignature(
          SESSION,
          lignes.map((l) => l.id),
          client,
        ),
      ]);
    });
    // eslint-disable-next-line no-console -- mesure (9ID, point 2).
    console.log(`[9ID interventions] ${JSON.stringify(resultat)}`);
    expect(resultat.profondeur).toBeLessThanOrEqual(10);
  });

  it("/interventions/[id]/bon (transaction principale + palier de cinq)", async () => {
    const resultat = await mesurer((client) =>
      lireBonIntervention(SESSION, INTERVENTION_A1, client),
    );
    // eslint-disable-next-line no-console -- mesure (9ID, point 2).
    console.log(`[9ID bon] ${JSON.stringify(resultat)}`);
    expect(resultat.profondeur).toBeLessThanOrEqual(15);
  });

  it("/clients — liste (round 1 : 5 en parallèle, round 2 : 1, round 3 : 2 en parallèle)", async () => {
    const criteres = schemaRechercheClient.parse({});
    const resultat = await mesurer(async (client) => {
      const [clients] = await Promise.all([
        rechercherClients(SESSION, criteres, client),
        compterClients(SESSION, criteres, client),
        comptesVueClients(SESSION, criteres, client),
        libelleCodeExterneDeLaSociete(SESSION, client),
      ]);
      await Promise.all([
        sitesParClient(SESSION, clients, client),
        resumeDesCartesClients(SESSION, clients, client),
      ]);
    });
    // eslint-disable-next-line no-console -- mesure (9ID, point 2).
    console.log(`[9ID clients] ${JSON.stringify(resultat)}`);
    expect(resultat.profondeur).toBeLessThanOrEqual(15);
  });

  it("/parc — liste (quatorze lectures, pour l'essentiel en parallèle)", async () => {
    const criteres = schemaRechercheParc.parse({});
    const aujourdHui = new Date("2026-09-15T00:00:00.000Z");
    const resultat = await mesurer((client) =>
      Promise.all([
        rechercherLeParc(SESSION, criteres, aujourdHui, client),
        optionsDeFiltreDuParc(SESSION, client),
        compterLeParc(SESSION, criteres, aujourdHui, client),
        compterPanneAvecInterventionOuverte(
          SESSION,
          { client_id: null, site_id: null, famille_id: null },
          client,
        ),
        donneesMaterielDesMachines(SESSION, [], client),
      ]),
    );
    // eslint-disable-next-line no-console -- mesure (9ID, point 2).
    console.log(`[9ID parc] ${JSON.stringify(resultat)}`);
    expect(resultat.profondeur).toBeLessThanOrEqual(10);
  });

  it("/terrain — Ma journée (cinq lectures séquentielles, déjà légère)", async () => {
    const resultat = await mesurer(async (client) => {
      await listerPlanning(
        SESSION,
        new Date("2026-09-15T00:00:00.000Z"),
        new Date("2026-09-16T00:00:00.000Z"),
        client,
      );
      await interventionsEnRetard(
        SESSION,
        new Date("2026-09-15T00:00:00.000Z"),
        client,
      );
      await compteurEnCours(SESSION, client);
    });
    // eslint-disable-next-line no-console -- mesure (9ID, point 2).
    console.log(`[9ID terrain] ${JSON.stringify(resultat)}`);
    expect(resultat.profondeur).toBeLessThanOrEqual(10);
  });

  it("/clients — un client (sites + résumé de carte sur un seul client)", async () => {
    const resultat = await mesurer((client) =>
      Promise.all([
        sitesParClient(SESSION, [{ id: CLIENT_A1 }], client),
        resumeDesCartesClients(SESSION, [{ id: CLIENT_A1 }], client),
      ]),
    );
    // eslint-disable-next-line no-console -- mesure (9ID, point 2).
    console.log(`[9ID clients un] ${JSON.stringify(resultat)}`);
    expect(resultat.profondeur).toBeLessThanOrEqual(6);
  });

  it("/terrain/[id] — fiche terrain (fiche, compteur, palier de six, matériel)", async () => {
    const resultat = await mesurer(async (client) => {
      const fiche = await lireFicheIntervention(
        SESSION,
        INTERVENTION_A1,
        client,
      );
      const machineIds = (fiche?.ligne.machines ?? []).map((m) => m.machine_id);
      await Promise.all([
        mesureDeLIntervention(SESSION, INTERVENTION_A1, client),
        compteurEnCours(SESSION, client),
      ]);
      // Six des huit lectures de l'onglet « Résumé » que l'instrument peut
      // atteindre — `lireSite` et `lignesConditionsFacturation` n'acceptent
      // pas de client injectable ou exigent une ligne déjà résolue ; leur
      // gain, réel mais hors mesure ici, est documenté en passation.
      await Promise.all([
        lireRapportTexte(SESSION, INTERVENTION_A1, client),
        listerLesPrestations(SESSION, client),
        prestationsRealisees(SESSION, INTERVENTION_A1, client),
        photosDeLIntervention(SESSION, INTERVENTION_A1, client),
        derniereSignature(SESSION, INTERVENTION_A1, client),
        piecesRemplacees(SESSION, INTERVENTION_A1, client),
      ]);
      await Promise.all([
        donneesMaterielDesMachines(SESSION, machineIds, client),
        datesDesMachines(SESSION, machineIds, client),
      ]);
    });
    // eslint-disable-next-line no-console -- mesure (9ID, point 2).
    console.log(`[9ID terrain id] ${JSON.stringify(resultat)}`);
    expect(resultat.profondeur).toBeLessThanOrEqual(15);
  });
});

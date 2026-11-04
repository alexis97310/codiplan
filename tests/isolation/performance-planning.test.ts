import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import {
  chargerCalendrierAgence,
  type CacheCalendrierAgence,
} from "@/lib/calendar/agence";
import { minuit } from "@/lib/calendar/fuseau";
import { chargerCalendrierDuTechnicien } from "@/lib/calendar/technicien";
import { avecContexteApplicatif } from "@/lib/db/client";
import { creerTechnicien } from "@/lib/techniciens/depot";

import {
  instrumenter,
  profondeurSequentielle,
} from "../performance/instrument";
import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { AGENCE_A, SOCIETE_A, UTILISATEUR_PAR_ROLE } from "./setup/fixtures";

/**
 * 9ID-PERFORMANCES-MESURE-ET-CORRECTIFS — MESURE DE /planning.
 *
 * Deux boucles `for` de `PagePlanning` (`app/(back-office)/planning/page.tsx`,
 * ex-lignes ~989 et ~1071, audit du 04/11/2026) chargeaient le calendrier de
 * CHAQUE technicien l'un après l'autre, dans une seule transaction — un N+1
 * canonique, N = tous les techniciens actifs de la société. Ce scénario
 * reproduit l'ANCIEN ordre (`for` séquentiel) et le NOUVEAU
 * (`Promise.all`, celui que la page tient désormais) sur six techniciens
 * jetables, tous rattachés à l'agence A (calendrier déjà configuré par le
 * harnais).
 */

afterAll(fermerClients);

const ADMIN_A = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.admin_societe] as string,
  societeId: SOCIETE_A,
  role: Role.admin_societe,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const PREFIXE = "9id-planning-";

function courriel(): string {
  return `${PREFIXE}${Math.floor(Math.random() * 10_000_000)}@codima.test`;
}

afterEach(async () => {
  const motif = `${PREFIXE}%`;
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "technicien" WHERE "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "utilisateur_societe" WHERE "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "utilisateur" WHERE "email" LIKE $1`,
    motif,
  );
});

const anciennEnv = process.env.MESURE_PERFORMANCE_DELAI_MS;
afterAll(() => {
  if (anciennEnv === undefined) {
    delete process.env.MESURE_PERFORMANCE_DELAI_MS;
  } else {
    process.env.MESURE_PERFORMANCE_DELAI_MS = anciennEnv;
  }
});

async function semerTechniciens(): Promise<readonly string[]> {
  const ids: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const resultat = await creerTechnicien(
      ADMIN_A,
      {
        nom: `Technicien 9ID planning ${i}`,
        email: courriel(),
        agence_id: AGENCE_A,
        actif: true,
        statut_ressource: "salarie",
      },
      clientApp(),
    );
    if (!resultat.accepte) throw new Error("fixture technicien non créée");
    ids.push(resultat.utilisateurId);
  }
  return ids;
}

const JOUR_MINUIT = {
  du: minuit({ annee: 2026, mois: 9, jour: 15 }),
  au: minuit({ annee: 2026, mois: 9, jour: 16 }),
};

/** L'ORDRE D'AVANT 9ID : un `for` séquentiel, un technicien après l'autre. */
async function mesurerOrdreAncien(
  client: ReturnType<typeof clientApp>,
  techniciens: readonly string[],
): Promise<void> {
  await avecContexteApplicatif(
    ADMIN_A,
    async (tx) => {
      const cache: CacheCalendrierAgence = new Map();
      for (const utilisateurId of techniciens) {
        await ((await chargerCalendrierDuTechnicien(tx, {
          societeId: SOCIETE_A,
          utilisateurId,
          fenetre: JOUR_MINUIT,
          cache,
        })) ??
          (await chargerCalendrierAgence(
            tx,
            { societeId: SOCIETE_A, agenceId: AGENCE_A, fenetre: JOUR_MINUIT },
            cache,
          )));
      }
    },
    client,
  );
}

/** L'ORDRE D'APRÈS 9ID : `Promise.all`, tous les techniciens de front. */
async function mesurerOrdreNouveau(
  client: ReturnType<typeof clientApp>,
  techniciens: readonly string[],
): Promise<void> {
  await avecContexteApplicatif(
    ADMIN_A,
    async (tx) => {
      const cache: CacheCalendrierAgence = new Map();
      await Promise.all(
        techniciens.map(async (utilisateurId) => {
          await ((await chargerCalendrierDuTechnicien(tx, {
            societeId: SOCIETE_A,
            utilisateurId,
            fenetre: JOUR_MINUIT,
            cache,
          })) ??
            (await chargerCalendrierAgence(
              tx,
              {
                societeId: SOCIETE_A,
                agenceId: AGENCE_A,
                fenetre: JOUR_MINUIT,
              },
              cache,
            )));
        }),
      );
    },
    client,
  );
}

describe("mesure de /planning — le calendrier de chaque technicien (9ID, points 2 et 3)", () => {
  it("le NOUVEAU `Promise.all` est bien moins profond que l'ANCIEN `for` séquentiel, sur les MÊMES six techniciens", async () => {
    const techniciens = await semerTechniciens();
    process.env.MESURE_PERFORMANCE_DELAI_MS = "50";

    const ancien = instrumenter(clientApp());
    const debutAncien = Date.now();
    await mesurerOrdreAncien(ancien.client, techniciens);
    const dureeAncienne = Date.now() - debutAncien;
    const profondeurAncienne = profondeurSequentielle(dureeAncienne, 50);

    const nouveau = instrumenter(clientApp());
    const debutNouveau = Date.now();
    await mesurerOrdreNouveau(nouveau.client, techniciens);
    const dureeNouvelle = Date.now() - debutNouveau;
    const profondeurNouvelle = profondeurSequentielle(dureeNouvelle, 50);

    // eslint-disable-next-line no-console -- la mesure EST le résultat attendu de ce scénario (9ID, point 2).
    console.log(
      `[9ID planning] avant: ${ancien.compteur.transactions} transactions, ${ancien.compteur.requetes} requêtes, ${dureeAncienne}ms, profondeur≈${profondeurAncienne} — ` +
        `après: ${nouveau.compteur.transactions} transactions, ${nouveau.compteur.requetes} requêtes, ${dureeNouvelle}ms, profondeur≈${profondeurNouvelle}`,
    );

    expect(profondeurNouvelle).toBeLessThan(profondeurAncienne);
    // LE GARDE-FOU (point 4) : mesuré à 6 pour six techniciens (contre 16
    // avant) — plafond posé à 10 pour absorber le bruit de mesure sans
    // masquer une régression qui réintroduirait le `for` séquentiel, qui
    // ferait croître cette profondeur AVEC le nombre de techniciens actifs.
    expect(profondeurNouvelle).toBeLessThanOrEqual(10);
  });
});

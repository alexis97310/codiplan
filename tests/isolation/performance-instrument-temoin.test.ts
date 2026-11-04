import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { listerPlanning } from "@/lib/interventions/depot";

import {
  instrumenter,
  profondeurSequentielle,
} from "../performance/instrument";
import { clientApp, fermerClients } from "./setup/db";
import { SOCIETE_A, UTILISATEUR_PAR_ROLE } from "./setup/fixtures";

/**
 * LE TÉMOIN DE L'INSTRUMENT (9ID-PERFORMANCES-MESURE-ET-CORRECTIFS, point 1).
 *
 * Avant de s'en servir pour mesurer les neuf pages, ce scénario prouve que
 * l'instrument compte juste et retarde juste — sur UN appel connu : une seule
 * transaction, une seule requête `intervention.findMany` (plus la pose du
 * contexte RLS, comptée séparément par Prisma comme requête brute).
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

afterEach(() => {
  if (anciennEnv === undefined) {
    delete process.env.MESURE_PERFORMANCE_DELAI_MS;
  } else {
    process.env.MESURE_PERFORMANCE_DELAI_MS = anciennEnv;
  }
});

describe("l'instrument de mesure", () => {
  it("compte UNE transaction pour UN appel à listerPlanning, sans délai", async () => {
    delete process.env.MESURE_PERFORMANCE_DELAI_MS;
    const { client, compteur } = instrumenter(clientApp());

    await listerPlanning(
      SESSION,
      new Date("2026-09-15T00:00:00.000Z"),
      new Date("2026-09-16T00:00:00.000Z"),
      client,
    );

    expect(compteur.transactions).toBe(1);
    expect(compteur.requetes).toBeGreaterThan(0);
  });

  it("le délai artificiel ralentit le rendu d'autant, et la profondeur s'en déduit", async () => {
    process.env.MESURE_PERFORMANCE_DELAI_MS = "50";
    const { client, compteur } = instrumenter(clientApp());

    const debut = Date.now();
    await listerPlanning(
      SESSION,
      new Date("2026-09-15T00:00:00.000Z"),
      new Date("2026-09-16T00:00:00.000Z"),
      client,
    );
    const duree = Date.now() - debut;

    // La pose du contexte RLS (une requête brute) + le `findMany` : au moins
    // deux requêtes, donc au moins 2×50ms de délai cumulé en séquence.
    expect(compteur.requetes).toBeGreaterThanOrEqual(2);
    expect(duree).toBeGreaterThanOrEqual(compteur.requetes * 50 - 10);
    expect(profondeurSequentielle(duree, 50)).toBeGreaterThanOrEqual(2);
  });

  it("deux appels indépendants en Promise.all ne paient le délai qu'une fois", async () => {
    process.env.MESURE_PERFORMANCE_DELAI_MS = "50";
    const { client, compteur } = instrumenter(clientApp());

    const debut = Date.now();
    await Promise.all([
      listerPlanning(
        SESSION,
        new Date("2026-09-15T00:00:00.000Z"),
        new Date("2026-09-16T00:00:00.000Z"),
        client,
      ),
      listerPlanning(
        SESSION,
        new Date("2026-09-16T00:00:00.000Z"),
        new Date("2026-09-17T00:00:00.000Z"),
        client,
      ),
    ]);
    const duree = Date.now() - debut;

    expect(compteur.transactions).toBe(2);
    // Chaque transaction porte sa propre chaîne de requêtes séquentielles,
    // mais les DEUX transactions tournent de front : la durée totale reste de
    // l'ordre d'UNE chaîne, pas de deux mises bout à bout.
    const requetesParTransaction = compteur.requetes / 2;
    expect(duree).toBeLessThan(requetesParTransaction * 50 * 2);
  });
});

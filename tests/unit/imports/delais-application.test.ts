import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ATTENTE_CONNEXION_MS,
  DELAIS_APPLICATION,
  DUREE_MAXIMALE_MS,
  DUREE_MAXIMALE_S,
  LATENCE_PESSIMISTE_MS,
  PLAFOND_PLATEFORME_S,
  allersRetoursApplication,
} from "@/lib/imports/delais";
import { RACINE } from "../outils/fichiers-source";

/**
 * LE BUDGET DE LA TRANSACTION D'APPLICATION (point 2 de la session du
 * 16/09/2026, révisé le même jour en suite — même méthode que
 * `tests/unit/seed-delais.test.ts`, à relire avec ce fichier).
 *
 * *Mesuré en production :* un lot de 615 MODIFICATIONS a rendu
 * `POST /api/imports/{id}/appliquer` sans réponse après quatre minutes, sous
 * les délais par défaut de Prisma (timeout 5 000 ms). Le premier remède a
 * porté `maxDuration` à 1 200 secondes — et le premier déploiement Vercel l'a
 * refusé : le plan Hobby de ce projet plafonnait alors `maxDuration` à
 * `PLAFOND_PLATEFORME_S` (300 — 800 depuis le passage au plan Pro le
 * 20/09/2026, issue #257). Ce fichier éprouve donc DEUX choses
 * distinctes, jamais confondues : l'ARITHMÉTIQUE du budget (allers-retours au
 * pire × latence majorée, sous le délai fixé) ET la conformité du littéral
 * `maxDuration` de la route au plafond de la PLATEFORME — la première ne
 * garantit pas la seconde, et c'est exactement ce que le premier déploiement
 * a montré.
 */
describe("délais de la transaction d'application", () => {
  it("un lot vide pèse le coût fixe, et rien de plus", () => {
    // BEGIN, set_config, lecture du lot, createMany des créations, lecture
    // groupée des avant, mise à jour du lot, COMMIT — sept, et aucune ligne
    // ne s'y ajoute.
    expect(allersRetoursApplication(0)).toBe(7);
  });

  it("le coût AU PIRE d'une ligne est deux allers-retours, pas trois", () => {
    // La réduction du point 1 (suite du 16/09/2026) : la lecture d'avant
    // d'une modification et l'écriture d'une création sont désormais GROUPÉES
    // — voir le docblock de `allersRetoursApplication`. Ce qui reste par
    // ligne, au pire, est l'écriture ET la trace d'une VRAIE modification.
    expect(allersRetoursApplication(1) - allersRetoursApplication(0)).toBe(2);
  });

  it("les deux délais dépassent les défauts de Prisma — sinon ils ne servent à rien", () => {
    // Défauts de Prisma : maxWait 2 000 ms, timeout 5 000 ms — la mesure de
    // production a heurté précisément le second.
    expect(DELAIS_APPLICATION.maxWait).toBe(ATTENTE_CONNEXION_MS);
    expect(DELAIS_APPLICATION.timeout).toBe(DUREE_MAXIMALE_MS);
    expect(DELAIS_APPLICATION.maxWait).toBeGreaterThan(2_000);
    expect(DELAIS_APPLICATION.timeout).toBeGreaterThan(5_000);
  });

  it("DUREE_MAXIMALE_S est la conversion exacte de DUREE_MAXIMALE_MS", () => {
    expect(DUREE_MAXIMALE_S * 1000).toBe(DUREE_MAXIMALE_MS);
  });

  it("l'attente de connexion ET le délai de la transaction tiennent, ENSEMBLE, sous le plafond de la plateforme", () => {
    // Les deux comptent dans le temps d'exécution de la fonction — pas
    // seulement le second. *C'est la marge que le premier déploiement
    // n'avait pas mesurée.*
    const total = ATTENTE_CONNEXION_MS + DUREE_MAXIMALE_MS;
    expect(
      total,
      `maxWait (${ATTENTE_CONNEXION_MS} ms) + timeout (${DUREE_MAXIMALE_MS} ms) ` +
        `= ${total} ms, pour un plafond de plateforme de ` +
        `${PLAFOND_PLATEFORME_S * 1000} ms.`,
    ).toBeLessThan(PLAFOND_PLATEFORME_S * 1000);
  });

  /**
   * **LA ROUTE NE PEUT PAS IMPORTER `DUREE_MAXIMALE_S`, ET C'EST MESURÉ.**
   * Next.js analyse `export const maxDuration` STATIQUEMENT : le premier
   * `pnpm build` de la session a refusé de construire avec « Unknown
   * identifier "DUREE_MAXIMALE_S" at "maxDuration" » — un identifiant importé
   * n'y est pas admis, seul un littéral l'est. Ce gardien-ci lit le FICHIER
   * SOURCE de la route, en texte, pour confronter son littéral À DEUX
   * CHOSES : `DUREE_MAXIMALE_S` (la transaction ne dépasse pas ce que la
   * route promet) ET `PLAFOND_PLATEFORME_S` (la route ne promet pas plus que
   * ce que l'hébergeur accepte — la leçon du déploiement refusé, que
   * `pnpm build` ne peut pas voir).
   */
  it("le littéral `maxDuration` de la route dépasse DUREE_MAXIMALE_S, et ne dépasse jamais le plafond de la plateforme", () => {
    const route = readFileSync(
      join(RACINE, "app", "api", "imports", "[id]", "appliquer", "route.ts"),
      "utf8",
    );
    const trouve = /export const maxDuration = (\d+);/.exec(route);
    expect(
      trouve,
      "la route ne déclare plus `export const maxDuration = <nombre>;` — " +
        "le motif de ce gardien doit être mis à jour avec elle.",
    ).not.toBeNull();
    const litteral = Number(trouve?.[1]);
    // Strictement plus grand : `maxDuration` couvre AUSSI `ATTENTE_CONNEXION_MS`
    // et ce que la route fait hors de la transaction — voir le docblock de
    // `DUREE_MAXIMALE_S`.
    expect(
      litteral,
      `maxDuration vaut ${litteral} dans la route, pour une transaction dont ` +
        `le seul délai (hors attente de connexion) vaut déjà ` +
        `${DUREE_MAXIMALE_S} s. Une transaction autorisée à durer aussi ` +
        "longtemps que la fonction qui la porte, ou plus, ne laisse aucune " +
        "marge pour l'attente de connexion ni pour le reste de la route.",
    ).toBeGreaterThan(DUREE_MAXIMALE_S);
    expect(
      litteral,
      `maxDuration vaut ${litteral} dans la route, pour un plafond de ` +
        `plateforme de ${PLAFOND_PLATEFORME_S} secondes (Vercel, plan Hobby). ` +
        "Le dépasser fait échouer le déploiement, pas la CI.",
    ).toBeLessThanOrEqual(PLAFOND_PLATEFORME_S);
  });

  /**
   * **LE POINT D'ARRÊT DU §8, LEVÉ EN CONSCIENCE — PAS PAR INERTIE.**
   *
   * Ce test tenait ici la limite inverse : sous le plafond du plan Hobby
   * (300 s), un lot de 615 VRAIES modifications simultanées ne tenait plus
   * sous le budget. Le compte Vercel de ce projet est passé au plan Pro le
   * 20/09/2026 (issue #257), et ce plafond a été relevé en conséquence —
   * cette assertion se retourne donc ici volontairement plutôt que d'être
   * desserrée en silence.
   *
   * Le nombre n'est pas recopié en dur : ce test retrouve, à partir du
   * budget COURANT (`DUREE_MAXIMALE_MS`, `LATENCE_PESSIMISTE_MS`,
   * `allersRetoursApplication`), le plus grand nombre de VRAIES
   * modifications simultanées que la transaction peut encore porter, et
   * exige que ce nombre couvre le lot mesuré en production le 16/09/2026 —
   * 615 lignes classées modification. *C'est le lien entre ce ticket et
   * cette mesure-là.*
   */
  it("la capacité de la transaction couvre le lot de 615 VRAIES modifications mesuré le 16/09/2026", () => {
    let capacite = 0;
    while (
      allersRetoursApplication(capacite + 1) * LATENCE_PESSIMISTE_MS <=
      DUREE_MAXIMALE_MS
    ) {
      capacite += 1;
    }

    expect(
      capacite,
      `la transaction ne porte plus que ${capacite} VRAIES modifications ` +
        "simultanées sous ce budget, alors que le lot qui a motivé cette " +
        "série en comptait 615.",
    ).toBeGreaterThanOrEqual(615);
  });

  /**
   * **LE PLAFOND DÉCLARÉ EST CELUI DU PLAN.**
   *
   * Le compte Vercel de ce projet est passé du plan Hobby au plan Pro le
   * 20/09/2026 ; la documentation Vercel du jour porte le maximum du plan
   * Pro à 800 s, en disponibilité générale (issue #257). *Un retour au plan
   * Hobby ferait tomber ce test — et c'est voulu* : `PLAFOND_PLATEFORME_S`
   * devrait alors être revu en conscience, pas laissé à 800 par inertie.
   */
  it("le plafond de la plateforme est celui du plan Pro (800 s, depuis le 20/09/2026)", () => {
    expect(PLAFOND_PLATEFORME_S).toBe(800);
  });
});

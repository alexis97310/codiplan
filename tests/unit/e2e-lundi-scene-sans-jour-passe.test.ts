import { describe, expect, it } from "vitest";

import {
  comparerJours,
  jourSuivant,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import { lundiDeLaSemaine } from "@/lib/calendar/semaine";

import {
  MARDI,
  MERCREDI,
  SAMEDI,
  lundiSansJourPasse,
} from "../e2e/setup/scene";

/**
 * GARDIEN DE 9L31B-REPRISE-CRENEAUX-LUNDI / 9L32-PETITS-DEFAUTS-ET-LUNDI.
 *
 * Mesuré un LUNDI réel (23/11/2026) : `lundiSansJourPasse` ne décale pas
 * `reperes.lundi` quand AUJOURD'HUI est déjà un lundi — MARDI de la scène
 * (lundi+1) tombe alors exactement sur « demain ». C'est ce jour précis où
 * quatre fichiers e2e, qui posent un créneau pour `technicienDucos` sur
 * « demain » par un autre chemin que `scene.ts` (`creneauUtc`/
 * `instantAMinutes` directs), pouvaient chevaucher la fenêtre 08:00–10:00
 * réservée par `obstacle` — corrigé par 9L31B en déplaçant leurs heures hors
 * de cette fenêtre, PAS en changeant `lundiSansJourPasse`.
 *
 * Ce fichier ne rejoue pas ce correctif heure par heure (il vit dans chaque
 * spec e2e) : il fige, de façon PERMANENTE et sans horloge forgée (fonction
 * pure, `aujourdhui` est un paramètre), les deux faits qui rendent ce
 * correctif suffisant pour TOUJOURS, pas seulement pour le jour où il a été
 * mesuré :
 *   1. `lundiSansJourPasse` garantit MARDI, MERCREDI et SAMEDI de la scène
 *      strictement futurs, quel que soit le jour d'exécution ;
 *   2. « MARDI de la scène » ne coïncide avec « demain, en vrai » QUE
 *      lorsque ce jour d'exécution est un lundi — sur les six autres jours,
 *      les deux divergent, et un créneau posé sur « demain » ne peut donc
 *      jamais rencontrer la fenêtre de `obstacle`.
 */

const LUNDI_23_11_2026: JourLocal = { annee: 2026, mois: 11, jour: 23 };

/** Les sept jours de la semaine du 23/11/2026 (LUNDI à DIMANCHE), un par rang ISO. */
const SEMAINE_DE_REFERENCE: readonly JourLocal[] = Array.from(
  { length: 7 },
  (_, rang) => jourSuivant(LUNDI_23_11_2026, rang),
);

describe("lundiSansJourPasse — MARDI/MERCREDI/SAMEDI de la scène restent strictement futurs", () => {
  it.each(SEMAINE_DE_REFERENCE.map((jour) => [jour] as const))(
    "pour aujourd'hui = %o",
    (aujourdhui) => {
      const lundi = lundiSansJourPasse(
        lundiDeLaSemaine(aujourdhui),
        aujourdhui,
      );
      for (const rang of [MARDI, MERCREDI, SAMEDI]) {
        const jourVise = jourSuivant(lundi, rang);
        expect(comparerJours(jourVise, aujourdhui)).toBeGreaterThan(0);
      }
    },
  );
});

describe("« MARDI de la scène » ne coïncide avec « demain » que lorsqu'aujourd'hui est un lundi", () => {
  it.each(
    SEMAINE_DE_REFERENCE.map((jour, rangIso) => [jour, rangIso === 0] as const),
  )("pour aujourd'hui = %o (lundi : %s)", (aujourdhui, estLundi) => {
    const lundi = lundiSansJourPasse(lundiDeLaSemaine(aujourdhui), aujourdhui);
    const mardiDeLaScene = jourSuivant(lundi, MARDI);
    const demain = jourSuivant(aujourdhui, 1);
    expect(comparerJours(mardiDeLaScene, demain) === 0).toBe(estLundi);
  });
});

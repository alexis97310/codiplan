import { describe, expect, it } from "vitest";

import type { JourLocal } from "@/lib/calendar/fuseau";
import {
  TERRITOIRE_NOUVELLE_CALEDONIE,
  feriesDuTerritoire,
} from "@/prisma/seed-data";

import { feriesDeLaSceneNc, lundiSansJourFerie } from "../e2e/setup/scene";

/**
 * GARDIEN DE 9I000-SCENE-SANS-JOUR-FERIE.
 *
 * Mesuré le 04/11/2026 : la semaine du lundi 09/11/2026 porte MERCREDI
 * (lundi+2) le 11/11, l'Armistice — férié des deux territoires du jeu
 * (`FERIES_FIXES`, `prisma/seed-data.ts`). Un dépôt sur un jour férié ouvre
 * la confirmation D93 (« Poser hors des horaires d'ouverture ? ») AVANT
 * toute requête, que les cinq épreuves du glisser-déposer ne jouent jamais
 * : elles attendent directement le POST `…/deplacer`, qui n'est jamais
 * envoyé, et `page.waitForResponse` expire (15 s).
 *
 * `lundiSansJourFerie` ferme ce cas : tant que MARDI, MERCREDI ou SAMEDI de
 * la semaine visée tombe un jour férié du territoire, elle avance d'une
 * semaine entière — exactement le mécanisme de `lundiSansJourPasse`, mais
 * pour les fériés plutôt que pour « déjà passé ». La liste des fériés vient
 * de `feriesDuTerritoire` (la même source que le semis), jamais d'une liste
 * recopiée dans l'épreuve.
 */
describe("feriesDeLaSceneNc", () => {
  it("contient le 11/11/2026 (Armistice, territoire NC)", () => {
    const feries = feriesDeLaSceneNc(2026);
    expect(feries.has("2026-11-11")).toBe(true);
  });

  it("rend exactement les dates de feriesDuTerritoire(NC, ...), sur trois années", () => {
    const feries = feriesDeLaSceneNc(2026);
    const attendues = [2026, 2027, 2028].flatMap((annee) =>
      feriesDuTerritoire(TERRITOIRE_NOUVELLE_CALEDONIE, annee).map(
        (ferie) => ferie.date,
      ),
    );
    expect([...feries].sort()).toEqual([...new Set(attendues)].sort());
  });
});

describe("lundiSansJourFerie", () => {
  const LUNDI_09_11_2026: JourLocal = { annee: 2026, mois: 11, jour: 9 };
  const LUNDI_16_11_2026: JourLocal = { annee: 2026, mois: 11, jour: 16 };

  it("avance d'une semaine quand MERCREDI (lundi+2) de la semaine visée est férié", () => {
    const feries = feriesDeLaSceneNc(2026);
    expect(lundiSansJourFerie(LUNDI_09_11_2026, feries)).toEqual(
      LUNDI_16_11_2026,
    );
  });

  it("ne change rien quand aucun des trois jours visés n'est férié", () => {
    const feries = feriesDeLaSceneNc(2026);
    expect(lundiSansJourFerie(LUNDI_16_11_2026, feries)).toEqual(
      LUNDI_16_11_2026,
    );
  });

  it("ne change rien avec une liste de fériés vide", () => {
    expect(lundiSansJourFerie(LUNDI_09_11_2026, new Set())).toEqual(
      LUNDI_09_11_2026,
    );
  });

  it("est bornée : une liste de fériés qui couvre toutes les semaines lève plutôt que boucler", () => {
    const toutEstFerie = new Set<string>();
    for (let annee = 2026; annee <= 2032; annee += 1) {
      for (let mois = 1; mois <= 12; mois += 1) {
        for (let jour = 1; jour <= 31; jour += 1) {
          toutEstFerie.add(
            `${String(annee).padStart(4, "0")}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`,
          );
        }
      }
    }
    expect(() => lundiSansJourFerie(LUNDI_09_11_2026, toutEstFerie)).toThrow(
      /104 semaines/,
    );
  });
});

import { describe, expect, it } from "vitest";

import {
  ecrireCopie,
  ecrireCopieEnRemplacantLidentite,
  effacerCopie,
  lireCopie,
} from "@/lib/terrain/copie-locale";

/**
 * LA COPIE LOCALE, SOUS JSDOM — jsdom n'implémente PAS IndexedDB (absence
 * documentée, pas un oubli de configuration). Ce fichier éprouve donc
 * exactement ce que le docblock de `lib/terrain/copie-locale.ts` promet :
 * AUCUNE fonction ne lève quand IndexedDB est absent, et la lecture rend
 * `null` plutôt que de propager l'échec.
 *
 * L'ALLER-RETOUR RÉEL (écrire puis relire la même valeur) exige un vrai
 * moteur IndexedDB : il est éprouvé bout en bout par
 * `tests/e2e/offline/9f4h1-consultation.spec.ts`, sous Chromium. Ajouter une
 * dépendance (`fake-indexeddb`) pour le dupliquer ici serait la 200 Ko que
 * CLAUDE.md §2 demande de ne pas ajouter par réflexe.
 */
describe("lib/terrain/copie-locale — résilience à l'absence d'IndexedDB (jsdom)", () => {
  it("ecrireCopie ne lève jamais", async () => {
    await expect(
      ecrireCopie({
        utilisateurId: "u1",
        societeId: "s1",
        genereLe: new Date().toISOString(),
      }),
    ).resolves.toBeUndefined();
  });

  it("lireCopie rend null plutôt que de lever", async () => {
    await expect(lireCopie()).resolves.toBeNull();
  });

  it("effacerCopie ne lève jamais", async () => {
    await expect(effacerCopie()).resolves.toBeUndefined();
  });

  it("ecrireCopieEnRemplacantLidentite ne lève jamais", async () => {
    await expect(
      ecrireCopieEnRemplacantLidentite({
        utilisateurId: "u1",
        societeId: "s1",
        genereLe: new Date().toISOString(),
      }),
    ).resolves.toBeUndefined();
  });
});

import { afterEach, describe, expect, it } from "vitest";

import {
  activiteTerrainEnCours,
  demarrerActiviteTerrain,
  terminerActiviteTerrain,
} from "@/lib/terrain/activite-saisie";

/**
 * L'ACTIVITÉ TERRAIN PARTAGÉE (9F4H5-TERRAIN-VIVANT, point 2) — un ensemble
 * de jetons, idempotent (voir le docblock du module).
 */
describe("activiteTerrainEnCours", () => {
  afterEach(() => {
    // Un module-scope SURVIT entre les tests (ce n'est pas un composant
    // React) — chaque test nettoie ses propres jetons pour ne pas en laisser
    // fuiter vers le suivant.
    terminerActiviteTerrain("a");
    terminerActiviteTerrain("b");
  });

  it("rien en cours par défaut", () => {
    expect(activiteTerrainEnCours()).toBe(false);
  });

  it("une activité démarrée est en cours", () => {
    demarrerActiviteTerrain("a");
    expect(activiteTerrainEnCours()).toBe(true);
  });

  it("démarrer deux fois LE MÊME jeton reste idempotent", () => {
    demarrerActiviteTerrain("a");
    demarrerActiviteTerrain("a");
    terminerActiviteTerrain("a");
    expect(activiteTerrainEnCours()).toBe(false);
  });

  it("terminer un jeton absent n'a aucun effet sur les autres", () => {
    demarrerActiviteTerrain("a");
    terminerActiviteTerrain("inexistant");
    expect(activiteTerrainEnCours()).toBe(true);
  });

  it("deux jetons superposés : l'activité ne cesse qu'au dernier terminé", () => {
    demarrerActiviteTerrain("a");
    demarrerActiviteTerrain("b");
    terminerActiviteTerrain("a");
    expect(activiteTerrainEnCours()).toBe(true);
    terminerActiviteTerrain("b");
    expect(activiteTerrainEnCours()).toBe(false);
  });
});

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repertoire = fileURLToPath(new URL(".", import.meta.url));

/**
 * Répertoire sanctuarisé (CLAUDE.md §6). Les scénarios de cloisonnement
 * multi-société eux-mêmes arrivent au ticket L0-05, une fois le schéma
 * (L0-03) et les politiques RLS (L0-04) en place.
 *
 * En attendant, ce gardien protège le gardien : il vérifie que la porte
 * `pnpm test:isolation` est réellement armée et qu'aucun test du répertoire
 * n'y est neutralisé. C'est ce qui rend visible une régression de la chaîne
 * de vérification, plutôt qu'un `test:isolation` vert parce que vide.
 *
 * Les motifs sont composés à l'exécution pour que ce fichier ne se déclare
 * pas lui-même en infraction.
 */
const motifsDeNeutralisation = ["skip", "only", "todo"].map(
  (suffixe) => `.${suffixe}(`,
);

describe("gardien de cloisonnement", () => {
  const fichiersDeTest = readdirSync(repertoire).filter((nom) =>
    nom.endsWith(".test.ts"),
  );

  it("exécute au moins un fichier de test", () => {
    expect(fichiersDeTest.length).toBeGreaterThan(0);
  });

  it("ne contient aucun test neutralisé ni exclusif", () => {
    for (const fichier of fichiersDeTest) {
      const lignes = readFileSync(join(repertoire, fichier), "utf8").split(
        "\n",
      );

      for (const [index, ligne] of lignes.entries()) {
        for (const motif of motifsDeNeutralisation) {
          expect(
            ligne.includes(motif),
            `${fichier}:${index + 1} neutralise un test avec ${motif}`,
          ).toBe(false);
        }
      }
    }
  });
});

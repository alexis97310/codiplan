import { describe, expect, it } from "vitest";

import {
  NOMBRE_DE_TRANCHES,
  argumentDeTranche,
  codeDeSortieAgrege,
  modeDexecution,
} from "../../scripts/lib/e2e-tranches";

/**
 * `pnpm test:e2e` EN TRANCHES (9L49Z) — voir `scripts/lib/e2e-tranches.ts`
 * pour le pourquoi. Ce gardien porte trois risques distincts :
 *   1. qu'un appel CIBLÉ (`pnpm test:e2e <fichier>`, partout dans les
 *      passations et `docs/captures/README.md`) cesse d'être un passage
 *      direct à Playwright ;
 *   2. que la forme `--shard=i/N` dérive silencieusement ;
 *   3. qu'un `SIGABRT` qui survivrait malgré le découpage (code `null`,
 *      jamais `0`) se lise comme un succès agrégé.
 */
describe("mode d'exécution", () => {
  it("un appel SANS argument déclenche les tranches, sur le nombre fixé", () => {
    const mode = modeDexecution([]);
    expect(mode).toEqual({ type: "tranches", total: NOMBRE_DE_TRANCHES });
  });

  it("un appel ciblé reste un passage direct, arguments inchangés", () => {
    expect(modeDexecution(["tests/e2e/9edz-connexion.spec.ts"])).toEqual({
      type: "direct",
      args: ["tests/e2e/9edz-connexion.spec.ts"],
    });
    expect(modeDexecution(["--workers=1", "un-fichier.spec.ts"])).toEqual({
      type: "direct",
      args: ["--workers=1", "un-fichier.spec.ts"],
    });
  });
});

describe("l'argument de tranche", () => {
  it("prend la forme exacte attendue par Playwright", () => {
    expect(argumentDeTranche(1, 4)).toBe("--shard=1/4");
    expect(argumentDeTranche(4, 4)).toBe("--shard=4/4");
  });
});

describe("le code de sortie agrégé", () => {
  it("vaut 0 seulement quand TOUTES les tranches sortent en 0", () => {
    expect(codeDeSortieAgrege([0, 0, 0, 0])).toBe(0);
    expect(codeDeSortieAgrege([])).toBe(0);
  });

  it("vaut 1 si une seule tranche échoue, où qu'elle soit", () => {
    expect(codeDeSortieAgrege([0, 1, 0, 0])).toBe(1);
    expect(codeDeSortieAgrege([1, 0, 0, 0])).toBe(1);
    expect(codeDeSortieAgrege([0, 0, 0, 1])).toBe(1);
  });

  it("un code NULL (tuée par signal — SIGABRT) compte comme un échec, jamais comme un succès", () => {
    expect(codeDeSortieAgrege([0, null, 0, 0])).toBe(1);
  });
});

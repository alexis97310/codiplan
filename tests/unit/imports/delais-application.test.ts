import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ATTENTE_CONNEXION_MS,
  DELAIS_APPLICATION,
  DUREE_MAXIMALE_MS,
  DUREE_MAXIMALE_S,
  LATENCE_PESSIMISTE_MS,
  allersRetoursApplication,
} from "@/lib/imports/delais";
import { RACINE } from "../outils/fichiers-source";

/**
 * LE BUDGET DE LA TRANSACTION D'APPLICATION (point 2 de la session du
 * 16/09/2026 — même méthode que `tests/unit/seed-delais.test.ts`, à relire
 * avec ce fichier).
 *
 * *Mesuré en production :* un lot de 615 MODIFICATIONS a rendu
 * `POST /api/imports/{id}/appliquer` sans réponse après quatre minutes, sous
 * les délais par défaut de Prisma (timeout 5 000 ms). Ce que ce fichier
 * éprouve n'est pas « la transaction ne dépasse jamais » — aucun test exécuté
 * en local, où la latence est nulle, ne peut le constater — c'est
 * l'ARITHMÉTIQUE : allers-retours au pire × latence majorée, sous le délai
 * fixé, et le fait que le chemin ne s'en remet plus aux défauts de Prisma.
 */
describe("délais de la transaction d'application", () => {
  it("le budget d'un lot de 615 lignes — la mesure de production — tient", () => {
    const allersRetours = allersRetoursApplication(615);
    const budget = allersRetours * LATENCE_PESSIMISTE_MS;

    expect(
      budget,
      `615 lignes, ${allersRetours} allers-retours au pire à ` +
        `${LATENCE_PESSIMISTE_MS} ms coûtent ${budget} ms, pour un délai de ` +
        `${DUREE_MAXIMALE_MS} ms.`,
    ).toBeLessThan(DUREE_MAXIMALE_MS);
  });

  it("le budget n'est pas creux : 615 lignes pèsent plus que le seul coût fixe", () => {
    expect(allersRetoursApplication(615)).toBeGreaterThan(
      allersRetoursApplication(0),
    );
  });

  it("un lot vide pèse le coût fixe, et rien de plus", () => {
    // BEGIN, set_config, lecture du lot, mise à jour du lot, COMMIT — cinq,
    // et aucune ligne ne s'y ajoute.
    expect(allersRetoursApplication(0)).toBe(5);
  });

  it("le coût AU PIRE d'une ligne est bien trois allers-retours, pas un", () => {
    expect(allersRetoursApplication(1) - allersRetoursApplication(0)).toBe(3);
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

  /**
   * **LA ROUTE NE PEUT PAS IMPORTER `DUREE_MAXIMALE_S`, ET C'EST MESURÉ.**
   * Next.js analyse `export const maxDuration` STATIQUEMENT : le premier
   * `pnpm build` de ce ticket a refusé de construire avec « Unknown
   * identifier "DUREE_MAXIMALE_S" at "maxDuration" » — un identifiant importé
   * n'y est pas admis, seul un littéral l'est. `maxDuration` est donc un
   * second nombre, écrit à la main dans la route, exactement le cas que
   * `lib/imports/delais.ts` prévient ailleurs (§9, 01/09) : ce gardien-ci lit
   * le FICHIER SOURCE de la route, en texte, pour confronter son littéral à
   * `DUREE_MAXIMALE_S` — la seule façon de garder les deux nombres attachés
   * sans que `pnpm typecheck` ne puisse le voir.
   */
  it("le littéral `maxDuration` de la route vaut DUREE_MAXIMALE_S", () => {
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
    expect(Number(trouve?.[1])).toBe(DUREE_MAXIMALE_S);
  });
});

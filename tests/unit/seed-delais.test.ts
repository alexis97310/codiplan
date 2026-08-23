import { describe, expect, it } from "vitest";

import { avecSociete, avecSocieteEtRole } from "@/lib/db/rls";
import type { Prisma, PrismaClient } from "@prisma/client";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SOCIETES } from "../../prisma/seed-data";
import {
  ATTENTE_CONNEXION_MS,
  DELAIS_SEED,
  DUREE_MAXIMALE_MS,
  LATENCE_PESSIMISTE_MS,
  allersRetoursTransaction,
} from "../../prisma/seed-delais";
import { RACINE } from "./outils/fichiers-source";

/**
 * Le budget de temps de la transaction du seed (incident du 23 août 2026).
 *
 * Le seed a échoué sur la base hébergée en P2028 — « Transaction not found.
 * Transaction ID is invalid, refers to an old closed transaction » — à la
 * première écriture d'agence, c'est-à-dire au 27ᵉ aller-retour d'une
 * transaction dont le délai valait 5 000 ms par défaut. À ~190 ms
 * l'aller-retour depuis un exécuteur GitHub vers Neon `ap-southeast-2`, le
 * plafond tombait précisément là.
 *
 * **Ce que ces tests gardent, et que rien d'autre ne garde.** La suite
 * d'isolation éprouve un PostgreSQL local, où la latence est nulle : le même
 * seed y passe en quelques dizaines de millisecondes, avec ou sans délai
 * explicite. Aucun test exécutable ne peut donc constater le défaut. Ce qui se
 * vérifie, en revanche, c'est l'ARITHMÉTIQUE — allers-retours × latence
 * majorée — et le fait que le seed ne s'en remette pas au défaut de Prisma.
 */
describe("délais de la transaction du seed", () => {
  it("le budget tient : allers-retours × latence majorée < délai fixé", () => {
    for (const societe of SOCIETES) {
      const allersRetours = allersRetoursTransaction(societe);
      const budget = allersRetours * LATENCE_PESSIMISTE_MS;

      expect(
        budget,
        `${societe.code} : ${allersRetours} allers-retours à ` +
          `${LATENCE_PESSIMISTE_MS} ms coûtent ${budget} ms, pour un délai de ` +
          `${DUREE_MAXIMALE_MS} ms. Le seed a grossi au-delà de son budget : ` +
          "relever DUREE_MAXIMALE_MS en connaissance de cause, ou réduire le " +
          "nombre d'écritures séquentielles. Ne PAS découper la transaction : " +
          "le seed doit rester atomique.",
      ).toBeLessThan(DUREE_MAXIMALE_MS);
    }
  });

  it("le budget n'est pas creux : la transaction compte bien des dizaines d'allers-retours", () => {
    const maximum = Math.max(...SOCIETES.map(allersRetoursTransaction));
    expect(maximum).toBeGreaterThan(20);
  });

  it("les deux délais dépassent les défauts de Prisma — sinon ils ne servent à rien", () => {
    // Défauts de Prisma : maxWait 2 000 ms, timeout 5 000 ms.
    expect(DELAIS_SEED.maxWait).toBe(ATTENTE_CONNEXION_MS);
    expect(DELAIS_SEED.timeout).toBe(DUREE_MAXIMALE_MS);
    expect(DELAIS_SEED.maxWait).toBeGreaterThan(2_000);
    expect(DELAIS_SEED.timeout).toBeGreaterThan(5_000);
  });
});

/**
 * Gardien statique : aucune transaction du seed ne s'en remet au défaut.
 *
 * Le défaut invisible en local est ici même — un `avecSociete(prisma, id, …)`
 * sans quatrième argument compile, passe toute la suite de tests, et n'échoue
 * qu'à Sydney. Le gardien lit donc `prisma/seed.ts` et exige que chaque appel
 * porte `DELAIS_SEED`.
 */
const SEED = join(RACINE, "prisma", "seed.ts");

/**
 * Les appels à `avecSociete` / `avecSocieteEtRole` d'une source, avec la
 * portion de texte qui suit — assez pour voir si `DELAIS_SEED` y figure.
 *
 * L'analyse reste volontairement grossière : elle ne comprend pas TypeScript,
 * elle vérifie qu'un appel et son délai sont voisins. `pnpm typecheck` tient
 * l'autre moitié — un délai mal placé ne compilerait pas.
 */
function appelsAvecDelai(source: string): boolean[] {
  const appels: boolean[] = [];
  const motif = /\bavecSociete(?:EtRole)?\s*\(/g;

  while (motif.exec(source) !== null) {
    let profondeur = 0;
    let index = motif.lastIndex - 1;
    for (; index < source.length; index += 1) {
      if (source[index] === "(") {
        profondeur += 1;
      } else if (source[index] === ")") {
        profondeur -= 1;
        if (profondeur === 0) {
          break;
        }
      }
    }
    appels.push(source.slice(motif.lastIndex, index).includes("DELAIS_SEED"));
  }

  return appels;
}

describe("gardien : le seed ne s'en remet jamais au délai par défaut", () => {
  const source = readFileSync(SEED, "utf8");

  it("trouve bien des transactions dans le seed — sinon le gardien serait vide", () => {
    expect(appelsAvecDelai(source).length).toBeGreaterThanOrEqual(3);
  });

  it("chaque transaction du seed porte DELAIS_SEED", () => {
    const sansDelai = appelsAvecDelai(source).filter((porte) => !porte).length;

    expect(
      sansDelai,
      "une transaction du seed s'en remet au délai par défaut de Prisma " +
        "(5 000 ms). Elle passera en local et échouera en P2028 sur la base " +
        "hébergée. Ajouter DELAIS_SEED en dernier argument.",
    ).toBe(0);
  });

  /**
   * CLAUDE.md §9, 21/08/2026 : « un gardien vert sur un cas fabriqué n'est pas
   * un gardien éprouvé ». Le cas fabriqué prouve au moins que le motif sait
   * mordre — et il est écrit dans la forme exacte qu'avait le seed AVANT la
   * correction, pas dans une forme commode.
   */
  it("le gardien mord sur la forme exacte d'avant la correction", () => {
    const avant = `await avecSociete(prisma, id, async (tx) => {
      await tx.societe.upsert({ where: { id }, update: {}, create: { id } });
    });`;
    expect(appelsAvecDelai(avant)).toEqual([false]);

    const apres = `await avecSociete(
      prisma,
      id,
      async (tx) => {
        await tx.societe.upsert({ where: { id }, update: {}, create: { id } });
      },
      DELAIS_SEED,
    );`;
    expect(appelsAvecDelai(apres)).toEqual([true]);
  });
});

/**
 * `avecSociete` transmet bien les délais à `$transaction`.
 *
 * Sans ce test, le gardien statique ci-dessus prouverait seulement que le mot
 * `DELAIS_SEED` est écrit dans `seed.ts` — pas qu'il arrive jusqu'à Prisma.
 */
describe("avecSociete transmet les délais à Prisma", () => {
  function clientEspion(): {
    prisma: PrismaClient;
    options: () => unknown;
  } {
    let recues: unknown;
    const faux = {
      $transaction: (
        travail: (tx: Prisma.TransactionClient) => Promise<unknown>,
        options?: unknown,
      ) => {
        recues = options;
        const tx = {
          $executeRawUnsafe: () => Promise.resolve(0),
        } as unknown as Prisma.TransactionClient;
        return travail(tx);
      },
    };
    return {
      prisma: faux as unknown as PrismaClient,
      options: () => recues,
    };
  }

  it("transmet les délais quand ils sont donnés", async () => {
    const espion = clientEspion();
    await avecSociete(
      espion.prisma,
      "0192f0a0-0000-7000-8000-000000000001",
      () => Promise.resolve("fait"),
      DELAIS_SEED,
    );
    expect(espion.options()).toEqual(DELAIS_SEED);
  });

  it("n'impose rien quand ils sont omis — les chemins de session gardent les défauts", async () => {
    const espion = clientEspion();
    await avecSocieteEtRole(
      espion.prisma,
      "0192f0a0-0000-7000-8000-000000000001",
      null,
      () => Promise.resolve("fait"),
    );
    expect(espion.options()).toBeUndefined();
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RACINE } from "../outils/fichiers-source";

/**
 * LE HARNAIS N'EMPRUNTE AUCUN NOM À LA PRODUCTION (§9, espèce du 09/09/2026).
 *
 * ## Ce que ce gardien ferme, et ce qu'il a coûté avant d'exister
 *
 * `tests/isolation/setup/db.ts` exportait `avecSociete` et `avecSocieteEtRole`,
 * **exactement comme `lib/db/rls.ts`** — avec un argument de moins et un contrat
 * différent. Un fichier de scénarios qui importe des deux modules choisit alors
 * sans le savoir, et l'éditeur comme la relecture voient un appel qui a l'air
 * juste.
 *
 * Mesuré à L2-01 : appeler celle du harnais avec les arguments de la production
 * passe un **client Prisma** là où un identifiant est attendu ; Prisma tente de
 * le sérialiser et **récurse sans fin**. Le scénario échoue sur « Maximum call
 * stack size exceeded » — *un message juste sur une cause fausse*, celui qui
 * envoie chercher du côté de la base.
 *
 * ## L'ESPÈCE, ET POURQUOI ELLE MÉRITE SON GARDIEN
 *
 * Le §9 (01/09) nomme déjà « deux lectures d'un même CRITÈRE » et « une liste
 * close RECOPIÉE ». Celle-ci est la troisième de la famille et la plus discrète :
 * **deux CONTRATS sous un même NOM, dans deux modules qu'un même fichier
 * importe.** Rien ne les confronte — ni le typage, qui juge chaque appel
 * séparément et se contente de dire « Expected 2 arguments, but got 3 », ni la
 * relecture, pour qui `avecSociete(…)` a l'air d'être `avecSociete`.
 *
 * *La parade n'est pas la vigilance : c'est que le nom ne puisse plus être le
 * même.* Le harnais préfixe ses aides par `sous` — le contexte SOUS lequel un
 * scénario s'exécute —, et ce gardien refuse tout emprunt futur.
 *
 * ## Sa limite, annoncée
 *
 * Il compare des noms EXPORTÉS. Une variable locale qui porterait le nom d'une
 * fonction de production lui échappe — il en existe une aujourd'hui,
 * `tests/isolation/identite-cloisonnee.test.ts`, et elle est inoffensive : une
 * ombre locale n'est jamais appelée à la place d'un import. Ce que ce gardien
 * arrête est l'ambiguïté à la FRONTIÈRE entre deux modules.
 */

const noms = (chemin: string): string[] =>
  [
    ...readFileSync(join(RACINE, chemin), "utf8").matchAll(
      /export\s+(?:async\s+)?function\s+(\w+)/g,
    ),
  ].map((trouve) => trouve[1]!);

const PRODUCTION = "lib/db/rls.ts";
const HARNAIS = "tests/isolation/setup/db.ts";

describe("le harnais d'isolation n'emprunte aucun nom à la production", () => {
  it("TÉMOINS — les deux modules ont réellement été lus", () => {
    // Deux listes vides sont égales, et deux listes vides ne se recoupent pas
    // non plus : sans ces témoins, un motif devenu aveugle passerait au vert
    // sans avoir rien regardé (§9, 30/08).
    expect(noms(PRODUCTION).length).toBeGreaterThanOrEqual(4);
    expect(noms(HARNAIS).length).toBeGreaterThanOrEqual(8);
  });

  it("aucun nom n'est exporté par les DEUX", () => {
    const production = noms(PRODUCTION);
    const partages = noms(HARNAIS).filter((nom) => production.includes(nom));
    expect(
      partages,
      "un nom exporté par le harnais ET par lib/db/rls.ts : un fichier de " +
        "scénarios qui importe des deux choisit alors sans le savoir, et " +
        "l'appel fautif échoue sur une cause qui n'est pas la sienne " +
        "(mesuré à L2-01). Préfixer l'aide du harnais par « sous ».",
    ).toEqual([]);
  });

  it("le gardien VOIT réellement un emprunt — contre-épreuve", () => {
    // Sans elle, une expression régulière fautive rendrait ce gardien
    // silencieux et vert pour toujours.
    const motif = /export\s+(?:async\s+)?function\s+(\w+)/g;
    expect([...`export function avecSociete<T>(`.matchAll(motif)][0]?.[1]).toBe(
      "avecSociete",
    );
  });
});

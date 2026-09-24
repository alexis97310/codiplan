import { describe, expect, it } from "vitest";

import { fichiersSource, sansCommentaires } from "./outils/fichiers-source";

/**
 * GARDIEN DU LOT 51-STABILITE-1 — AUCUN FICHIER N'ÉCRIT, EN SQL BRUT, SUR UNE
 * FIXTURE `SCENE.x` QU'UN AUTRE FICHIER LIT.
 *
 * ## Le défaut qu'il ferme
 *
 * Mesuré le 24/09/2026 : `rapport-terrain.spec.ts` faisait passer
 * `SCENE.obstacle` et `SCENE.chevauchante` à `terminee` par un
 * `$executeRawUnsafe(UPDATE ...)` — deux fixtures que SIX autres fichiers
 * lisent ou déplacent concurremment sous `fullyParallel`
 * (`tests/e2e/playwright.config.ts`). *Un fichier qui écrit sur une donnée
 * qu'il n'a pas créée pour son seul usage fait rougir, au hasard de
 * l'ordonnancement des travailleurs, un scénario sans aucun rapport avec ce
 * qu'il éprouve.*
 *
 * ## Ce qu'il vérifie, et ce qu'il ne vérifie PAS
 *
 * Il lit STATIQUEMENT chaque `tests/e2e/*.spec.ts` : pour chaque appel
 * `$executeRawUnsafe(...)` dont le texte SQL porte `UPDATE` ou
 * `DELETE FROM`, il retient tout identifiant `SCENE.<nom>` référencé DANS LE
 * MÊME APPEL (la requête ou ses paramètres liés), puis vérifie qu'aucun
 * AUTRE fichier de `tests/e2e/` ne lit ce même `SCENE.<nom>`.
 *
 * Il ne voit PAS un geste d'écran (glisser-déposer, clôturer, suspendre…) :
 * ce genre d'écriture ne laisse aucune trace SQL dans le fichier qui la
 * déclenche, et seule une revue humaine — la passation de ce lot — peut
 * l'établir. La liste d'exceptions est VIDE : une fixture qui a besoin
 * d'écrire s'en donne une à elle, sur le modèle de `SCENE.redimensionnable`.
 */

const DOSSIER_E2E = "tests/e2e";

const FICHIERS_EPREUVE = fichiersSource([DOSSIER_E2E], [".ts"])
  .filter((fichier) => fichier.chemin.endsWith(".spec.ts"))
  .map((fichier) => ({
    chemin: fichier.chemin,
    source: sansCommentaires(fichier.contenu),
  }));

/** Les appels `client.$executeRawUnsafe(...)`, texte complet de l'appel. */
function appelsExecuteRawUnsafe(source: string): string[] {
  const appels: string[] = [];
  const motif = /\$executeRawUnsafe\s*\(/g;
  let correspondance: RegExpExecArray | null;
  while ((correspondance = motif.exec(source)) !== null) {
    const debut = correspondance.index + correspondance[0].length;
    let profondeur = 1;
    let position = debut;
    while (profondeur > 0 && position < source.length) {
      const caractere = source[position];
      if (caractere === "(") profondeur += 1;
      if (caractere === ")") profondeur -= 1;
      position += 1;
    }
    appels.push(source.slice(debut, position - 1));
  }
  return appels;
}

/** `SCENE.<nom>` écrits par un fichier, en SQL brut d'écriture. */
function identifiantsSceneEcrits(source: string): Set<string> {
  const ecrits = new Set<string>();
  for (const appel of appelsExecuteRawUnsafe(source)) {
    if (!/\b(UPDATE|DELETE\s+FROM)\b/.test(appel)) {
      continue;
    }
    for (const [, nom] of appel.matchAll(/SCENE\.(\w+)/g)) {
      ecrits.add(nom);
    }
  }
  return ecrits;
}

/** `SCENE.<nom>` lus (toute forme) par un fichier. */
function identifiantsSceneLus(source: string): Set<string> {
  return new Set([...source.matchAll(/SCENE\.(\w+)/g)].map(([, nom]) => nom));
}

describe("l'extraction, éprouvée sur du texte fabriqué", () => {
  it("retient un SCENE.x d'un UPDATE, ignore un SELECT", () => {
    const ecrit = identifiantsSceneEcrits(
      `await c.$executeRawUnsafe(\`UPDATE "t" SET "x" = 1 WHERE "id" = $1\`, SCENE.obstacle);`,
    );
    expect([...ecrit]).toEqual(["obstacle"]);
    const lu = identifiantsSceneEcrits(
      `await c.$executeRawUnsafe(\`SELECT * FROM "t" WHERE "id" = $1\`, SCENE.obstacle);`,
    );
    expect(lu.size).toBe(0);
  });

  it("retient un SCENE.x lié en paramètre, hors du texte SQL lui-même", () => {
    const ecrit = identifiantsSceneEcrits(
      `await c.$executeRawUnsafe(
         \`DELETE FROM "segment_travail" WHERE "intervention_id" = ANY($1::uuid[])\`,
         [SCENE.obstacle, SCENE.chevauchante],
       );`,
    );
    expect([...ecrit].sort()).toEqual(["chevauchante", "obstacle"]);
  });

  it("un appel sans SCENE.x ne retient rien", () => {
    const ecrit = identifiantsSceneEcrits(
      `await c.$executeRawUnsafe(\`UPDATE "t" SET "x" = 1 WHERE "id" = $1\`, FICHE_BON_TERMINEE);`,
    );
    expect(ecrit.size).toBe(0);
  });
});

describe("aucune écriture SQL sur une fixture SCENE.x partagée", () => {
  it("la population des fichiers e2e n'est pas vide", () => {
    expect(FICHIERS_EPREUVE.length).toBeGreaterThan(10);
  });

  for (const fichier of FICHIERS_EPREUVE) {
    const ecrits = identifiantsSceneEcrits(fichier.source);
    if (ecrits.size === 0) {
      continue;
    }
    it(`${fichier.chemin} n'écrit, en SQL brut, sur aucun SCENE.x lu ailleurs`, () => {
      const lecteursAilleurs = new Map<string, string[]>();
      for (const autre of FICHIERS_EPREUVE) {
        if (autre.chemin === fichier.chemin) {
          continue;
        }
        for (const nom of identifiantsSceneLus(autre.source)) {
          if (!ecrits.has(nom)) {
            continue;
          }
          const fichiers = lecteursAilleurs.get(nom) ?? [];
          fichiers.push(autre.chemin);
          lecteursAilleurs.set(nom, fichiers);
        }
      }
      if (lecteursAilleurs.size > 0) {
        const detail = [...lecteursAilleurs.entries()]
          .map(([nom, fichiers]) => `SCENE.${nom} ← ${fichiers.join(", ")}`)
          .join("\n");
        throw new Error(
          `${fichier.chemin} écrit en SQL brut sur une fixture SCENE.x que d'autres fichiers lisent :\n${detail}\n` +
            "Crée une fixture DÉDIÉE, jamais lue ailleurs (cf. SCENE.redimensionnable " +
            "dans tests/e2e/setup/scene.ts), plutôt que d'écrire sur celle-ci.",
        );
      }
    });
  }
});

import { describe, expect, it } from "vitest";

import { fichiersSource, sansCommentaires } from "./outils/fichiers-source";

/**
 * GARDIEN DU LOT 54-STABILITE-2 — LA MISE EN SCÈNE D'UNE ÉPREUVE E2E NE
 * ROUGIT PAS UN AUTRE LOT.
 *
 * ## Le défaut qu'il ferme
 *
 * Mesuré le 25/09/2026, sur le journal de la file, deux nuits de suite,
 * `verify:full` rouge sur deux épreuves étrangères au lot en cours :
 *
 *   1. `avertissements-1.spec.ts` posait la date d'une intervention avec
 *      `CURRENT_DATE` — le jour civil UTC de PostgreSQL — alors que
 *      `/terrain` lit « aujourd'hui » dans le fuseau de la société
 *      (`Pacific/Noumea`, UTC+11). Entre 00h00 et 11h00 heure locale, les
 *      deux jours divergent et la carte n'apparaît plus dans la journée
 *      affichée.
 *   2. `porte-capacites.spec.ts` posait deux interventions à identifiant
 *      FIXE dans un `beforeAll`, sans `test.describe.configure({ mode:
 *      "serial" })` : sous `fullyParallel`, Playwright rejoue `beforeAll`
 *      dans CHAQUE worker qui reçoit un test du fichier, et deux workers
 *      concurrents heurtaient la même ligne (`Unique constraint failed on
 *      the fields: (id)`).
 *
 * ## Ce que ce gardien vérifie, et ce qu'il ne vérifie pas
 *
 * Il lit STATIQUEMENT chaque `tests/e2e/*.spec.ts` :
 *
 *   (a) tout fichier dont le `beforeAll` contient une écriture NON
 *       IDEMPOTENTE (un `.create(`/`.createMany(`/`.upsert(` Prisma, ou un
 *       `$executeRawUnsafe` dont le texte porte `INSERT INTO` sans
 *       `ON CONFLICT` dans le MÊME appel) doit déclarer
 *       `test.describe.configure({ mode: "serial" })` — sinon deux workers
 *       peuvent rejouer ce `beforeAll` en même temps sur le même identifiant
 *       fixe. Une écriture `INSERT … ON CONFLICT DO NOTHING` (ou
 *       `DO UPDATE`) survit à un rejeu concurrent : elle n'exige rien.
 *   (b) aucun fichier ne pose une date par `CURRENT_DATE` — le jour civil
 *       du SERVEUR PostgreSQL, jamais celui d'un fuseau nommé, et donc
 *       jamais celui qu'un écran (`/terrain`, `/planning`) affiche « pour
 *       aujourd'hui ».
 *
 * Il ne voit PAS un geste d'écran (glisser-déposer, clôturer…) qui
 * modifierait une fixture d'un autre fichier — c'est le gardien voisin,
 * `tests/unit/e2e-donnees-partagees.test.ts`, qui ferme ce cas-là. Il ne
 * juge pas non plus si une date posée SANS fuseau est un défaut : une
 * fixture qui n'est jamais lue « par jour » par un écran (l'intervention
 * du bon `bon-intervention.spec.ts` par exemple, visitée directement par
 * son identifiant) n'a besoin d'aucun fuseau.
 *
 * Fermé dans les deux sens : les listes d'exemptions ci-dessous ne
 * protègent que des fichiers qui EXISTENT et que la règle générale
 * flaguerait réellement sans elles — une exemption orpheline ou qui ne
 * protège plus rien fait rougir.
 */

const DOSSIER_E2E = "tests/e2e";

const FICHIERS_EPREUVE = fichiersSource([DOSSIER_E2E], [".ts"])
  .filter((fichier) => fichier.chemin.endsWith(".spec.ts"))
  .map((fichier) => ({
    chemin: fichier.chemin,
    source: sansCommentaires(fichier.contenu),
  }));

/**
 * Aucune exemption connue aujourd'hui : chaque `beforeAll` qui écrit sans
 * série a été corrigé (54-STABILITE-2), et le seul `CURRENT_DATE` du dépôt
 * a été remplacé par une date calculée dans le fuseau de la société.
 */
const EXEMPTIONS_SERIE: readonly { chemin: string; motif: string }[] = [];
const EXEMPTIONS_CURRENT_DATE: readonly { chemin: string; motif: string }[] =
  [];

/** Le texte entre accolades d'un appel `motif(async ... => { ... })`. */
function blocsAccolades(source: string, motif: RegExp): string[] {
  const blocs: string[] = [];
  const global = new RegExp(motif.source, "g");
  let correspondance: RegExpExecArray | null;
  while ((correspondance = global.exec(source)) !== null) {
    const debut = correspondance.index + correspondance[0].length;
    let profondeur = 1;
    let position = debut;
    while (profondeur > 0 && position < source.length) {
      const caractere = source[position];
      if (caractere === "{") profondeur += 1;
      if (caractere === "}") profondeur -= 1;
      position += 1;
    }
    blocs.push(source.slice(debut, position - 1));
  }
  return blocs;
}

/** Les blocs `test.beforeAll(async ... => { ... })` d'un fichier. */
function blocsBeforeAll(source: string): string[] {
  return blocsAccolades(source, /test\.beforeAll\s*\(\s*async[^{]*\{/);
}

/** Le texte des appels `$executeRawUnsafe(...)`, parenthèses comprises. */
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

/**
 * Un `beforeAll` écrit-il de façon NON IDEMPOTENTE — c'est-à-dire qu'un
 * rejeu concurrent, sur le même identifiant, peut heurter une contrainte
 * d'unicité ?
 */
function ecritSansIdempotence(blocBeforeAll: string): boolean {
  if (/\.\s*(create|createMany|upsert)\s*\(/.test(blocBeforeAll)) {
    return true;
  }
  return appelsExecuteRawUnsafe(blocBeforeAll).some(
    (appel) =>
      /\bINSERT\s+INTO\b/i.test(appel) && !/\bON\s+CONFLICT\b/i.test(appel),
  );
}

const DECLARE_SERIE =
  /test\.describe\.configure\s*\(\s*\{\s*mode\s*:\s*["']serial["']/;

function declareSerie(source: string): boolean {
  return DECLARE_SERIE.test(source);
}

const CURRENT_DATE = /\bCURRENT_DATE\b/i;

describe("l'extraction, éprouvée sur du texte fabriqué", () => {
  it("un `.create(` sans ON CONFLICT est une écriture non idempotente", () => {
    expect(
      ecritSansIdempotence(
        `await client.intervention.deleteMany({ where: { id } });
         await client.intervention.create({ data: { id } });`,
      ),
    ).toBe(true);
  });

  it("un `INSERT … ON CONFLICT DO NOTHING` n'exige rien", () => {
    expect(
      ecritSansIdempotence(
        `await client.$executeRawUnsafe(
           \`INSERT INTO "absence" ("id") VALUES ($1::uuid) ON CONFLICT DO NOTHING\`,
           BLOCAGE,
         );`,
      ),
    ).toBe(false);
  });

  it("un `INSERT … ON CONFLICT (id) DO UPDATE` n'exige rien", () => {
    expect(
      ecritSansIdempotence(
        `await client.$executeRawUnsafe(
           \`INSERT INTO "intervention" ("id") VALUES ($1::uuid)
            ON CONFLICT ("id") DO UPDATE SET "id" = EXCLUDED."id"\`,
           id,
         );`,
      ),
    ).toBe(false);
  });

  it("un `INSERT` brut sans ON CONFLICT est une écriture non idempotente", () => {
    expect(
      ecritSansIdempotence(
        `await client.$executeRawUnsafe(
           \`INSERT INTO "intervention" ("id") VALUES ($1::uuid)\`,
           id,
         );`,
      ),
    ).toBe(true);
  });

  it("un `beforeAll` qui ne fait QUE lire n'écrit rien", () => {
    expect(
      ecritSansIdempotence(`const reperes = await reperesDeLaScene();`),
    ).toBe(false);
  });

  it("`test.describe.configure({ mode: \"serial\" })` est détecté, guillemets simples compris", () => {
    expect(declareSerie(`test.describe.configure({ mode: "serial" });`)).toBe(
      true,
    );
    expect(declareSerie(`test.describe.configure({ mode: 'serial' });`)).toBe(
      true,
    );
    expect(declareSerie(`test.describe.configure({ mode: "parallel" });`)).toBe(
      false,
    );
    expect(declareSerie(``)).toBe(false);
  });

  it("`CURRENT_DATE` est détecté, `now()::date` ne l'est pas", () => {
    expect(CURRENT_DATE.test(`VALUES ($1::uuid, CURRENT_DATE)`)).toBe(true);
    expect(CURRENT_DATE.test(`VALUES ($1::uuid, current_date)`)).toBe(true);
    expect(CURRENT_DATE.test(`VALUES ($1::uuid, now()::date)`)).toBe(false);
  });
});

describe("tout `beforeAll` qui écrit sans idempotence déclare la série", () => {
  it("la population des fichiers e2e n'est pas vide", () => {
    expect(FICHIERS_EPREUVE.length).toBeGreaterThan(10);
  });

  it("au moins un fichier réel exige la série — sinon la règle serait aveugle", () => {
    const exigent = FICHIERS_EPREUVE.filter((fichier) =>
      blocsBeforeAll(fichier.source).some(ecritSansIdempotence),
    );
    expect(exigent.length).toBeGreaterThan(0);
  });

  for (const fichier of FICHIERS_EPREUVE) {
    const exigeLaSerie = blocsBeforeAll(fichier.source).some(
      ecritSansIdempotence,
    );
    if (!exigeLaSerie) {
      continue;
    }
    it(`${fichier.chemin} déclare test.describe.configure({ mode: "serial" })`, () => {
      const exemption = EXEMPTIONS_SERIE.find(
        (e) => e.chemin === fichier.chemin,
      );
      if (exemption !== undefined) {
        return;
      }
      expect(
        declareSerie(fichier.source),
        `${fichier.chemin} écrit une fixture à identifiant fixe sans ` +
          `idempotence dans son beforeAll, sans déclarer la série : sous ` +
          `fullyParallel, deux workers peuvent rejouer ce beforeAll en même ` +
          `temps sur la même ligne. Ajouter ` +
          `test.describe.configure({ mode: "serial" }), ou rendre ` +
          `l'écriture idempotente (ON CONFLICT ... DO NOTHING / DO UPDATE).`,
      ).toBe(true);
    });
  }

  it("chaque exemption de série nomme un fichier qui existe et que la règle flaguerait sans elle", () => {
    for (const exemption of EXEMPTIONS_SERIE) {
      const fichier = FICHIERS_EPREUVE.find(
        (f) => f.chemin === exemption.chemin,
      );
      expect(
        fichier,
        `exemption orpheline : ${exemption.chemin} n'existe plus`,
      ).toBeDefined();
      if (fichier === undefined) {
        continue;
      }
      const exigeraitLaSerie = blocsBeforeAll(fichier.source).some(
        ecritSansIdempotence,
      );
      expect(
        exigeraitLaSerie,
        `exemption inutile : ${exemption.chemin} ne serait pas flagué sans elle`,
      ).toBe(true);
      expect(
        declareSerie(fichier.source),
        `exemption inutile : ${exemption.chemin} déclare déjà la série`,
      ).toBe(false);
    }
  });
});

describe("aucune date posée par CURRENT_DATE dans tests/e2e", () => {
  it("aucun fichier ne pose une date par CURRENT_DATE, jamais celle d'un fuseau nommé", () => {
    const fautifs = FICHIERS_EPREUVE.filter(
      (fichier) =>
        CURRENT_DATE.test(fichier.source) &&
        EXEMPTIONS_CURRENT_DATE.every((e) => e.chemin !== fichier.chemin),
    ).map((fichier) => fichier.chemin);

    expect(
      fautifs,
      "CURRENT_DATE est le jour civil du SERVEUR PostgreSQL, jamais celui " +
        "du fuseau de la société (Pacific/Noumea, UTC+11) : un écran qui " +
        "lit « aujourd'hui » par instantDuJour(jourDe(maintenant(fuseau)." +
        "local)) peut diverger de plusieurs heures. Poser la date avec " +
        "instantDuJour(jourDe(maintenant(reperes.fuseau).local)).",
    ).toEqual([]);
  });

  it("chaque exemption de CURRENT_DATE nomme un fichier qui existe et le contient réellement", () => {
    for (const exemption of EXEMPTIONS_CURRENT_DATE) {
      const fichier = FICHIERS_EPREUVE.find(
        (f) => f.chemin === exemption.chemin,
      );
      expect(
        fichier,
        `exemption orpheline : ${exemption.chemin} n'existe plus`,
      ).toBeDefined();
      if (fichier === undefined) {
        continue;
      }
      expect(
        CURRENT_DATE.test(fichier.source),
        `exemption inutile : ${exemption.chemin} ne contient plus CURRENT_DATE`,
      ).toBe(true);
    }
  });
});

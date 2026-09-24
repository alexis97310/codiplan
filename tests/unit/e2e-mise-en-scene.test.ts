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
 *   (a) tout fichier dont le `beforeAll` ÉCRIT en base (un `.create(`,
 *       `.createMany(`, `.update(`, `.updateMany(`, `.upsert(`, `.delete(`,
 *       `.deleteMany(` Prisma, ou un `$executeRawUnsafe` dont le texte
 *       porte `INSERT INTO`, `UPDATE` ou `DELETE FROM`) doit déclarer
 *       `test.describe.configure({ mode: "serial" })` — sinon deux workers
 *       peuvent rejouer ce `beforeAll` en même temps sur le même
 *       identifiant fixe. **Aucune exception implicite** : un
 *       `INSERT … ON CONFLICT DO NOTHING` reste une écriture, et le
 *       gardien l'exige aussi — un fichier qui a délibérément choisi cette
 *       forme plutôt que la série (`blocage-agenda-visible.spec.ts`,
 *       `fiche-intervention.spec.ts`) porte une exemption NOMMÉE ci-dessous,
 *       avec son motif.
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
 * Ces deux fichiers écrivent en base dans leur `beforeAll` sans déclarer la
 * série — un choix délibéré et documenté dans leur propre en-tête : chaque
 * écriture y est un `INSERT … ON CONFLICT DO NOTHING`, qui survit à deux
 * workers concurrents (le gagnant importe peu, la base repart neuve à
 * chaque exécution) là où `deleteMany` puis `create` s'y ferait la course.
 */
const EXEMPTIONS_SERIE: readonly { chemin: string; motif: string }[] = [
  {
    chemin: "tests/e2e/blocage-agenda-visible.spec.ts",
    motif:
      "toutes ses écritures sont des INSERT ... ON CONFLICT DO NOTHING " +
      "(voir son propre en-tête) : idempotentes sous deux workers " +
      "concurrents, la série n'est pas nécessaire.",
  },
  {
    chemin: "tests/e2e/fiche-intervention.spec.ts",
    motif:
      "toutes ses écritures sont des INSERT ... ON CONFLICT DO NOTHING : " +
      "idempotentes sous deux workers concurrents, la série n'est pas " +
      "nécessaire.",
  },
];

/**
 * Aucune exemption connue aujourd'hui : le seul `CURRENT_DATE` du dépôt a
 * été remplacé par une date calculée dans le fuseau de la société
 * (54-STABILITE-2).
 */
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

/** Un `beforeAll` écrit-il en base — au sens large, sans distinguer les
 * formes idempotentes des autres (c'est le rôle des exemptions nommées). */
function ecritEnBase(blocBeforeAll: string): boolean {
  if (
    /\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/.test(
      blocBeforeAll,
    )
  ) {
    return true;
  }
  return appelsExecuteRawUnsafe(blocBeforeAll).some((appel) =>
    /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b/i.test(appel),
  );
}

const DECLARE_SERIE =
  /test\.describe\.configure\s*\(\s*\{\s*mode\s*:\s*["']serial["']/;

function declareSerie(source: string): boolean {
  return DECLARE_SERIE.test(source);
}

const CURRENT_DATE = /\bCURRENT_DATE\b/i;

/**
 * Les arguments des appels `.fill(...)` sur le champ `libelle`, dans
 * `tests/e2e/sites.spec.ts` — DEUX PARENTHÈSES, jamais plus : ce fichier n'en
 * porte qu'un aujourd'hui (STABILITE-3), et une extraction plus permissive
 * (parenthèses imbriquées, appels chaînés) n'a pas de cas réel à couvrir.
 */
function appelsFillLibelle(source: string): string[] {
  const motif = /input\[name="libelle"\]'\)\s*\.\s*fill\(([^)]*)\)/g;
  return Array.from(source.matchAll(motif), (m) => m[1].trim());
}

/**
 * Un argument est une CHAÎNE FIXE quand il commence et finit par le même
 * guillemet et ne porte aucune interpolation (`${`) — exactement le défaut
 * mesuré le 25/09/2026 (STABILITE-3) : `.fill("Site e2e du lot 41
 * (persistance)")` crée le MÊME libellé à chaque exécution, et deux
 * exécutions concurrentes rendent alors deux sites indistinguables sur la
 * liste `/sites` partagée.
 *
 * Un argument qui référence une variable (`.fill(libelle)`) n'est PAS
 * reconnu comme fixe — cette fonction ne remonte pas jusqu'à la déclaration
 * de la variable, seulement jusqu'à l'appel : c'est la limite assumée d'un
 * gardien qui reste simple.
 */
function estLitteralFixe(argument: string): boolean {
  if (argument.includes("${")) return false;
  const premier = argument[0];
  const dernier = argument[argument.length - 1];
  return (
    premier === dernier &&
    (premier === '"' || premier === "'" || premier === "`")
  );
}

describe("l'extraction, éprouvée sur du texte fabriqué", () => {
  it("un `.create(` Prisma est une écriture en base", () => {
    expect(
      ecritEnBase(
        `await client.intervention.deleteMany({ where: { id } });
         await client.intervention.create({ data: { id } });`,
      ),
    ).toBe(true);
  });

  it("un `INSERT … ON CONFLICT DO NOTHING` reste une écriture en base", () => {
    expect(
      ecritEnBase(
        `await client.$executeRawUnsafe(
           \`INSERT INTO "absence" ("id") VALUES ($1::uuid) ON CONFLICT DO NOTHING\`,
           BLOCAGE,
         );`,
      ),
    ).toBe(true);
  });

  it("un `INSERT … ON CONFLICT (id) DO UPDATE` reste une écriture en base", () => {
    expect(
      ecritEnBase(
        `await client.$executeRawUnsafe(
           \`INSERT INTO "intervention" ("id") VALUES ($1::uuid)
            ON CONFLICT ("id") DO UPDATE SET "id" = EXCLUDED."id"\`,
           id,
         );`,
      ),
    ).toBe(true);
  });

  it("un `DELETE FROM` brut est une écriture en base", () => {
    expect(
      ecritEnBase(
        `await client.$executeRawUnsafe(
           \`DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid\`,
           id,
         );`,
      ),
    ).toBe(true);
  });

  it("un `beforeAll` qui ne fait QUE lire n'écrit rien", () => {
    expect(ecritEnBase(`const reperes = await reperesDeLaScene();`)).toBe(
      false,
    );
    expect(
      ecritEnBase(
        `const machine = await client.machine.findFirstOrThrow({ where: { societe_id } });`,
      ),
    ).toBe(false);
  });

  it('`test.describe.configure({ mode: "serial" })` est détecté, guillemets simples compris', () => {
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

  it('un `.fill(...)` sur `input[name="libelle"]` est extrait, guillemets et variable compris', () => {
    expect(
      appelsFillLibelle(
        `await page.locator('input[name="libelle"]').fill("fixe");`,
      ),
    ).toEqual(['"fixe"']);
    expect(
      appelsFillLibelle(
        `await page.locator('input[name="libelle"]').fill(libelle);`,
      ),
    ).toEqual(["libelle"]);
    expect(appelsFillLibelle(`await page.goto("/sites");`)).toEqual([]);
  });

  it("une chaîne fixe est reconnue, une variable ou un gabarit interpolé ne l'est pas", () => {
    expect(estLitteralFixe('"Site e2e du lot 41 (persistance)"')).toBe(true);
    expect(estLitteralFixe("'Site e2e du lot 41 (persistance)'")).toBe(true);
    expect(estLitteralFixe("`Site e2e du lot 41 (persistance)`")).toBe(true);
    expect(estLitteralFixe("libelle")).toBe(false);
    expect(estLitteralFixe("`Site e2e ${jeton} (persistance)`")).toBe(false);
  });
});

describe("tout `beforeAll` qui écrit en base déclare la série, sauf exemption nommée", () => {
  it("la population des fichiers e2e n'est pas vide", () => {
    expect(FICHIERS_EPREUVE.length).toBeGreaterThan(10);
  });

  it("au moins un fichier réel exige la série — sinon la règle serait aveugle", () => {
    const exigent = FICHIERS_EPREUVE.filter((fichier) =>
      blocsBeforeAll(fichier.source).some(ecritEnBase),
    );
    expect(exigent.length).toBeGreaterThan(0);
  });

  for (const fichier of FICHIERS_EPREUVE) {
    const exigeLaSerie = blocsBeforeAll(fichier.source).some(ecritEnBase);
    if (!exigeLaSerie) {
      continue;
    }
    const exemption = EXEMPTIONS_SERIE.find((e) => e.chemin === fichier.chemin);
    it(
      exemption === undefined
        ? `${fichier.chemin} déclare test.describe.configure({ mode: "serial" })`
        : `${fichier.chemin} est exempté de la série (${exemption.motif})`,
      () => {
        if (exemption !== undefined) {
          expect(true).toBe(true);
          return;
        }
        expect(
          declareSerie(fichier.source),
          `${fichier.chemin} écrit en base dans son beforeAll sans déclarer ` +
            `la série : sous fullyParallel, deux workers peuvent rejouer ce ` +
            `beforeAll en même temps sur la même ligne. Ajouter ` +
            `test.describe.configure({ mode: "serial" }), ou documenter une ` +
            `exemption nommée si l'écriture est déjà idempotente ` +
            `(ON CONFLICT ... DO NOTHING).`,
        ).toBe(true);
      },
    );
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
      const exigeraitLaSerie = blocsBeforeAll(fichier.source).some(ecritEnBase);
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

/**
 * GARDIEN DU LOT 62-STABILITE-3 — `sites.spec.ts` NE FIGE PLUS LE LIBELLÉ
 * D'UN SITE FORGÉ.
 *
 * Mesuré le 25/09/2026 : le scénario CONTRAT-SITE-1 créait un site au
 * libellé FIXE (« Site e2e du lot 41 (persistance) »), puis le cherchait sur
 * `/sites?sans_equipement=1` — une liste PAGINÉE que d'autres scènes
 * peuplent en parallèle (`selecteurs-1.spec.ts` y pose 210 sites). Un
 * libellé fixe rend deux exécutions indistinguables l'une de l'autre, mais
 * ce n'est pas ce qui faisait rougir l'épreuve : c'est que RIEN dans le
 * libellé ne permettait de la retrouver par une recherche, seul moyen fiable
 * d'ignorer la pagination. Ce gardien reste au ras du défaut réellement
 * mesuré — un littéral figé passé à `.fill()` — et ne prétend pas vérifier
 * qu'une variable est bien composée d'une valeur qui varie par exécution :
 * ce serait suivre le fil des déclarations, et la règle ne s'écrirait plus
 * simplement.
 */
describe("sites.spec.ts ne fige pas le libellé d'un site forgé (STABILITE-3)", () => {
  const CHEMIN_SITES_SPEC = "tests/e2e/sites.spec.ts";
  const fichier = FICHIERS_EPREUVE.find((f) => f.chemin === CHEMIN_SITES_SPEC);

  it(`${CHEMIN_SITES_SPEC} existe toujours — sinon cette règle est aveugle`, () => {
    expect(fichier).toBeDefined();
  });

  it('au moins un `.fill()` sur `input[name="libelle"]` existe dans ce fichier — sinon la règle est aveugle', () => {
    if (fichier === undefined) return;
    expect(appelsFillLibelle(fichier.source).length).toBeGreaterThan(0);
  });

  it("aucun de ces appels ne passe une chaîne fixe", () => {
    if (fichier === undefined) return;
    const fautifs = appelsFillLibelle(fichier.source).filter(estLitteralFixe);
    expect(
      fautifs,
      `${CHEMIN_SITES_SPEC} fige le libellé d'un site à une chaîne fixe : ` +
        "deux exécutions concurrentes créeraient alors le même site, et " +
        "rien ne permettrait de retrouver sa carte sur la liste `/sites` " +
        "partagée et paginée sans dépendre de l'ordre ou de la charge du " +
        "moment. Composer le libellé avec une valeur qui varie à chaque " +
        "exécution (par exemple crypto.randomUUID()), et filtrer la liste " +
        "par cette valeur (`?q=`) plutôt que de compter sur la pagination.",
    ).toEqual([]);
  });
});

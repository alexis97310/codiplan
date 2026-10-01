import { describe, expect, it } from "vitest";

import {
  EXTENSIONS_TS,
  fichiersSource,
  sansCommentaires,
} from "../outils/fichiers-source";

/**
 * UNE SEULE CORRESPONDANCE PRIORITÉ → TON, PARTAGÉE PARTOUT (GR5, audit du
 * 26/09/2026, constat G6 ; confirmée le 30/09/2026, point 14, D144).
 *
 * `lib/theme/priorites.ts` (`tonDePriorite`) est la SEULE fonction qui associe
 * `"p1"`…`"p4"` à un ton (P1 rouge, P2 orange, P3/P4 gris) — trois écrans
 * peignaient la même priorité de trois façons différentes avant GR5. Ce
 * gardien tient DEUX garanties :
 *
 * 1. tout fichier `.tsx` de `app/` ou `components/` qui rend une clé
 *    `priorite.` (le texte affiché, « P1 — critique » etc.) passe par
 *    `tonDePriorite` ou `Priorite` pour sa couleur — jamais une seconde
 *    lecture du même champ ;
 * 2. aucun fichier HORS `lib/theme/priorites.ts` n'associe `"p1"`…`"p4"` à un
 *    TON (un mot de couleur, ou une classe de ton) — un RANG (un nombre,
 *    `RANG_PRIORITE` de `tableau-de-bord/presentation.ts` et de
 *    `lib/interventions/depot.ts`) ou un FILTRE (une comparaison qui ne
 *    produit pas de couleur, `planning/page.tsx`) n'en sont pas un.
 */

const FICHIER_AUTORISE = "lib/theme/priorites.ts";

const FICHIERS = fichiersSource(["app", "components", "lib"], EXTENSIONS_TS);

/** Les `.tsx` de `app/`/`components/` qui rendent une clé `priorite.`. */
const RENDENT_PRIORITE = FICHIERS.filter(
  (f) =>
    f.chemin.endsWith(".tsx") &&
    (f.chemin.startsWith("app/") || f.chemin.startsWith("components/")) &&
    f.contenu.includes("priorite."),
);

/**
 * UNE ASSOCIATION "p1".."p4" → UN TON — deux formes RESTREINTES, celles qui
 * ont concrètement dédoublé la règle par le passé (voir le docblock de
 * `tonDePriorite`) : un littéral objet (`{ p1: "rouge", … }`) ou une
 * comparaison suivie, à quelques caractères, d'un mot de ton (la forme même
 * de `tonDePriorite`). Une fenêtre LARGE (tout le fichier) aurait fait
 * rougir `planning/page.tsx`, qui emploie « rouge »/« orange »/« gris »
 * ailleurs pour d'AUTRES familles de badge (SLA, site fermé) — d'où ces deux
 * formes ÉTROITES plutôt qu'une proximité de mot libre.
 */
const MOTIF_OBJET = /[{,]\s*p[1-4]\s*:\s*["'](rouge|orange|vert|gris)["']/;
const MOTIF_COMPARAISON =
  /priorite\s*[=!]==?\s*["']p[1-4]["'][\s\S]{0,20}?["'](rouge|orange|vert|gris)["']/;

function associeUnTon(contenu: string): boolean {
  return MOTIF_OBJET.test(contenu) || MOTIF_COMPARAISON.test(contenu);
}

describe("chaque écran qui rend une priorité importe `tonDePriorite` ou `Priorite` (GR5 ; D144)", () => {
  it("le témoin de non-vacuité — exactement six fichiers rendent `priorite.` (mesuré à 5127b1b)", () => {
    expect(RENDENT_PRIORITE.map((f) => f.chemin).sort()).toEqual(
      [
        "app/(back-office)/demandes/[id]/page.tsx",
        "app/(back-office)/demandes/page.tsx",
        "app/(back-office)/interventions/[id]/page.tsx",
        "app/(back-office)/interventions/page.tsx",
        "app/(back-office)/planning/page.tsx",
        "components/ui/priorite.tsx",
      ].sort(),
    );
  });

  it.each(RENDENT_PRIORITE.map((f) => [f.chemin, f] as const))(
    "%s",
    (_chemin, fichier) => {
      expect(
        /from ["']@\/lib\/theme\/priorites["']/.test(fichier.contenu) ||
          /from ["']@\/components\/ui\/priorite["']/.test(fichier.contenu),
      ).toBe(true);
    },
  );
});

describe("aucun fichier hors `lib/theme/priorites.ts` n'associe p1…p4 à un ton (GR5 ; D144)", () => {
  it("la population entière du dépôt (app/, components/, lib/) n'en contient aucune", () => {
    for (const fichier of FICHIERS) {
      if (fichier.chemin === FICHIER_AUTORISE) {
        continue;
      }
      expect(
        associeUnTon(sansCommentaires(fichier.contenu)),
        fichier.chemin,
      ).toBe(false);
    }
  });

  it("`lib/theme/priorites.ts` lui-même PORTE la correspondance — le témoin que la règle sait la voir", () => {
    const priorites = FICHIERS.find((f) => f.chemin === FICHIER_AUTORISE);
    expect(priorites).toBeDefined();
    expect(associeUnTon(sansCommentaires(priorites!.contenu))).toBe(true);
  });

  it("ÉPREUVE — un extrait fabriqué qui redouble la correspondance (littéral objet) rougit", () => {
    const fabrique = `const TON: Record<string, string> = { p1: "rouge", p2: "orange", p3: "gris", p4: "gris" };`;
    expect(associeUnTon(fabrique)).toBe(true);
  });

  it("ÉPREUVE — un extrait fabriqué qui redouble la correspondance (comparaison) rougit", () => {
    const fabrique = `if (priorite === "p1") { return "rouge"; }`;
    expect(associeUnTon(fabrique)).toBe(true);
  });

  it("LES CAS QUI DOIVENT RESTER VERTS — un RANG (nombre) n'est pas un ton", () => {
    expect(
      associeUnTon(
        `const RANG_PRIORITE: Record<string, number> = { p1: 0, p2: 1, p3: 2, p4: 3 };`,
      ),
    ).toBe(false);
    expect(
      associeUnTon(
        `const RANG_PRIORITE: Readonly<Record<Priorite, number>> = {\n  p1: 0,\n  p2: 1,\n  p3: 2,\n  p4: 3,\n};`,
      ),
    ).toBe(false);
  });

  it("LE CAS QUI DOIT RESTER VERT — un FILTRE (comparaison sans ton) n'en est pas un (planning/page.tsx:1968)", () => {
    expect(
      associeUnTon(
        `if (priorite !== "p1" && priorite !== "p2") {\n    return null;\n  }`,
      ),
    ).toBe(false);
  });
});

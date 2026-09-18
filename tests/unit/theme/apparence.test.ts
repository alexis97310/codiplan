import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  APPARENCES,
  APPARENCE_PAR_DEFAUT,
  JETONS,
  LARGEUR_UTILE_PX,
  variableDuJeton,
} from "@/lib/theme/apparence";

/**
 * L'APPARENCE EST CONFRONTÉE À LA FEUILLE DE STYLE, dans les deux sens (D95).
 *
 * **Ce que ce gardien empêche, et il faut le nommer pour ne pas l'oublier :
 * qu'une apparence rende un écran à moitié peint.** Un jeton déclaré dans la
 * liste mais absent du style laisse un rôle sans couleur — et pas au hasard :
 * l'écran qui emploie précisément ce rôle. Un jeton présent dans le style mais
 * absent de la liste est l'autre moitié, et c'est celle qui vieillit en
 * silence : personne ne l'ajoute au second thème, qui naît incomplet.
 *
 * **La population vient du STYLE et de la LISTE**, deux sources que ce fichier
 * ne contrôle ni l'une ni l'autre, et il exige qu'elles disent la même chose —
 * c'est ce qui le distingue d'une recopie (§9, 01/09).
 *
 * **Ce qu'il ne prétend pas faire.** Il ne juge aucune couleur : que le bleu
 * soit le bon bleu se lit dans `docs/maquette/codiplan-maquette-complete.html`
 * (D124 — les jetons de couleur, le rayon et la typographie ; `CODIPLAN_
 * Maquette.html` et l'annexe C restent la source de ce que la première ne
 * dessine pas, D95/D124), et un scénario le vérifie sur les jetons que chaque
 * maquette nomme explicitement. Le reste est une question de goût, et un
 * gardien n'en a pas.
 */

const STYLE_BRUT = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

/**
 * LA COUPURE EST « DOCUMENTATION CONTRE EXÉCUTION », jamais « fichier contre
 * fichier » — c'est celle du gardien de D50, et elle a mordu ici au premier
 * essai : le commentaire qui EXPLIQUE le retrait de `prefers-color-scheme`
 * contenait le mot, et le gardien l'a lu comme une déclaration. *Un gardien qui
 * confond ce qu'un fichier fait et ce qu'un fichier raconte est un gardien qui
 * refuse qu'on documente ses propres décisions.*
 */
const STYLE = STYLE_BRUT.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * `docs/maquette/CODIPLAN_Maquette.html` — la source de la DISPOSITION (D95),
 * inchangée par D124 : largeur utile, grilles, colonnes.
 */
const MAQUETTE = readFileSync(
  join(process.cwd(), "docs/maquette/CODIPLAN_Maquette.html"),
  "utf8",
);

/**
 * `docs/maquette/codiplan-maquette-complete.html` — depuis D124, la source
 * UNIQUE des jetons de couleur, de la typographie, du rayon et de l'ombre.
 * `CODIPLAN_Maquette.html` n'en fait plus foi que pour ce qu'elle-même ne
 * dessine pas (D124, § « CE QUE D95 GARDE »).
 */
const MAQUETTE_COMPLETE = readFileSync(
  join(process.cwd(), "docs/maquette/codiplan-maquette-complete.html"),
  "utf8",
);

/** Les variables `--app-…` réellement DÉCLARÉES dans un bloc de la feuille. */
function declareesDansLeStyle(): Set<string> {
  const declarations = new Set<string>();
  for (const m of STYLE.matchAll(/^\s*(--app-[a-z0-9-]+)\s*:/gm)) {
    declarations.add(m[1]);
  }
  return declarations;
}

/** Les palettes déclarées : `[data-apparence="…"]`. */
function apparencesDuStyle(): Set<string> {
  return new Set(
    [...STYLE.matchAll(/\[data-apparence="([a-z0-9-]+)"\]/g)].map((m) => m[1]),
  );
}

/**
 * Les jetons hexadécimaux `:root{--x:#y}` d'un document — la même lecture,
 * appliquée aux deux maquettes (D124) : ni l'une ni l'autre ne nomme sa
 * typographie, son rayon ou son ombre sous cette forme, ils ne sont donc
 * jamais candidats à cette extraction, qui ne filtre que des valeurs `#…`.
 */
function jetonsRacine(document: string, chemin: string): Map<string, string> {
  const bloc = /:root\s*\{([\s\S]*?)\}/.exec(document);
  if (bloc === null) {
    throw new Error(
      `le bloc \`:root\` est introuvable dans ${chemin} — ` +
        "le document a changé de forme, et ce gardien ne mesure plus rien",
    );
  }
  const jetons = new Map<string, string>();
  for (const m of bloc[1].matchAll(/--([a-z]+)\s*:\s*(#[0-9a-fA-F]{3,8})/g)) {
    jetons.set(m[1], m[2].toLowerCase());
  }
  return jetons;
}

describe("l'apparence et la feuille de style s'accordent, dans les deux sens", () => {
  it("a réellement lu des déclarations — le témoin de non-vacuité", () => {
    expect(JETONS.length).toBeGreaterThanOrEqual(25);
    expect(declareesDansLeStyle().size).toBeGreaterThanOrEqual(JETONS.length);
  });

  it("tout jeton de la liste est déclaré dans le style", () => {
    const declarees = declareesDansLeStyle();
    const manquants = JETONS.filter((j) => !declarees.has(variableDuJeton(j)));
    expect(
      manquants,
      `jetons sans déclaration : ${manquants.join(", ")}`,
    ).toEqual([]);
  });

  it("toute déclaration `--app-…` du style est un jeton de la liste", () => {
    const attendus = new Set(JETONS.map(variableDuJeton));
    const orphelines = [...declareesDansLeStyle()].filter(
      (v) => !attendus.has(v),
    );
    expect(
      orphelines,
      `déclarées sans être énumérées : ${orphelines.join(", ")}`,
    ).toEqual([]);
  });

  it("toute apparence de la liste a son bloc, et réciproquement", () => {
    const duStyle = apparencesDuStyle();
    expect([...APPARENCES].filter((a) => !duStyle.has(a))).toEqual([]);
    const connues: readonly string[] = APPARENCES;
    expect([...duStyle].filter((a) => !connues.includes(a))).toEqual([]);
  });

  it("l'apparence par défaut est l'une des apparences connues", () => {
    expect(APPARENCES).toContain(APPARENCE_PAR_DEFAUT);
  });
});

describe("les valeurs de couleur viennent de codiplan-maquette-complete.html, pas d'un goût (D124)", () => {
  it("a réellement lu la maquette — le témoin", () => {
    expect(
      jetonsRacine(
        MAQUETTE_COMPLETE,
        "docs/maquette/codiplan-maquette-complete.html",
      ).size,
    ).toBeGreaterThanOrEqual(9);
  });

  it("les dix couleurs que la maquette NOMME sont celles du style", () => {
    // Les dix jetons hexadécimaux du `:root` de `codiplan-maquette-complete.html`
    // (D124) — `--surface-2`, `--line-2`, `--blue-2`, `--red-2`, `--green-2`,
    // `--orange-2`, `--purple`, `--purple-2` en sont exclus par construction
    // (voir `jetonsRacine`) : ce ne sont pas des noms à un seul mot, et le
    // violet n'a de toute façon aucun jeton `--app-…` à confronter (D124, «
    // CE QUI N'EST PAS AJOUTÉ »).
    const maquette = jetonsRacine(
      MAQUETTE_COMPLETE,
      "docs/maquette/codiplan-maquette-complete.html",
    );
    const paires: ReadonlyArray<[string, string]> = [
      ["red", "--app-accent"],
      ["blue", "--app-marque"],
      ["ink", "--app-encre"],
      ["bg", "--app-fond"],
      ["green", "--app-vert-plein"],
      ["orange", "--app-orange-bord"],
      ["muted", "--app-encre-faible"],
      ["line", "--app-bord"],
    ];
    for (const [nomMaquette, variable] of paires) {
      const attendue = maquette.get(nomMaquette);
      expect(
        attendue,
        `la maquette ne nomme plus --${nomMaquette}`,
      ).toBeDefined();
      const declaree = new RegExp(
        `${variable}\\s*:\\s*(#[0-9a-fA-F]{3,8})`,
      ).exec(STYLE);
      expect(declaree, `${variable} n'est pas déclarée`).not.toBeNull();
      expect(declaree![1].toLowerCase(), variable).toBe(attendue);
    }
  });

  it("le rayon est celui de `--radius` dans la maquette, jamais un nombre recopié", () => {
    const radius = /--radius\s*:\s*(\d+)px/.exec(MAQUETTE_COMPLETE);
    expect(
      radius,
      "`--radius` n'est plus déclaré dans codiplan-maquette-complete.html",
    ).not.toBeNull();
    const declaree = /--radius\s*:\s*(\d+)px/.exec(STYLE);
    expect(
      declaree,
      "--radius n'est pas déclarée dans le style",
    ).not.toBeNull();
    expect(declaree![1]).toBe(radius![1]);
  });
});

describe("la disposition vient de CODIPLAN_Maquette.html, inchangée par D124", () => {
  it("la largeur utile est celle de `.wrap` dans la maquette", () => {
    const wrap = /\.wrap\s*\{[^}]*max-width\s*:\s*(\d+)px/.exec(MAQUETTE);
    expect(
      wrap,
      "`.wrap` n'a plus de max-width dans la maquette",
    ).not.toBeNull();
    expect(Number(wrap![1])).toBe(LARGEUR_UTILE_PX);
  });
});

describe("aucune apparence sombre n'est servie — c'est une absence DÉCIDÉE", () => {
  it("le style ne porte plus de bascule de schéma de couleur", () => {
    // La maquette n'en décrit aucune. Le bloc qui vivait ici servait des
    // jetons neutres sans rapport avec la charte, et personne ne posait la
    // classe : il rendait une moitié d'application hors charte au premier
    // téléphone réglé en sombre. Le jour où une apparence sombre sera
    // décidée, elle sera un THÈME — une entrée de `APPARENCES` — et ce
    // scénario tombera avec sa raison d'être.
    expect(STYLE).not.toMatch(/prefers-color-scheme/);
    expect(STYLE).toMatch(/color-scheme:\s*light/);
  });
});

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
 * soit le bon bleu se lit dans `docs/CODIPLAN_Maquette.html` et dans l'annexe C,
 * et un scénario le vérifie sur les jetons que la maquette nomme explicitement.
 * Le reste est une question de goût, et un gardien n'en a pas.
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
const MAQUETTE = readFileSync(
  join(process.cwd(), "docs/CODIPLAN_Maquette.html"),
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

/** Les jetons `:root{--x:#y}` de la maquette — la source qui fait foi. */
function jetonsDeLaMaquette(): Map<string, string> {
  const bloc = /:root\s*\{([\s\S]*?)\}/.exec(MAQUETTE);
  if (bloc === null) {
    throw new Error(
      "le bloc `:root` est introuvable dans docs/CODIPLAN_Maquette.html — " +
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

describe("les valeurs viennent de la maquette, pas d'un goût", () => {
  it("a réellement lu la maquette — le témoin", () => {
    expect(jetonsDeLaMaquette().size).toBeGreaterThanOrEqual(9);
  });

  it("les sept couleurs que la maquette NOMME sont celles du style", () => {
    // Les sept de l'annexe C, telles que la maquette les déclare. Ce sont les
    // seules dont le nom est commun aux deux documents ; le reste (les fonds
    // pâles des familles) n'a pas de nom dans la maquette, il y vit dans les
    // règles `.ev.*` — et le comparer exigerait de recopier ces règles ici,
    // c'est-à-dire de fabriquer la seconde copie qu'on veut éviter.
    const maquette = jetonsDeLaMaquette();
    const paires: ReadonlyArray<[string, string]> = [
      ["rouge", "--app-accent"],
      ["bleu", "--app-marque"],
      ["noir", "--app-encre"],
      ["fond", "--app-fond"],
      ["vert", "--app-vert-plein"],
      ["orange", "--app-orange-bord"],
      ["gris", "--app-encre-faible"],
      ["bord", "--app-bord"],
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

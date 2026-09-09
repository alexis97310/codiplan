import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  analyserAmendements,
  type AnalyseAmendements,
} from "../../../scripts/lib/amendements-arbitrages";

/**
 * LE CÂBLAGE ARBITRAGE ↔ ARBITRAGE (nuit du 10/09/2026).
 *
 * La passe du 09/09 a trouvé cinq décisions de rang 1 rendues fausses par une
 * décision ultérieure, sans marque — et rien dans le dépôt ne pouvait le voir :
 * le câblage de R0-b ne regarde que les paires règle ↔ arbitrage. Réparer les
 * cinq aurait refait le geste qui venait d'échouer. Ce gardien est la classe.
 *
 * Trois précautions, toutes tirées du §9 : la population est l'ENSEMBLE des
 * décisions (31/08) ; des témoins refusent le vert sur une observation vide
 * (30/08) ; et chaque refus a son jumeau, écrit sur le document RÉEL (24/08).
 */

const racine = process.cwd();
const ARBITRAGES = readFileSync(join(racine, "docs/arbitrages.md"), "utf8");
const analyse: AnalyseAmendements = analyserAmendements(ARBITRAGES);

/** Planchers. Ils ne se baissent jamais. */
const PLANCHER_DECISIONS = 70;
const PLANCHER_PAIRES = 10;
const PLANCHER_PROSE = 3;

/** Le câblage attendu, écrit ici pour être lu — et non déduit du document. */
const AMENDEMENTS_ATTENDUS: ReadonlyArray<readonly [string, string]> = [
  // [amendée, amendante]
  ["D7", "D71"],
  ["D13", "D46"],
  ["D15", "D54"],
  ["D19", "D44"],
  ["D23", "D56"],
  ["D32", "D52"],
  ["D32", "D53"],
  ["D32", "D55"],
  ["D52", "D55"],
  ["D53", "D55"],
];

describe("câblage bidirectionnel entre décisions", () => {
  it("n'observe aucun écart", () => {
    expect(analyse.ecarts, analyse.ecarts.join("\n")).toEqual([]);
  });

  it("a réellement regardé des décisions, des paires et de la prose", () => {
    expect(analyse.decisions.length).toBeGreaterThanOrEqual(PLANCHER_DECISIONS);
    expect(analyse.accordees.length).toBeGreaterThanOrEqual(PLANCHER_PAIRES);
    expect(analyse.affirmationsEnProse.length).toBeGreaterThanOrEqual(
      PLANCHER_PROSE,
    );
    expect(analyse.depuisAmendees.length).toBeGreaterThan(0);
    expect(analyse.depuisAmendantes.length).toBeGreaterThan(0);
  });

  it("câble exactement les paires attendues", () => {
    const observees = analyse.accordees
      .map((p) => `${p.amendee} ← ${p.amendante}`)
      .sort();
    const attendues = AMENDEMENTS_ATTENDUS.map(([a, b]) => `${a} ← ${b}`).sort();
    expect(observees).toEqual(attendues);
  });

  it("porte le témoin de son adossement : chaque décision citée existe", () => {
    const refs = new Set(analyse.decisions.map((d) => d.ref));
    for (const [amendee, amendante] of AMENDEMENTS_ATTENDUS) {
      expect(refs, `décision inconnue : ${amendee}`).toContain(amendee);
      expect(refs, `décision inconnue : ${amendante}`).toContain(amendante);
    }
  });
});

describe("jumeaux — le gardien mord dans les deux sens, sur le document réel", () => {
  it("refuse une décision amendée qui ne nomme plus son amendante", () => {
    // La rupture telle qu'elle s'écrirait : la marque retirée de D19.
    const rompu = ARBITRAGES.replace("\n**Amendé par D44.**\n", "\n");
    expect(rompu, "la marque visée n'a pas été retirée").not.toEqual(ARBITRAGES);
    const analyseRompue = analyserAmendements(rompu);
    expect(analyseRompue.ecarts).toContain(
      "D44 déclare amender D19, mais D19 ne porte pas « **Amendé par D44.** »",
    );
    expect(
      analyseRompue.accordees.map((p) => p.amendee),
      "la paire n'a pas disparu : la violation n'a pas eu lieu",
    ).not.toContain("D19");
  });

  it("refuse une décision amendante qui ne nomme plus ce qu'elle amende", () => {
    const rompu = ARBITRAGES.replace(
      "\n**Décisions amendées :** D7\n",
      "\n",
    );
    expect(rompu).not.toEqual(ARBITRAGES);
    const analyseRompue = analyserAmendements(rompu);
    expect(analyseRompue.ecarts).toContain(
      "D7 se dit amendée par D71, mais D71 ne déclare pas « **Décisions amendées :** D7 »",
    );
    // Et la prose de D71 continue d'affirmer l'amendement : deuxième prise —
    // c'est exactement le défaut d'origine, une prose sans marque.
    expect(analyseRompue.ecarts).toContain(
      "D71 affirme en prose amender D7 mais ne le déclare pas — ajouter « **Décisions amendées :** D7 » à D71 et « **Amendé par D71.** » à D7",
    );
  });

  it("refuse une référence qui ne s'adosse à rien, et une paire à l'envers", () => {
    const fantome = ARBITRAGES.replace(
      "**Décisions amendées :** D7",
      "**Décisions amendées :** D7, D999",
    );
    expect(fantome).not.toEqual(ARBITRAGES);
    expect(analyserAmendements(fantome).ecarts).toContain(
      "D71 déclare amender D999, qui n'existe pas dans docs/arbitrages.md",
    );

    const envers = ARBITRAGES.replace(
      "**Décisions amendées :** D7",
      "**Décisions amendées :** D7, D72",
    );
    expect(analyserAmendements(envers).ecarts).toContain(
      "D71 déclare amender D72, qui lui est postérieure : la paire est écrite à l'envers",
    );
  });

  it("refuse une marque mal formée plutôt que de la lire comme une absence", () => {
    // La forme voisine, celle qu'un rédacteur bien intentionné écrirait.
    const voisine = ARBITRAGES.replace(
      "**Décisions amendées :** D7",
      "**Décisions amendées :** la décision D7",
    );
    expect(voisine).not.toEqual(ARBITRAGES);
    expect(analyserAmendements(voisine).ecarts).toContain(
      "D71 : ligne de déclaration mal formée — la forme attendue est « **Décisions amendées :** D15, D19 »",
    );
  });

  it("échoue sur zéro décision observée plutôt que de passer pour un sans-faute", () => {
    const vide = ARBITRAGES.replace(/^#{2,4}\s+D\d+\b.*$/gm, "");
    const analyseVide = analyserAmendements(vide);
    expect(analyseVide.decisions).toEqual([]);
    expect(analyseVide.decisions.length).toBeLessThan(PLANCHER_DECISIONS);
  });
});

/**
 * CE QUE CE GARDIEN AURAIT ATTRAPÉ, ET DEPUIS QUAND — mesuré sur l'état
 * d'avant la nuit du 10/09, tel que la passe du 09/09 l'a laissé.
 *
 * Sur les cinq décisions de la passe, UNE SEULE est amendée par une décision
 * numérotée : D13, par D46 (21/08/2026). Et D46 n'écrit jamais « D13 » sous une
 * forme qui affirme l'amendement — elle renverse l'ordre de lecture des fériés
 * sans nommer la décision qu'elle contredit. Ce gardien ne l'aurait donc PAS
 * attrapée tout seul : il l'attrape depuis que la marque existe, et il empêche
 * qu'elle disparaisse. Les quatre autres (D10, D11, D14, D28) sont amendées par
 * un ticket, une question hors registre, un incident, ou une énumération —
 * hors de sa population, et c'est écrit dans son en-tête.
 *
 * Ce qu'il aurait attrapé, en revanche, le jour où c'était écrit : D44 (« D19
 * est donc amendé », 21/08) et D71 (« D71 amende D7 », 09/09) — deux proses qui
 * affirmaient un amendement sans qu'aucune marque ne l'accompagne du côté
 * amendant. Le témoin ci-dessous le prouve sur le document réel : les
 * déclarations retirées, la prose suffit à rougir.
 */
describe("ce qu'il aurait attrapé avant d'exister", () => {
  it("la prose de D44 et de D71 rougit sans déclaration — la marque n'est pas un ornement", () => {
    const sansDeclarations = ARBITRAGES.replace(
      /^\*\*Décisions amendées :\*\*.*$\n?/gm,
      "",
    );
    expect(sansDeclarations).not.toEqual(ARBITRAGES);
    const ecarts = analyserAmendements(sansDeclarations).ecarts;
    expect(ecarts.some((e) => e.startsWith("D44 affirme en prose amender D19"))).toBe(true);
    expect(ecarts.some((e) => e.startsWith("D71 affirme en prose amender D7"))).toBe(true);
  });
});

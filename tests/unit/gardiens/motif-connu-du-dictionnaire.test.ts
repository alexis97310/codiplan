import { describe, expect, it } from "vitest";

import { estCleTraduction } from "@/lib/i18n/fr";

import { fichiersSource } from "../outils/fichiers-source";
import { motifsDeRefusDeclares } from "../outils/motifs-de-refus";

/**
 * Gardien du ticket 9L51-I18N-MOTIFS-MANQUANTS.
 *
 * La revue de 9I8A1 (31/10/2026) a relevé que `regle_arrondi.refus.droit`
 * était renvoyée par le code (`lib/societes/identite.ts`) sans exister dans
 * `lib/i18n/fr.ts` : l'écran de `/parametres/tarifs` ne montrait alors rien
 * du tout (`estCleTraduction` rend faux). Ce gardien généralise le constat :
 * toute clé de refus déclarée sous un type `Refus…`/`Motif…` existe au
 * dictionnaire.
 *
 * **Ce qu'il couvre, et pourquoi pas davantage** : voir l'en-tête de
 * `../outils/motifs-de-refus.ts`, qui fournit la lecture — seuls les
 * littéraux POINTÉS d'un type nommé `Refus…`/`Motif…` sont concernés, pas
 * toute propriété `motif` du dépôt (une étiquette de comparaison côté écran
 * n'est pas une clé), ni la composition par gabarit littéral (hors de
 * portée d'une lecture syntaxique).
 */

const FICHIERS = fichiersSource(["lib", "app"]);
const MOTIFS = motifsDeRefusDeclares(FICHIERS);

describe("toute clé de refus déclarée existe au dictionnaire (9L51)", () => {
  /**
   * Le TÉMOIN : un décompte nul ressemblerait à un sans-faute sans avoir
   * rien regardé (§9 du CLAUDE.md).
   */
  it("trouve des motifs de refus déclarés dans le dépôt", () => {
    expect(MOTIFS.length).toBeGreaterThan(20);
  });

  it("chaque motif déclaré est une clé du dictionnaire", () => {
    const fautes = MOTIFS.filter((motif) => !estCleTraduction(motif.cle))
      .map((motif) => `${motif.chemin}:${motif.ligne} — « ${motif.cle} »`)
      .sort();

    expect(
      fautes,
      "une clé de refus est renvoyée par le code sans exister dans " +
        "lib/i18n/fr.ts : l'écran ne montrerait rien du refus (9L51)",
    ).toEqual([]);
  });

  it("ne réclame pas un code court composé plus loin par un gabarit", () => {
    const fichiersFabriques = [
      {
        chemin: "lib/essai/refus.ts",
        contenu:
          'export type MotifRefusEssai = "fusionnee" | "sortie_sans_confirmation";\n',
      },
    ];
    expect(motifsDeRefusDeclares(fichiersFabriques)).toEqual([]);
  });

  it("détecte un littéral pointé inconnu du dictionnaire, sous un type fabriqué", () => {
    const fichiersFabriques = [
      {
        chemin: "lib/essai/refus.ts",
        contenu:
          'export type RefusEssai = "essai_9l51.refus.invente_pour_le_test";\n',
      },
    ];
    const motifs = motifsDeRefusDeclares(fichiersFabriques);
    expect(motifs).toEqual([
      {
        cle: "essai_9l51.refus.invente_pour_le_test",
        chemin: "lib/essai/refus.ts",
        ligne: 1,
      },
    ]);
    expect(estCleTraduction(motifs[0]!.cle)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { t } from "@/lib/i18n/fr";
import {
  phrasesTypesTerrain,
  texteAvecPhraseInseree,
} from "@/lib/terrain/phrases-types";

/**
 * LES PHRASES TYPES DU RAPPORT TERRAIN (9L04F-TERRAIN-RAPPORT-PHRASES-
 * TYPES, décision d'Alexis du 13/11/2026) — FONCTIONS PURES.
 */

describe("phrasesTypesTerrain", () => {
  it("rend les quatre phrases validées, dans l'ordre du dictionnaire", () => {
    expect(phrasesTypesTerrain()).toEqual([
      t("terrain.rapport.phrases_types.phrase_1"),
      t("terrain.rapport.phrases_types.phrase_2"),
      t("terrain.rapport.phrases_types.phrase_3"),
      t("terrain.rapport.phrases_types.phrase_4"),
    ]);
  });
});

describe("texteAvecPhraseInseree", () => {
  it("insère la phrase à la position du curseur, au milieu d'un texte existant", () => {
    expect(texteAvecPhraseInseree("Avant. Après.", "Milieu.", 6)).toBe(
      "Avant.Milieu. Après.",
    );
  });

  it("insère la phrase seule dans un texte vide, quelle que soit la position", () => {
    expect(texteAvecPhraseInseree("", "Contrôle effectué, RAS", 0)).toBe(
      "Contrôle effectué, RAS",
    );
  });

  it("ajoute la phrase en fin de texte, sur une nouvelle ligne, quand la position est inconnue", () => {
    expect(
      texteAvecPhraseInseree("Déjà écrit.", "Pièce remplacée", null),
    ).toBe("Déjà écrit.\nPièce remplacée");
  });

  it("ajoute la phrase seule quand le texte est vide et la position inconnue", () => {
    expect(texteAvecPhraseInseree("", "Client informé", null)).toBe(
      "Client informé",
    );
  });

  it("se replie en fin de texte quand la position dépasse la longueur du texte", () => {
    expect(texteAvecPhraseInseree("Court", "Suite", 99)).toBe(
      "Court\nSuite",
    );
  });
});

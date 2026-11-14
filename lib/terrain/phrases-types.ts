import { t } from "@/lib/i18n/fr";

/**
 * LES QUATRE PHRASES TYPES (décision d'Alexis du 13/11/2026, 9L04F-TERRAIN-
 * RAPPORT-PHRASES-TYPES) — FIXES pour l'instant (une liste réglable au
 * bureau viendra plus tard, si demandée). Un seul endroit du code énumère
 * ces quatre clés ensemble : ici.
 */
export function phrasesTypesTerrain(): readonly string[] {
  return [
    t("terrain.rapport.phrases_types.phrase_1"),
    t("terrain.rapport.phrases_types.phrase_2"),
    t("terrain.rapport.phrases_types.phrase_3"),
    t("terrain.rapport.phrases_types.phrase_4"),
  ];
}

/**
 * INSÈRE `phrase` DANS `texteActuel` À LA POSITION `position` (point 2 du
 * ticket) — ou en fin de texte, sur une nouvelle ligne, si `position` est
 * inconnue (champ jamais focalisé). FONCTION PURE : le texte résultant
 * reste une saisie ordinaire, modifiable comme n'importe quelle autre.
 */
export function texteAvecPhraseInseree(
  texteActuel: string,
  phrase: string,
  position: number | null,
): string {
  if (
    position === null ||
    position < 0 ||
    position > texteActuel.length
  ) {
    return texteActuel.length === 0 ? phrase : `${texteActuel}\n${phrase}`;
  }
  return `${texteActuel.slice(0, position)}${phrase}${texteActuel.slice(position)}`;
}

/**
 * LES COULEURS NEUTRES D'UN PDF RENDU PAR `@react-pdf/renderer` (9L62-PRET-3-
 * BON-SIGNE) — même doctrine que `courriel.ts` (D207) : des constantes
 * nommées, au seul endroit désigné (`lib/theme/`), jamais recopiées en dur
 * ailleurs (L0-09, point 5).
 *
 * **Ce n'est pas la charte d'une société.** `@react-pdf/renderer` ne consomme
 * ni DOM ni variable CSS — ses styles sont des valeurs littérales évaluées une
 * fois, au rendu. Le bon de prêt est un document administratif NEUTRE, commun
 * à toutes les sociétés (même raisonnement que `PRIMAIRE_NEUTRE`/
 * `ACCENT_NEUTRE`, `defaut.ts`), écrit une seule fois ici.
 */

/** Le texte courant. */
export const TEXTE_PDF = "#111827";

/** Le texte atténué — libellés, numéro du bon. */
export const TEXTE_ATTENUE_PDF = "#5B6472";

/** Le fond d'un bloc de mention (prêt gratuit, engagement de restitution). */
export const FOND_MENTION_PDF = "#F1F3F6";

/** Le texte d'alerte — une remise sans signature. */
export const TEXTE_ALERTE_PDF = "#A3040E";

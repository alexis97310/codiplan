/**
 * LES COULEURS NEUTRES D'UN COURRIEL MÉTIER (D89, 9EZ-LOGO-SOCIETE-2) — même
 * doctrine que `defaut.ts` (ticket L0-09) : des constantes nommées, au seul
 * endroit désigné (`lib/theme/`), jamais recopiées en dur ailleurs.
 *
 * **Ce n'est pas la charte d'une société.** Un courriel métier porte le NOM et
 * le LOGO de la société (D89), jamais ses couleurs — `lib/theme/` ne pose de
 * variables CSS que pour l'application elle-même, et un client de messagerie
 * ignore `<style>` autant que les variables CSS. Ces constantes sont donc le
 * même genre de neutre que `PRIMAIRE_NEUTRE`/`ACCENT_NEUTRE` : un habillage de
 * lisibilité, commun à toutes les sociétés, écrit une seule fois ici.
 */

/** Le fond, hors du cadre blanc de 600 px. */
export const FOND_COURRIEL = "#f3f4f6";

/** Le cadre blanc qui porte le contenu. */
export const SURFACE_COURRIEL = "#ffffff";

/** Le texte courant — titre, paragraphes, raison sociale. */
export const TEXTE_COURRIEL = "#111827";

/** Le texte atténué — le pied, les mentions légales. */
export const TEXTE_ATTENUE_COURRIEL = "#6b7280";

/** Le filet qui sépare le pied du corps. */
export const BORDURE_COURRIEL = "#e5e7eb";

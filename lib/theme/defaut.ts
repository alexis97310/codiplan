/**
 * Le thème NEUTRE de la plateforme (ticket L0-09).
 *
 * Défini une fois, ici, et identifié comme LE DÉFAUT — jamais comme le thème
 * d'une société particulière. C'est ce qui s'applique quand aucune société
 * n'est active (page de connexion, session sans société) et quand une société
 * n'a pas renseigné sa charte : ses colonnes de couleur sont nullables
 * précisément pour que « pas de thème » soit un état possible, plutôt qu'une
 * couleur inventée au moment du provisionnement.
 *
 * Les valeurs sont volontairement des gris ardoise : une société qui n'a pas
 * choisi ses couleurs ne doit pas hériter de celles d'une autre. La charte de
 * CODIMA NC (annexe C du cahier des charges) est celle d'une SOCIÉTÉ ; elle vit
 * dans le seed, pas ici.
 */

/** Couleur d'identité du thème neutre — ardoise, sans appartenance. */
export const PRIMAIRE_NEUTRE = "#334155";

/** Couleur d'accentuation du thème neutre. */
export const ACCENT_NEUTRE = "#64748b";

/**
 * Surface de l'application, sur laquelle se pose le texte courant.
 *
 * Elle n'appartient pas à la société : c'est le fond de l'application, défini
 * par `--background` dans `app/globals.css` (`oklch(1 0 0)`, soit du blanc).
 * Elle est reprise ici en sRGB parce que le calcul de contraste en a besoin —
 * `--societe-primaire-lisible` est la couleur de société rendue lisible SUR
 * cette surface. Changer `--background` sans changer cette valeur ferait
 * mentir le calcul : les deux se lisent ensemble.
 */
export const SURFACE_APPLICATION = "#ffffff";

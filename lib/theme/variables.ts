import type { CSSProperties } from "react";

import type { CouleurDeTheme, ThemeSociete } from "./theme";

/**
 * Le thème d'une société, traduit en variables CSS (ticket L0-09).
 *
 * **C'est le seul mécanisme d'application.** Le serveur pose ces variables sur
 * le document à partir de la société active ; les composants n'écrivent jamais
 * une couleur, ils nomment une variable. Aucun fichier de style propre à une
 * société, aucun nom de société dans le code — deux gardiens statiques le
 * tiennent (`tests/unit/theme/sans-couleur-en-dur.test.ts`).
 *
 * Les noms sont préfixés `--societe-` : ils disent d'où vient la valeur. Les
 * variables de l'application elle-même — surface, bordure, états — restent
 * celles de `app/globals.css` et ne dépendent d'aucune société.
 */

/** Les six variables posées, dans l'ordre où on les lit. */
export const VARIABLES = [
  "--societe-primaire",
  "--societe-primaire-encre",
  "--societe-primaire-lisible",
  "--societe-accent",
  "--societe-accent-encre",
  "--societe-accent-lisible",
] as const;

export type NomVariable = (typeof VARIABLES)[number];

function triplet(
  prefixe: "primaire" | "accent",
  couleur: CouleurDeTheme,
): Record<string, string> {
  return {
    [`--societe-${prefixe}`]: couleur.fond,
    [`--societe-${prefixe}-encre`]: couleur.encre,
    [`--societe-${prefixe}-lisible`]: couleur.lisible,
  };
}

/**
 * Les variables CSS d'un thème, sous la forme d'un style React.
 *
 * Rendu côté serveur — c'est le HTML envoyé qui porte déjà les bonnes couleurs.
 * Aucun script, aucun clignotement au chargement : un technicien sur un réseau
 * lent voit la charte de sa société dès le premier octet peint.
 */
export function variablesCss(theme: ThemeSociete): CSSProperties {
  return {
    ...triplet("primaire", theme.primaire),
    ...triplet("accent", theme.accent),
  } as CSSProperties;
}

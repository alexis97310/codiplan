/**
 * LE MOTIF « une couleur est écrite ici » — écrit UNE fois, lu par deux gardiens.
 *
 * `sans-couleur-en-dur.test.ts` (L0-09) s'en sert pour interdire une couleur
 * dans un composant ; `charte-jetons.test.ts` (charte visuelle) pour l'interdire
 * partout sauf dans la palette. Deux règles, deux périmètres, **une seule
 * lecture du critère** : une seconde implémentation diverge en silence, et
 * personne n'habite l'espace entre les deux (§9 du CLAUDE.md, 01/09).
 *
 * Ce fichier n'est pas un test : il ne porte aucun `describe`. C'est ce qui
 * permet à un gardien d'importer le motif sans faire rejouer les scénarios de
 * l'autre.
 */

/** Palettes nommées de Tailwind — une couleur littérale sous un autre nom. */
const PALETTE = [
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
].join("|");

const UTILITAIRES =
  "bg|text|border|ring|from|via|to|fill|stroke|outline|decoration|shadow|accent|caret|divide|placeholder";

export const MARQUEURS: readonly RegExp[] = [
  // 1. Une couleur hexadécimale, sous n'importe quelle graphie et n'importe
  //    quelle longueur légale — #fff, #ffff, #ffffff, #ffffffff.
  /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9a-fA-F])/,
  // 2. Une notation fonctionnelle, espaces et retours à la ligne compris.
  /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\s*\(/i,
  // 3. Une valeur arbitraire Tailwind qui porte une couleur.
  /\[(?:#|(?:rgba?|hsla?|oklch|color)\s*[(:])/i,
  // 4. Une palette nommée de Tailwind, et le blanc et le noir avec elle.
  new RegExp(`\\b(?:${UTILITAIRES})-(?:${PALETTE})-\\d{2,3}\\b`),
  new RegExp(`\\b(?:${UTILITAIRES})-(?:white|black)\\b`),
  // 5. Une variable de thème réécrite côté navigateur : le thème est posé par
  //    le SERVEUR, depuis la société active. Le reprendre dans le client, c'est
  //    rouvrir la porte du clignotement et celle du contournement.
  /setProperty\s*\(\s*["'`]--societe-/,
];

/** Vrai si le texte porte au moins une couleur écrite en dur. */
export function porteUneCouleur(texte: string): boolean {
  return MARQUEURS.some((marqueur) => marqueur.test(texte));
}

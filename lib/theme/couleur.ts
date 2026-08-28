import { z } from "zod";

/**
 * Couleurs sRGB — lecture, écriture, luminance (ticket L0-09).
 *
 * Le seul module du dépôt où une couleur s'écrit en clair, avec `defaut.ts` :
 * partout ailleurs, une couleur est une DONNÉE de la société ou une variable
 * CSS. Le gardien `tests/unit/theme/sans-couleur-en-dur.test.ts` tient cette
 * frontière.
 *
 * Tout est pur et sans dépendance : la lisibilité se prouve par le calcul, et
 * un calcul ne se prouve qu'avec des fonctions qu'on peut appeler dans un test.
 */

/** Une couleur sRGB, canaux 0–255 entiers — la forme d'un `#rrggbb`. */
export type CouleurSrgb = {
  readonly r: number;
  readonly g: number;
  readonly b: number;
};

/**
 * Forme acceptée d'une couleur saisie : `#rgb` ou `#rrggbb`, casse libre.
 *
 * C'est le SEUL refus à la saisie que ce module prononce, et il ne porte pas
 * sur le goût : une valeur qui n'est pas une couleur sRGB n'est pas une couleur
 * pâle, c'est une donnée cassée. Le contraste, lui, se calcule (D51).
 */
export const MOTIF_HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const schemaCouleurHex = z
  .string()
  .regex(MOTIF_HEX, "Couleur attendue au format #rgb ou #rrggbb.");

/** Vrai si la chaîne est une couleur sRGB écrite en hexadécimal. */
export function estCouleurHex(valeur: string | null | undefined): boolean {
  return typeof valeur === "string" && MOTIF_HEX.test(valeur);
}

/**
 * Forme canonique d'une couleur : minuscules, six chiffres.
 *
 * `#FA0` et `#ffaa00` désignent la même couleur ; les variables CSS posées par
 * le serveur n'en portent qu'une seule écriture, pour qu'un test compare des
 * valeurs et non des graphies.
 */
export function normaliserHex(hex: string): string {
  const brut = hex.trim().toLowerCase();
  if (!MOTIF_HEX.test(brut)) {
    throw new Error(`Couleur invalide : ${hex}`);
  }
  if (brut.length === 4) {
    const [, r, g, b] = brut;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return brut;
}

/** Décompose une couleur hexadécimale en canaux 0–255. */
export function versSrgb(hex: string): CouleurSrgb {
  const canonique = normaliserHex(hex);
  return {
    r: Number.parseInt(canonique.slice(1, 3), 16),
    g: Number.parseInt(canonique.slice(3, 5), 16),
    b: Number.parseInt(canonique.slice(5, 7), 16),
  };
}

/** Recompose une couleur hexadécimale canonique à partir de ses canaux. */
export function versHex(couleur: CouleurSrgb): string {
  const canal = (valeur: number): string =>
    Math.max(0, Math.min(255, Math.round(valeur)))
      .toString(16)
      .padStart(2, "0");
  return `#${canal(couleur.r)}${canal(couleur.g)}${canal(couleur.b)}`;
}

/**
 * Composante linéarisée d'un canal sRGB.
 *
 * Source : WCAG 2.1, définition de la « relative luminance ». Le seuil 0,04045
 * et l'exposant 2,4 sont ceux de la norme, pas une approximation.
 */
function lineariser(canal8Bits: number): number {
  const canal = canal8Bits / 255;
  return canal <= 0.04045
    ? canal / 12.92
    : Math.pow((canal + 0.055) / 1.055, 2.4);
}

/**
 * Luminance relative d'une couleur, entre 0 (noir) et 1 (blanc).
 *
 * `L = 0,2126 R + 0,7152 G + 0,0722 B` sur les canaux linéarisés — WCAG 2.1.
 * Les trois coefficients disent pourquoi un jaune pâle est presque aussi
 * lumineux que du blanc : le vert pèse 71 % de la luminance perçue.
 */
export function luminanceRelative(hex: string): number {
  const { r, g, b } = versSrgb(hex);
  return (
    0.2126 * lineariser(r) + 0.7152 * lineariser(g) + 0.0722 * lineariser(b)
  );
}

/**
 * Rapport de contraste entre deux couleurs, de 1:1 à 21:1.
 *
 * `(L_clair + 0,05) / (L_sombre + 0,05)` — WCAG 2.1. Le 0,05 modélise la
 * lumière ambiante réfléchie par l'écran : c'est lui qui empêche le rapport de
 * partir à l'infini sur un fond noir, et c'est aussi lui qui rend le calcul
 * pertinent pour un technicien qui lit son téléphone au soleil.
 */
export function rapportDeContraste(a: string, b: string): number {
  const la = luminanceRelative(a);
  const lb = luminanceRelative(b);
  const clair = Math.max(la, lb);
  const sombre = Math.min(la, lb);
  return (clair + 0.05) / (sombre + 0.05);
}

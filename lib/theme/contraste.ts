import {
  luminanceRelative,
  rapportDeContraste,
  versHex,
  versSrgb,
  type CouleurSrgb,
} from "./couleur";

/**
 * Lisibilité : le contraste se CALCULE, il ne se suppose pas (ticket L0-09, D51).
 *
 * **Le problème, tel que le ticket le pose.** Un client choisira un jaune pâle
 * comme couleur d'identité, et du texte blanc posé dessus deviendra illisible —
 * dans une application qu'un technicien lit au soleil, sur un écran de
 * téléphone. Deux voies étaient ouvertes : refuser la couleur à la saisie, ou
 * choisir l'encre selon le fond.
 *
 * **La voie retenue est le choix automatique de l'encre**, et c'est un choix
 * qui se démontre plutôt qu'il ne se plaide :
 *
 *   - entre le noir et le blanc, le MEILLEUR des deux ne descend jamais sous
 *     **√21 ≈ 4,58:1** quel que soit le fond sRGB. Le pire fond possible est
 *     celui dont la luminance relative vaut `√(1,05 × 0,05) − 0,05 ≈ 0,179` :
 *     il donne exactement le même rapport contre le noir et contre le blanc, et
 *     c'est le minimum de la fonction. **4,58 > 4,5** — le plancher exigé par
 *     WCAG 2.1, critère 1.4.3 « Contrast (Minimum) », niveau AA, texte courant.
 *     Le choix automatique n'est donc pas une heuristique : c'est une garantie ;
 *   - un refus à la saisie, lui, ne garantit rien de plus et coûte davantage.
 *     La solution est VENDUE : refuser une couleur, c'est refuser l'identité
 *     visuelle d'un client, qui choisira alors « la couleur la plus proche que
 *     le logiciel accepte » ;
 *   - et un refus posé sur un formulaire ne tient que ce formulaire. La couleur
 *     est une donnée : elle arrivera aussi par un import, une reprise, une
 *     migration. Le choix de l'encre, lui, est fait au RENDU — le seul endroit
 *     par où tous les chemins d'écriture passent.
 *
 * **Ce qui reste refusé à la saisie** est d'une autre nature : une valeur qui
 * n'est pas une couleur sRGB (`couleur.ts`, et une contrainte `CHECK` en base).
 * C'est un refus de forme, jamais de teinte.
 *
 * **Ce que le choix de l'encre ne résout pas.** Il traite le texte posé SUR la
 * couleur de société. Il ne dit rien du cas inverse — la couleur de société
 * employée comme ENCRE sur la surface de l'application, où un jaune pâle sur
 * blanc reste illisible. D'où `ajusterPourContraste` : la teinte et la
 * saturation sont conservées, seule la clarté est déplacée jusqu'au seuil. La
 * couleur d'origine, elle, n'est jamais altérée : elle reste le fond.
 *
 * **Et ce déplacement est GARANTI, pas espéré.** Une clarté déplacée n'a aucune
 * garantie a priori — c'est le noir et le blanc qui en ont une. Celle-ci
 * repose sur trois faits, et sur eux seuls :
 *
 *   1. **les extrémités de la clarté HSL sont le noir et le blanc PURS**, quelles
 *      que soient la teinte et la saturation : `C = (1 − |2L − 1|) × S` s'annule
 *      en `L = 0` et en `L = 1`, et `m = L − C/2` y vaut 0 puis 1. La fin de la
 *      course n'est donc pas « une couleur très sombre » : c'est exactement
 *      `#000000` ou `#ffffff` ;
 *   2. **la direction est celle de l'encre lisible du fond**, jamais devinée. La
 *      fin de la course est donc l'encre lisible elle-même, dont le rapport vaut
 *      au moins `PLANCHER_ENCRE` ;
 *   3. **la course atteint toujours son extrémité** : 255 pas de 1/255 depuis
 *      n'importe quelle clarté de [0, 1], bornés.
 *
 * Conséquence, et c'est la garantie : **tout seuil inférieur ou égal à
 * `PLANCHER_ENCRE` est atteint, sur n'importe quel couple couleur/fond.** Le
 * seuil AA de 4,5 en fait partie. Au-delà — 7:1, par exemple — le seuil peut
 * être hors d'atteinte, et `atteint` le dit alors au lieu de le taire ; la
 * frontière est mesurée dans `tests/unit/theme/contraste.test.ts`, qui la
 * trouve exactement où le calcul l'annonce.
 *
 * Le parcours s'arrête au PREMIER pas qui franchit le seuil : la couleur rendue
 * est donc la plus proche de celle du client parmi celles qui sont lisibles.
 */

/**
 * Seuil de contraste du TEXTE COURANT : 4,5:1.
 *
 * Source : WCAG 2.1, critère de succès 1.4.3 « Contrast (Minimum) », niveau AA.
 */
export const SEUIL_TEXTE = 4.5;

/**
 * Seuil du GRAND TEXTE et des ÉLÉMENTS NON TEXTUELS : 3:1.
 *
 * Sources : WCAG 2.1, critère 1.4.3 pour le grand texte (au moins 18,66 px en
 * gras, ou 24 px), et critère 1.4.11 « Non-text Contrast » pour les bordures,
 * pastilles et autres repères graphiques porteurs de sens.
 */
export const SEUIL_NON_TEXTE = 3;

/** Encre sombre — le noir pur maximise le rapport contre un fond clair. */
export const ENCRE_SOMBRE = "#000000";

/** Encre claire — le blanc pur maximise le rapport contre un fond sombre. */
export const ENCRE_CLAIRE = "#ffffff";

/**
 * Luminance du pire fond possible : celui qui contraste aussi mal avec le noir
 * qu'avec le blanc. `√(1,05 × 0,05) − 0,05`.
 */
export const LUMINANCE_PIRE_FOND = Math.sqrt(1.05 * 0.05) - 0.05;

/**
 * Plancher garanti du choix noir/blanc : `√21 ≈ 4,58`.
 *
 * Ce n'est pas une mesure faite sur un échantillon, c'est la valeur de la
 * fonction en son minimum — et `tests/unit/theme/contraste.test.ts` la
 * retrouve par balayage exhaustif des teintes et des clartés. C'est aussi le
 * plafond de ce que `ajusterPourContraste` peut GARANTIR, pour la raison
 * énoncée en tête de module.
 */
export const PLANCHER_ENCRE = Math.sqrt(1.05 / 0.05);

/**
 * L'encre lisible sur un fond donné : noir ou blanc, celle qui contraste le
 * plus. Jamais moins de `PLANCHER_ENCRE`, donc jamais moins que le seuil AA.
 */
export function encreLisible(fond: string): string {
  return rapportDeContraste(ENCRE_CLAIRE, fond) >=
    rapportDeContraste(ENCRE_SOMBRE, fond)
    ? ENCRE_CLAIRE
    : ENCRE_SOMBRE;
}

/** Teinte, saturation et clarté — représentation HSL, canaux 0–1. */
type Hsl = { readonly h: number; readonly s: number; readonly l: number };

function versHsl(couleur: CouleurSrgb): Hsl {
  const r = couleur.r / 255;
  const g = couleur.g / 255;
  const b = couleur.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return { h: 0, s: 0, l };
  }

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) {
    h = ((g - b) / delta) % 6;
  } else if (max === g) {
    h = (b - r) / delta + 2;
  } else {
    h = (r - g) / delta + 4;
  }
  h = (h * 60 + 360) % 360;
  return { h, s, l };
}

function depuisHsl({ h, s, l }: Hsl): CouleurSrgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/** Résultat d'un ajustement de clarté. */
export type Ajustement = {
  /** La couleur retenue — l'originale si elle passait déjà le seuil. */
  readonly couleur: string;
  /** Le rapport de contraste obtenu contre le fond. */
  readonly rapport: number;
  /** Le seuil est-il atteint ? Faux seulement pour un seuil inatteignable. */
  readonly atteint: boolean;
  /** La couleur a-t-elle dû être déplacée ? */
  readonly ajustee: boolean;
};

/**
 * La couleur de société rendue lisible SUR un fond donné, en ne déplaçant que
 * sa clarté — teinte et saturation intactes.
 *
 * L'exploration se fait par pas de 1/255 en clarté HSL, dans la direction qui
 * éloigne du fond (assombrir sur un fond clair, éclaircir sur un fond sombre),
 * et s'arrête au premier pas qui atteint le seuil UNE FOIS LA COULEUR
 * QUANTIFIÉE sur 8 bits — c'est la couleur réellement affichée qu'on mesure,
 * pas son idéal continu.
 *
 * La direction n'est pas devinée : elle est celle de l'encre lisible du fond.
 * Elle garantit qu'à l'extrémité de la course — le noir ou le blanc PUR, voir
 * les trois faits en tête de module — le rapport atteint au moins
 * `PLANCHER_ENCRE`, donc le seuil AA. Un seuil supérieur à ce plancher peut,
 * lui, rester hors d'atteinte : `atteint` le dit alors, et la meilleure couleur
 * trouvée est rendue plutôt qu'une erreur — un thème ne fait jamais échouer un
 * rendu.
 */
export function ajusterPourContraste(
  couleur: string,
  fond: string,
  seuil: number = SEUIL_TEXTE,
): Ajustement {
  const rapportInitial = rapportDeContraste(couleur, fond);
  if (rapportInitial >= seuil) {
    return {
      couleur: versHex(versSrgb(couleur)),
      rapport: rapportInitial,
      atteint: true,
      ajustee: false,
    };
  }

  const depart = versHsl(versSrgb(couleur));
  const versLeSombre = encreLisible(fond) === ENCRE_SOMBRE;
  const pas = 1 / 255;
  let meilleure = versHex(versSrgb(couleur));
  let meilleurRapport = rapportInitial;

  for (let index = 1; index <= 255; index += 1) {
    const clarte = versLeSombre
      ? Math.max(0, depart.l - index * pas)
      : Math.min(1, depart.l + index * pas);
    const candidate = versHex(depuisHsl({ ...depart, l: clarte }));
    const rapport = rapportDeContraste(candidate, fond);
    if (rapport > meilleurRapport) {
      meilleure = candidate;
      meilleurRapport = rapport;
    }
    if (rapport >= seuil) {
      return { couleur: candidate, rapport, atteint: true, ajustee: true };
    }
  }

  return {
    couleur: meilleure,
    rapport: meilleurRapport,
    atteint: false,
    ajustee: true,
  };
}

/** Luminance relative — réexportée ici, la lisibilité étant son seul usage. */
export { luminanceRelative, rapportDeContraste };

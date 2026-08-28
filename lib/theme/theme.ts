import {
  SEUIL_NON_TEXTE,
  SEUIL_TEXTE,
  ajusterPourContraste,
  encreLisible,
  rapportDeContraste,
} from "./contraste";
import { estCouleurHex, normaliserHex } from "./couleur";
import { ACCENT_NEUTRE, PRIMAIRE_NEUTRE, SURFACE_APPLICATION } from "./defaut";

/**
 * Le thème d'une société : des DONNÉES, jamais des constantes de compilation
 * (ticket L0-09).
 *
 * Un client qui achète la solution change ses couleurs sans qu'on redéploie :
 * elles vivent dans les colonnes `societe.couleur_primaire` et
 * `couleur_secondaire` (chapitre 11 §11.2), et ce module les transforme en un
 * thème complet — encres comprises, calculées et non choisies à la main.
 *
 * **Un seul mécanisme.** Aucun fichier de style propre à une société, aucun nom
 * de société dans le code : `variables.ts` en tire des variables CSS que le
 * serveur pose sur le document, et les composants ne connaissent que ces
 * variables.
 *
 * **Le logo est hors périmètre du ticket, et rien ne l'empêche.** La colonne
 * `societe.logo_url` existe déjà ; ce qui manque est un stockage de fichiers,
 * qui est une décision d'architecture à part entière (registre des arbitrages).
 * Le jour où elle sera prise, le logo entrera par le même chemin que les
 * couleurs : une colonne de plus lue ici, une variable de plus posée là.
 */

/** Les colonnes de `societe` dont un thème est fait. */
export type SourceTheme = {
  readonly raison_sociale: string;
  readonly couleur_primaire: string | null;
  readonly couleur_secondaire: string | null;
};

/** D'où viennent les couleurs appliquées. */
export type OrigineTheme = "societe" | "defaut";

/** Une couleur de société et les deux encres calculées qui vont avec. */
export type CouleurDeTheme = {
  /** La couleur telle que la société l'a choisie, sous sa forme canonique. */
  readonly fond: string;
  /** Noir ou blanc : l'encre lisible POSÉE SUR cette couleur (≥ 4,5:1). */
  readonly encre: string;
  /** Rapport de contraste obtenu entre `fond` et `encre`. */
  readonly rapportEncre: number;
  /**
   * La même couleur, rendue lisible EN TANT QU'ENCRE sur la surface de
   * l'application — teinte et saturation conservées, clarté déplacée.
   */
  readonly lisible: string;
  /** Rapport obtenu par `lisible` sur la surface de l'application. */
  readonly rapportLisible: number;
};

/** Le thème appliqué à un rendu. */
export type ThemeSociete = {
  readonly origine: OrigineTheme;
  /** Nom affiché — la raison sociale de la société, ou le nom du produit. */
  readonly nom: string;
  readonly primaire: CouleurDeTheme;
  readonly accent: CouleurDeTheme;
};

/** Nom porté par le thème neutre. Le produit, pas une société. */
export const NOM_NEUTRE = "CODIPLAN";

function couleurDeTheme(hex: string, seuilLisible: number): CouleurDeTheme {
  const fond = normaliserHex(hex);
  const encre = encreLisible(fond);
  const lisible = ajusterPourContraste(fond, SURFACE_APPLICATION, seuilLisible);
  return {
    fond,
    encre,
    rapportEncre: rapportDeContraste(fond, encre),
    lisible: lisible.couleur,
    rapportLisible: lisible.rapport,
  };
}

/**
 * Le thème neutre de la plateforme. Construit une fois, à l'import.
 *
 * C'est LE défaut : il n'est le thème d'aucune société, et son `origine` le
 * dit — un rendu peut ainsi signaler « société sans charte » sans avoir à
 * comparer des couleurs.
 */
export const THEME_DEFAUT: ThemeSociete = {
  origine: "defaut",
  nom: NOM_NEUTRE,
  primaire: couleurDeTheme(PRIMAIRE_NEUTRE, SEUIL_TEXTE),
  accent: couleurDeTheme(ACCENT_NEUTRE, SEUIL_TEXTE),
};

/**
 * Construit le thème d'une société.
 *
 * Trois cas mènent au thème neutre, et un seul mécanisme les traite : aucune
 * société active (`null`), une charte non renseignée, une valeur qui n'est pas
 * une couleur sRGB. Le dernier cas ne devrait pas exister — une contrainte
 * `CHECK` le refuse en base — mais une reprise de données ou une restauration
 * n'en passe pas moins par ici : un thème ne fait jamais échouer un rendu.
 *
 * Les deux couleurs sont indépendantes : une société qui n'a renseigné que sa
 * couleur primaire garde l'accent du thème neutre, plutôt que de perdre sa
 * couleur principale pour une couleur manquante.
 */
export function themeDeSociete(source: SourceTheme | null): ThemeSociete {
  if (source === null) {
    return THEME_DEFAUT;
  }

  const primaire = source.couleur_primaire;
  const accent = source.couleur_secondaire;

  if (!estCouleurHex(primaire) && !estCouleurHex(accent)) {
    // Charte absente : la société reçoit le thème neutre, sous son propre nom.
    return { ...THEME_DEFAUT, nom: source.raison_sociale };
  }

  return {
    origine: "societe",
    nom: source.raison_sociale,
    primaire:
      primaire !== null && estCouleurHex(primaire)
        ? couleurDeTheme(primaire, SEUIL_TEXTE)
        : THEME_DEFAUT.primaire,
    accent:
      accent !== null && estCouleurHex(accent)
        ? couleurDeTheme(accent, SEUIL_TEXTE)
        : THEME_DEFAUT.accent,
  };
}

/**
 * Vrai si toutes les paires de couleurs du thème atteignent leur seuil.
 *
 * Le choix de l'encre garantit déjà 4,5:1 sur les fonds (voir `contraste.ts`) ;
 * cette fonction sert aux tests et à un futur écran de paramétrage, qui pourra
 * AVERTIR — jamais refuser — sur une couleur dont la variante lisible s'écarte
 * beaucoup de la teinte d'origine.
 */
export function themeLisible(theme: ThemeSociete): boolean {
  return [theme.primaire, theme.accent].every(
    (couleur) =>
      couleur.rapportEncre >= SEUIL_TEXTE &&
      couleur.rapportLisible >= SEUIL_NON_TEXTE,
  );
}

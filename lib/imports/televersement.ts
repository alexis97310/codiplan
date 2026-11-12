/**
 * CE QU'UN TÉLÉVERSEMENT DOIT ÊTRE AVANT D'ÊTRE LU (L1-11).
 *
 * ## Pourquoi ce module existe plutôt qu'un `if` dans la route
 *
 * Une route de Next.js n'expose que ses verbes ; **tout ce qu'on y écrirait
 * serait inéprouvable sans démarrer un serveur**. Les refus d'un téléversement
 * sont pourtant exactement ce qu'il faut éprouver : ce sont eux qu'un fichier
 * hostile ou mal choisi rencontre en premier.
 *
 * ## Il ne lit AUCUN classeur
 *
 * Il rend des octets, et rien d'autre. *La grammaire de D31 vit dans
 * `lib/excel/`, et une seconde règle d'acceptation écrite ici la doublerait* —
 * c'est `controlerFeuille` qui dit si un fichier est le bon, par son marqueur.
 * Ce module dit seulement s'il y a quelque chose à lui donner à lire.
 */

/**
 * LE PLAFOND DE TAILLE, et il est écrit avec sa mesure.
 *
 * **Le classeur réel de CODIMA pesait 59 642 octets.** C'était la mesure de
 * `tests/fixtures/dates-excel.xlsx` tant que cette fixture était tirée par
 * retrait du fichier de l'exploitation (D90). **Décision d'Alexis du
 * 10/11/2026 (D244, 9L00)** : cette fixture est désormais entièrement
 * inventée, pour ne plus porter aucune date réelle (I9) — elle ne mesure donc
 * plus la taille d'un classeur de reprise, et la borne ci-dessous n'est plus
 * rapportée à elle. Un classeur garni de données réelles reste malgré tout du
 * même ordre que 59 642 octets : un `.xlsx` est une archive compressée de
 * texte, et c'est cet ordre de grandeur, mesuré une fois, que la borne garde.
 *
 * **Vingt mébioctets.** Ce n'est pas une estimation de ce qu'un client
 * enverra : c'est la borne au-delà de laquelle on sait qu'il ne s'agit plus
 * d'un classeur de reprise. *Une borne posée sans mesure serait un chiffre
 * inventé (§8)* ; celle-ci s'adosse à la seule mesure qu'un fichier réel ait
 * jamais rendue à ce projet, conservée ici plutôt que perdue avec le fichier.
 *
 * **Condition de réouverture, vérifiable** : le premier refus d'un fichier que
 * l'exploitation reconnaît pour un classeur légitime.
 */
export const MAXIMUM_OCTETS = 20 * 1024 * 1024;

/**
 * La longueur maximale du nom repris dans le rapport. `nom_fichier` est une
 * colonne de texte sans borne en base ; *un nom de trois mille caractères
 * casserait la mise en page d'une liste avant de casser quoi que ce soit
 * d'autre*, et le tronquer en silence ferait perdre la fin de l'extension.
 */
export const MAXIMUM_NOM = 255;

/**
 * LES MOTIFS DE REFUS, et ce sont des CODES, jamais du texte.
 *
 * Les libellés sont au dictionnaire (L0-11) : *ce qu'un humain lit en se
 * servant de l'application y passe*, et un module de validation ne le sait pas.
 */
export const MOTIF_TELEVERSEMENT = {
  absent: "absent",
  vide: "vide",
  trop_gros: "trop_gros",
  extension: "extension",
  sansFeuille: "sans_feuille",
  illisible: "illisible",
} as const;

export type MotifTeleversement =
  (typeof MOTIF_TELEVERSEMENT)[keyof typeof MOTIF_TELEVERSEMENT];

export type ClasseurTeleverse =
  | { readonly accepte: false; readonly motif: MotifTeleversement }
  | {
      readonly accepte: true;
      readonly nom: string;
      readonly octets: Buffer;
    };

/**
 * L'extension attendue. **`.xlsx` UNIQUEMENT, jamais de CSV** — c'est le §2 de
 * la constitution, et la raison est dans `lib/excel/classeur.ts` : *un CSV n'a
 * ni type de cellule ni feuille, et toute la grammaire de D31 repose sur les
 * deux.*
 *
 * **Le contrôle porte sur le NOM, et il ne garantit rien du contenu** — c'est
 * écrit plutôt que sous-entendu. Un `.xlsx` renommé depuis autre chose passe
 * ici et échoue à la lecture, ce qui est le bon ordre : *le refus par
 * l'extension évite de lire un fichier dont l'auteur nous dit lui-même qu'il
 * n'est pas un classeur ; il ne prétend pas valider ceux qui restent.*
 */
const EXTENSION = ".xlsx";

/**
 * Valide un téléversement et rend ses octets.
 *
 * **Il prend `unknown`, et c'est délibéré** : ce qui sort d'un `FormData` est
 * un `File`, une chaîne, ou rien — trois formes qu'un appelant ne choisit pas.
 * *Exiger un `File` obligerait la route à faire le tri, c'est-à-dire à écrire
 * la moitié de ce module dans un endroit où rien ne l'éprouve.*
 */
export async function lireLeTeleversement(
  valeur: unknown,
): Promise<ClasseurTeleverse> {
  if (!(valeur instanceof File)) {
    return { accepte: false, motif: MOTIF_TELEVERSEMENT.absent };
  }
  const nom = valeur.name.trim();
  if (!nom.toLowerCase().endsWith(EXTENSION)) {
    return { accepte: false, motif: MOTIF_TELEVERSEMENT.extension };
  }
  // **La taille est lue AVANT les octets**, et l'ordre est la garantie : lire
  // d'abord puis mesurer ferait entrer en mémoire exactement ce qu'on voulait
  // refuser. *Un plafond appliqué après coup n'est pas un plafond.*
  if (valeur.size > MAXIMUM_OCTETS) {
    return { accepte: false, motif: MOTIF_TELEVERSEMENT.trop_gros };
  }
  if (valeur.size === 0) {
    return { accepte: false, motif: MOTIF_TELEVERSEMENT.vide };
  }
  return {
    accepte: true,
    nom: nom.slice(0, MAXIMUM_NOM),
    octets: Buffer.from(await valeur.arrayBuffer()),
  };
}

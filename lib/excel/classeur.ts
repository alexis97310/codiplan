import readXlsxFile from "read-excel-file/node";

import { EPOQUE_MS, type Cellule } from "./format";

/**
 * LA LIAISON AU CLASSEUR (ticket L1-08c ; D31, D90).
 *
 * ## CE MODULE NE PORTE AUCUNE RÈGLE, ET C'EST TOUT SON OBJET
 *
 * L1-08a a écrit la grammaire des imports **sur une grille de cellules
 * abstraite**, sans dépendance et sans classeur, en énonçant ce qu'elle
 * garantissait : *« le jour où la liaison arrive, elle n'a aucune règle à
 * porter — elle rend une grille, et tout ce qui suit est déjà écrit et
 * éprouvé. »* Ce module est ce jour-là, et il tient cette promesse : il
 * transpose des valeurs, il n'interprète rien.
 *
 * **Le zéro ne s'écarte pas ici.** `read-excel-file` rend
 * `1899-12-30T00:00:00.000Z` pour une cellule à zéro — *une date parfaitement
 * formée, et parfaitement fausse* —, et 171 cellules du classeur réel de CODIMA
 * sont dans ce cas. La liaison la transpose en série `0`, et c'est `lireDate`
 * qui la range en absence. Écarter ici aurait mis une règle métier dans le
 * transport, où personne ne la relit.
 *
 * ## POURQUOI UN NUMÉRO DE SÉRIE PLUTÔT QU'UNE DATE
 *
 * La bibliothèque rend un `Date`. La grammaire attend une **série**. Le sens de
 * la conversion n'est pas indifférent : la série est ce que le classeur STOCKE,
 * et c'est sur elle que portent les trois refus de D31 — le sérial fractionnaire
 * (une date avec une heure), le sérial 60 (le 29 février 1900 qui n'a jamais
 * existé), et toute la plage antérieure au 1ᵉʳ mars 1900. **Passer un `Date`
 * directement les rendrait tous les trois inexprimables**, parce qu'un `Date`
 * est déjà une date valide : il a perdu ce qui permettait de la refuser.
 *
 * *Mesuré le 10/09/2026 sur un vrai fichier d'Excel, sous trois fuseaux dont
 * `Pacific/Noumea` : les dates rendues sont des instants UTC à minuit,
 * identiques d'un fuseau à l'autre (D90, `tests/unit/excel/fixture-dates.test.ts`).
 * La division ci-dessous est donc exacte, et elle ne dépend pas du fuseau du
 * serveur — ce qui est la seule propriété dont ce module a besoin.*
 *
 * ## CE QU'IL NE FAIT PAS
 *
 * **Il ne choisit aucune feuille et n'apparie aucune colonne.** Il rend toutes
 * les feuilles, dans l'ordre du classeur, et l'appelant nomme celle qu'il veut.
 * Un module de transport qui saurait quelle feuille compte serait un module de
 * transport qui connaît le métier.
 *
 * **Il ne lit aucun fichier depuis le réseau.** Le chemin lui est donné.
 */

/** Une feuille du classeur : son nom, et sa grille de cellules. */
export type FeuilleLue = {
  readonly nom: string;
  /** Les lignes, chacune un tableau de cellules. `undefined` = cellule vide. */
  readonly lignes: readonly (readonly (Cellule | undefined)[])[];
};

/** Un jour entier, en millisecondes. */
const JOUR_MS = 86_400_000;

/**
 * Transpose UNE valeur rendue par la bibliothèque en `Cellule` de la grammaire.
 *
 * **Exportée pour être éprouvée seule.** C'est la seule décision de ce module,
 * et une conversion qu'on ne peut pas interroger cellule par cellule est une
 * conversion qu'on croit sur parole.
 */
export function celluleDepuisValeur(valeur: unknown): Cellule | undefined {
  if (valeur === null || valeur === undefined) {
    return undefined;
  }
  if (valeur instanceof Date) {
    // Le chemin inverse de `lireDate`, et il passe par la même époque — jamais
    // par une constante recopiée ici.
    return { serie: (valeur.getTime() - EPOQUE_MS) / JOUR_MS };
  }
  if (typeof valeur === "number") {
    return { nombre: valeur };
  }
  if (typeof valeur === "string") {
    // Aucun élagage : `apparierColonnes` et `lireNombre` élaguent eux-mêmes, et
    // élaguer deux fois ne se voit pas — jusqu'au jour où l'une des deux change.
    return { texte: valeur };
  }
  if (typeof valeur === "boolean") {
    // **Un booléen n'a pas de forme convenue dans un import CODIPLAN**, et ce
    // module n'en invente pas : il rend le texte que le classeur montrerait, et
    // c'est la grammaire qui dira ce qu'elle sait en faire — aujourd'hui, rien.
    return { texte: String(valeur) };
  }
  // Tout le reste — une formule non évaluée, un objet d'erreur — est traité
  // comme une cellule VIDE plutôt que deviné. `lireDate` et `lireNombre`
  // rendront `cellule_vide`, ce qui est exact : il n'y a rien de lisible.
  return undefined;
}

/**
 * Lit un classeur `.xlsx` et rend ses feuilles.
 *
 * **`.xlsx` uniquement, jamais de CSV** (§2 de la constitution) : un CSV n'a ni
 * type de cellule ni feuille, et toute la grammaire de D31 repose sur les deux.
 */
export async function lireClasseur(
  chemin: string,
): Promise<readonly FeuilleLue[]> {
  // UN SEUL appel, et il rend TOUTES les feuilles : c'est ce que la version
  // 9.3.10 fait, et c'est ce que la mesure du 10/09 a exercé
  // (`tests/unit/excel/fixture-dates.test.ts` lit `{ sheet, data }`). Rouvrir
  // le fichier par feuille aurait relu l'archive autant de fois qu'elle en
  // porte — 6 fois sur le classeur réel de CODIMA.
  const feuilles = await readXlsxFile(chemin);
  return feuilles.map((feuille) => ({
    nom: feuille.sheet,
    lignes: feuille.data.map((ligne) => ligne.map(celluleDepuisValeur)),
  }));
}

/**
 * La feuille NOMMÉE, ou `null`.
 *
 * L'appariement est **exact après élagage**, comme celui des colonnes — et pour
 * la même raison, ratifiée le 09/09/2026 : *une tolérance choisit à la place de
 * celui qui a écrit le fichier, et un import de masse est précisément le moment
 * où l'on ne veut pas qu'un outil devine.*
 */
export function feuilleNommee(
  feuilles: readonly FeuilleLue[],
  nom: string,
): FeuilleLue | null {
  const cible = nom.trim();
  return feuilles.find((feuille) => feuille.nom.trim() === cible) ?? null;
}

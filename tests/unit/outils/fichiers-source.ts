import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Parcours des sources du dépôt, pour les gardiens statiques (L0-06).
 *
 * Deux règles du ticket ne se prouvent pas en exécutant du code : « aucun rôle
 * en chaîne libre nulle part » et « aucun chemin hors `lib/reporting` n'utilise
 * la connexion de consolidation ». Elles se prouvent en lisant le dépôt. Ce
 * module fournit la lecture ; les deux tests fournissent la règle.
 */

/** Racine du dépôt, déduite de l'emplacement de ce fichier. */
export const RACINE = join(import.meta.dirname, "..", "..", "..");

const IGNORES = new Set([
  "node_modules",
  ".git",
  ".next",
  "out",
  "build",
  "coverage",
  "playwright-report",
  "test-results",
]);

const EXTENSIONS = [".ts", ".tsx", ".mts"];

/** Un fichier source, chemin relatif à la racine et contenu. */
export type FichierSource = {
  /** Chemin relatif, toujours en séparateurs `/`. */
  chemin: string;
  contenu: string;
};

function parcourir(repertoire: string, resultat: FichierSource[]): void {
  for (const entree of readdirSync(repertoire)) {
    if (IGNORES.has(entree)) {
      continue;
    }
    const complet = join(repertoire, entree);
    if (statSync(complet).isDirectory()) {
      parcourir(complet, resultat);
      continue;
    }
    if (!EXTENSIONS.some((extension) => entree.endsWith(extension))) {
      continue;
    }
    resultat.push({
      chemin: relative(RACINE, complet).split(sep).join("/"),
      contenu: readFileSync(complet, "utf8"),
    });
  }
}

/**
 * Tous les fichiers TypeScript des répertoires demandés.
 *
 * Le SQL des migrations est délibérément hors périmètre : la base a son propre
 * garde-fou, le type PostgreSQL `"Role"`, qui fait échouer une valeur inventée
 * à l'application de la migration.
 */
export function fichiersSource(
  repertoires: readonly string[],
): FichierSource[] {
  const resultat: FichierSource[] = [];
  for (const repertoire of repertoires) {
    parcourir(join(RACINE, repertoire), resultat);
  }
  return resultat;
}

/**
 * Le même code, commentaires retirés (ticket L0-08).
 *
 * **Pourquoi les gardiens en ont besoin.** Trois règles du ticket L0-08 se
 * prouvent en cherchant des motifs dans les sources : un identifiant de fuseau,
 * une date fériée, un accesseur local de `Date`. Or la documentation du module
 * calendrier CITE ces motifs — c'est même ce qui la rend lisible : « ex.
 * Pacific/Noumea », « jamais par getDay() ». Un gardien qui lirait le texte
 * brut échouerait donc sur les commentaires qui expliquent la règle, et la
 * seule façon de le faire passer serait d'appauvrir la documentation. C'est
 * l'inverse de ce qu'on veut.
 *
 * Un commentaire ne peut pas coder en dur un fuseau : il n'est pas exécuté.
 * Le retirer avant l'analyse n'affaiblit donc aucun des trois gardiens.
 *
 * **Le `//` d'une URL est épargné** : `https://…` n'ouvre pas un commentaire.
 * L'analyse reste volontairement grossière — elle ne cherche pas à comprendre
 * TypeScript, seulement à ne pas confondre prose et code — et elle est éprouvée
 * sur des cas fabriqués par le gardien qui s'en sert.
 */
export function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "\n")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
}

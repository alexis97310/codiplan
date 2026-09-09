import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { RACINE } from "./fichiers-source";

/**
 * Lecture du SQL des migrations, pour les gardiens statiques qui l'inspectent.
 *
 * Deux gardiens s'en servent, et pour des règles sans rapport : D50 y cherche
 * une fonction `SECURITY DEFINER` (`security-definer-sous-arbitrage.test.ts`),
 * L0-10 y cherche les tables qui portent le déclencheur d'audit
 * (`perimetre-audit.test.ts`). Ils partagent la LECTURE, jamais la règle —
 * c'est le même principe que `schema-prisma.ts` : ce module fournit la matière,
 * le test fournit le verdict.
 */

/** Le SQL des migrations : le seul endroit du dépôt qui crée un objet en base. */
const MIGRATIONS = join(RACINE, "prisma", "migrations");

/** Un fichier de migration, chemin relatif et contenu SQL. */
export type Migration = { chemin: string; sql: string };

/** Toutes les migrations du dépôt, dans l'ordre de leur nom — donc du temps. */
export function migrationsSql(): Migration[] {
  return readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((entree) => entree.isDirectory())
    .map((entree) => ({
      chemin: `prisma/migrations/${entree.name}/migration.sql`,
      sql: readFileSync(join(MIGRATIONS, entree.name, "migration.sql"), "utf8"),
    }));
}

/**
 * Retire du SQL ce qui DOCUMENTE, pour ne garder que ce qui S'EXÉCUTE.
 *
 * **La coupure n'est pas « commentaires », c'est « documentation contre
 * exécution »** (§9, 26/08, forme 2). Deux choses sont retirées, et deux
 * seulement : les commentaires `--`, qui ne s'exécutent jamais, et les
 * instructions `COMMENT ON … IS '…'`, qui ne créent rien. **Tout le reste est
 * examiné, y compris les chaînes littérales** : la faute écrite dans un bloc
 * `DO $$ … $$` ou dans un `EXECUTE '…'` s'exécute, donc elle se lit.
 *
 * Le motif de `COMMENT ON` va jusqu'à la chaîne fermante plutôt qu'au premier
 * `;` : un point-virgule à l'intérieur du texte couperait sinon l'instruction
 * en deux et laisserait sa fin dans le périmètre examiné. Les quotes doublées
 * de SQL sont prises en compte.
 *
 * **Elle a UNE maison depuis le 09/09/2026.** Elle en avait trois — la même
 * fonction recopiée dans `perimetre-audit`, dans `security-definer-sous-
 * arbitrage`, et sur le point de l'être une troisième fois par le gardien de
 * D85. C'est la divergence silencieuse du §9 (01/09) : trois lectures d'un
 * même critère, chacune verte, que rien ne confrontait.
 */
export function sansCommentairesSql(sql: string): string {
  return sql
    .split("\n")
    .map((ligne) => ligne.replace(/--.*$/, ""))
    .join("\n")
    .replace(/comment\s+on\b[^']*'(?:[^']|'')*'\s*;/gi, "");
}

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

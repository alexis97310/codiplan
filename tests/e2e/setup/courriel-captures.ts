import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * LE CHEMIN DU JOURNAL DES ENVOIS INTERCEPTÉS (AVERTISSEMENTS-1) — un module
 * à PART, jamais lu depuis `playwright.config.ts` : le config est chargé par
 * un mécanisme distinct de celui des fichiers de scénario, et les deux ne se
 * réimportent pas l'un l'autre (mesuré : `exports is not defined in ES
 * module scope`, la double compilation du même fichier par deux chemins).
 *
 * `playwright.config.ts` ET `tests/e2e/setup/double-courriel.cjs` (via
 * `process.env`) ET `avertissements-1.spec.ts` s'accordent sur ce SEUL
 * fichier pour ne jamais diverger sur le chemin.
 */
export const FICHIER_COURRIELS_CAPTURES = join(
  tmpdir(),
  "codiplan-e2e-courriels.jsonl",
);

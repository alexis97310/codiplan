import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RACINE } from "../outils/fichiers-source";

/**
 * LE CONTRÔLE DE CLOISONNEMENT ATTEND LE RÉVEIL DE LA BASE
 * (9CR-CI-CLOISONNEMENT-CONNEXION).
 *
 * Gardien statique sur le SOURCE du script : il lit le fichier, il ne peut
 * pas dire ce qu'une exécution réelle fera. Deux exigences, et aucune n'est
 * un détail d'implémentation à relâcher :
 *   — l'URL de connexion passe par `avecDelaiDeConnexion` avant toute
 *     connexion, sans quoi le délai de 30 s n'existe que dans l'intention ;
 *   — aucun `console.log` : la sortie du script passe par
 *     `process.stdout.write` (CLAUDE.md §5), et un `console.log` ajouté pour
 *     déboguer un délai de connexion est précisément le genre de ligne qui
 *     finit par y faire passer une URL.
 */
const SOURCE = readFileSync(
  join(RACINE, "scripts", "controle-cloisonnement.mts"),
  "utf8",
);

/**
 * Les lignes EXÉCUTABLES — jamais celles d'un commentaire. Le fichier NOMME
 * la règle qu'il respecte (« `console.log` est banni ») dans sa propre
 * documentation : une recherche qui ne couperait pas les commentaires
 * rougirait sur sa propre note, exactement comme `url-hors-journal.test.ts`
 * l'a appris le premier jour (§9, « documentation contre exécution »).
 */
function executables(): string {
  return SOURCE.split("\n")
    .filter((ligne) => {
      const t = ligne.trim();
      return !t.startsWith("*") && !t.startsWith("//") && t !== "/**";
    })
    .join("\n");
}

describe("controle-cloisonnement.mts", () => {
  it("passe l'URL applicative par avecDelaiDeConnexion", () => {
    expect(SOURCE).toContain("avecDelaiDeConnexion(");
  });

  it("ne contient aucun console.log exécutable", () => {
    expect(executables()).not.toContain("console.log");
  });
});

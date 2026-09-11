import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { MIGRATIONS_ATTENDUES } from "../../../lib/db/migrations-attendues";

/**
 * LA LISTE DES MIGRATIONS ATTENDUES CONTRE LE RÉPERTOIRE RÉEL (panne du
 * 11/09/2026).
 *
 * ## Ce qu'il confronte, et pourquoi la recopie était inévitable
 *
 * Le code déployé ne peut pas lire `prisma/migrations/` — le répertoire n'est
 * pas embarqué dans le paquet de production —, si bien que `/sante` a besoin
 * d'une liste écrite. *Le test à faire passer à toute duplication qui se
 * prétend inévitable : **qu'est-ce qui confronterait les deux copies ?*** (§9,
 * 01/09). C'est ce fichier, et il lit une source que le module ne contrôle pas.
 *
 * ## ⚠ IL A MORDU À SA PREMIÈRE EXÉCUTION
 *
 * La liste avait été **rédigée de mémoire** : *18 noms inventés, 36 manquants,
 * sur 47 répertoires réels.* C'est la faute que la panne elle-même illustre —
 * affirmer un état observable au lieu de l'observer —, commise en la réparant.
 * **Elle n'a coûté qu'une exécution parce que la confrontation existait avant
 * la liste.**
 *
 * ## Les deux sens, et le second est celui qu'on oublie
 *
 * Une migration **ajoutée** au dépôt et absente d'ici : `/sante` cesserait de
 * la réclamer, et la panne du 11/09 se rejouerait à l'identique. Une entrée
 * **qui ne s'adosse à rien** : `/sante` réclamerait pour toujours une migration
 * qui n'existe pas, et la page dirait « non » sans qu'aucun geste puisse la
 * satisfaire — *une alarme qu'on ne peut pas éteindre s'apprend à ignorer*
 * (§9, 11/09).
 */

const RACINE = "prisma/migrations";

/** Les répertoires de migration réellement présents. */
function repertoires(): string[] {
  return readdirSync(RACINE)
    .filter((nom) => statSync(join(RACINE, nom)).isDirectory())
    .sort();
}

describe("les migrations attendues par le code déployé", () => {
  it("PARCOURT bien le répertoire — sinon le gardien serait vide", () => {
    // *Deux listes vides sont égales* (§9, 10/09) : sans ce témoin, un chemin
    // devenu faux rendrait la comparaison verte sur rien.
    expect(repertoires().length).toBeGreaterThan(10);
    expect(MIGRATIONS_ATTENDUES.length).toBeGreaterThan(10);
  });

  it("sont EXACTEMENT celles du répertoire, et dans le même ORDRE", () => {
    // L'ordre compte : c'est celui où Prisma les applique, et il rend le
    // rapport lisible quand plusieurs manquent — *la première manquante est
    // celle par laquelle la base a décroché.*
    expect([...MIGRATIONS_ATTENDUES]).toEqual(repertoires());
  });

  it("ÉPREUVE — une migration ajoutée au dépôt et non inscrite est refusée", () => {
    // La faute telle qu'elle se commettra : quelqu'un crée une migration et ne
    // pense pas à cette liste. On rejoue le verdict sur la population fautive,
    // sans toucher au dépôt.
    const ajoutee = [...repertoires(), "20991231235959_oubliee"].sort();
    expect([...MIGRATIONS_ATTENDUES]).not.toEqual(ajoutee);
  });

  it("ÉPREUVE — une entrée qui ne s'adosse à aucun répertoire est refusée", () => {
    // Le sens qu'on oublie : `/sante` réclamerait pour toujours une migration
    // qui n'existe pas.
    const inventee = [...MIGRATIONS_ATTENDUES, "20260101000000_fantome"].sort();
    expect(inventee).not.toEqual(repertoires());
  });
});

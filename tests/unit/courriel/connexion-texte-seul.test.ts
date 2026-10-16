import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RACINE } from "../outils/fichiers-source";

/**
 * LES COURRIELS DE CONNEXION RESTENT EN TEXTE SEUL, POUR TOUJOURS (D89,
 * 9EZ-LOGO-SOCIETE-2).
 *
 * Q8 amendée (D89, `lib/courriel/message.ts`) ouvre `CourrielMetier` aux
 * SEULS courriels métier. Les trois modules qui composent un courriel de
 * CONNEXION — premier accès, nouveau lien (D86), réinitialisation — ne doivent
 * JAMAIS emprunter cette porte : un gardien statique plutôt qu'une relecture,
 * parce qu'un import oublié ne se voit pas à l'écran d'un courriel qui part
 * quand même en texte.
 */

const FICHIERS_CONNEXION = [
  join(RACINE, "lib", "courriel", "premier-acces.ts"),
  join(RACINE, "lib", "auth", "lien-d-acces.ts"),
  join(RACINE, "lib", "auth", "config.ts"),
];

describe("les modules de connexion n'empruntent jamais la porte métier", () => {
  it("la population n'est pas vide", () => {
    expect(FICHIERS_CONNEXION.length).toBe(3);
  });

  for (const fichier of FICHIERS_CONNEXION) {
    it(`${fichier.split("/").slice(-2).join("/")} n'importe ni CourrielMetier ni envoyerCourrielMetier`, () => {
      const source = readFileSync(fichier, "utf8");
      expect(source).not.toMatch(/\bCourrielMetier\b/);
      expect(source).not.toMatch(/\benvoyerCourrielMetier\b/);
      expect(source).not.toMatch(/\bmiseEnPage\b/);
    });
  }
});

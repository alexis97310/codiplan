import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RACINE } from "../outils/fichiers-source";

/**
 * L'ÉTAPE « Décrire les connexions (sans secret) » EST CÂBLÉE AVANT LE
 * CONTRÔLE (9CR-CI-CLOISONNEMENT-CONNEXION).
 *
 * Gardien statique : il lit le fichier du flux, il ne peut pas dire ce qu'un
 * exécuteur fera. Ce que ce lot ajoute précède « Contrôle de cloisonnement »,
 * qui reste la seule étape qui échoue la cible.
 */
const FLUX = join(RACINE, ".github", "workflows", "db-migrate.yml");

function flux(): string {
  return readFileSync(FLUX, "utf8");
}

describe("db-migrate.yml décrit les connexions avant de les contrôler", () => {
  it("la nouvelle étape précède « Contrôle de cloisonnement »", () => {
    const texte = flux();
    const decrire = texte.indexOf(
      "- name: Décrire les connexions (sans secret)",
    );
    const controle = texte.indexOf("- name: Contrôle de cloisonnement");
    expect(decrire, "l'étape n'existe pas").toBeGreaterThan(0);
    expect(controle, "le contrôle n'existe plus").toBeGreaterThan(0);
    expect(decrire).toBeLessThan(controle);
  });

  it("joue scripts/decrire-connexions.mts", () => {
    expect(flux()).toContain("pnpm exec tsx scripts/decrire-connexions.mts");
  });

  it("reçoit les DEUX URL, migration et applicative", () => {
    const texte = flux();
    const debut = texte.indexOf("- name: Décrire les connexions (sans secret)");
    const fin = texte.indexOf("- name:", debut + 10);
    const bloc = texte.slice(debut, fin === -1 ? undefined : fin);
    expect(bloc).toContain("URL_MIGRATION");
    expect(bloc).toContain("URL_APPLICATIVE");
  });

  it("ne lit AUCUN secret directement — elle hérite des variables déjà choisies", () => {
    // Le choix du secret se fait une fois, à l'étape « Choisir la base » ;
    // cette étape ne doit pas relire `secrets.` une seconde fois (§9, 01/09).
    const texte = flux();
    const debut = texte.indexOf("- name: Décrire les connexions (sans secret)");
    const fin = texte.indexOf("- name:", debut + 10);
    const bloc = texte.slice(debut, fin === -1 ? undefined : fin);
    expect(bloc).not.toContain("secrets.");
  });
});

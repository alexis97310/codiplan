import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  APPARENCES,
  JETONS,
  variableDuJeton,
  type Jeton,
} from "@/lib/theme/apparence";

import { RACINE } from "../outils/fichiers-source";

const STYLE = readFileSync(join(RACINE, "app", "globals.css"), "utf8");

/**
 * DEUX APPARENCES, ET C'EST CE QUI ÉPROUVE LE MÉCANISME (R2-01, D95).
 *
 * **Tant qu'il n'y en avait qu'une, la promesse de D95 n'était pas mesurable.**
 * *« Ajouter un thème, c'est un bloc de style et une entrée de liste, et aucun
 * écran à rouvrir »* — on ne pouvait ni le vérifier ni le démentir. C'est
 * l'espèce du §9 (08/09) : un défaut invisible parce que ce qu'il casserait
 * n'existe pas encore.
 *
 * Ces scénarios mesurent les deux moitiés de cette phrase, et la seconde est
 * celle qui compte.
 */

/** Le bloc de déclarations d'une apparence, extrait de la feuille de style. */
function blocDe(apparence: string): string {
  const debut = STYLE.indexOf(`[data-apparence="${apparence}"]`);
  if (debut === -1) {
    return "";
  }
  const ouvrante = STYLE.indexOf("{", debut);
  const fermante = STYLE.indexOf("\n}", ouvrante);
  return STYLE.slice(ouvrante, fermante);
}

/** La valeur qu'une apparence donne à un jeton. */
function valeur(apparence: string, jeton: Jeton): string | null {
  const trouve = new RegExp(`${variableDuJeton(jeton)}\\s*:\\s*([^;]+);`).exec(
    blocDe(apparence),
  );
  return trouve === null ? null : trouve[1]!.trim();
}

describe("les deux apparences peignent le même produit autrement", () => {
  it("il y en a bien DEUX — sans quoi rien de ce qui suit ne prouve rien", () => {
    // TÉMOIN. C'est exactement l'état que R2-01 vient corriger : une seule
    // apparence rendait toutes les assertions ci-dessous vraies par vacuité.
    expect(APPARENCES.length).toBeGreaterThanOrEqual(2);
    expect(APPARENCES).toContain("tableau");
  });

  it("chacune déclare TOUS les jetons — aucun écran à moitié peint", () => {
    for (const apparence of APPARENCES) {
      const manquants = JETONS.filter((j) => valeur(apparence, j) === null);
      expect(
        manquants,
        `l'apparence « ${apparence} » ne déclare pas ces jetons. Un jeton non ` +
          "déclaré ne tombe pas sur une valeur par défaut : il tombe sur " +
          "celle de l'apparence précédente, ou sur rien.",
      ).toEqual([]);
    }
  });

  it("et elles DIFFÈRENT : basculer l'attribut change réellement le rendu", () => {
    const identiques = JETONS.filter(
      (jeton) => valeur("maquette", jeton) === valeur("tableau", jeton),
    );

    // Quelques jetons coïncident légitimement — le blanc d'une surface, une
    // encre de bouton. Ce qui serait faux, c'est que la BASCULE ne change rien.
    expect(
      JETONS.length - identiques.length,
      "les deux apparences donnent presque les mêmes valeurs : basculer " +
        "l'attribut ne changerait rien de visible, et le mécanisme resterait " +
        "aussi peu éprouvé qu'avec une seule.",
    ).toBeGreaterThan(JETONS.length / 2);
  });
});

/**
 * LA MOITIÉ QUI COMPTE — *« sans qu'aucun fichier d'écran ne bouge »*.
 *
 * C'est la promesse de D95, et c'est la seule chose qu'un thème ajouté pourrait
 * casser sans qu'on le voie : il suffirait qu'un écran nomme une apparence — un
 * `data-apparence="maquette"` en dur, une classe conditionnelle — pour que le
 * suivant demande de rouvrir tous les écrans. *Un écran nomme un RÔLE, jamais
 * une couleur ni un thème.*
 */
describe("aucun écran ne nomme d'apparence", () => {
  const SURFACE = ["app", "components"];

  function fichiers(racine: string): string[] {
    const trouves: string[] = [];
    for (const entree of readdirSync(racine)) {
      const chemin = join(racine, entree);
      if (statSync(chemin).isDirectory()) {
        trouves.push(...fichiers(chemin));
      } else if (/\.tsx?$/.test(entree)) {
        trouves.push(chemin);
      }
    }
    return trouves;
  }

  const SOURCES = SURFACE.flatMap((d) => fichiers(join(RACINE, d)));

  it("la population n'est pas vide", () => {
    expect(SOURCES.length).toBeGreaterThan(20);
  });

  it("aucun fichier d'écran ne porte le nom d'une apparence", () => {
    const fautifs: string[] = [];
    for (const fichier of SOURCES) {
      const source = readFileSync(fichier, "utf8");
      for (const apparence of APPARENCES) {
        // Le nom nu, entre guillemets : c'est la forme qu'aurait un écran qui
        // choisit son thème. Le mot en prose ne compte pas — « maquette »
        // apparaît légitimement dans les notes qui citent D95.
        if (new RegExp(`["'\`]${apparence}["'\`]`).test(source)) {
          fautifs.push(`${fichier.replace(RACINE, "")} — « ${apparence} »`);
        }
      }
    }
    expect(
      fautifs,
      "un écran nomme une apparence. C'est la promesse de D95 qui tombe : " +
        "ajouter un thème cesserait d'être un bloc de style et une entrée de " +
        "liste, et redeviendrait une reprise de tous les écrans.",
    ).toEqual([]);
  });
});

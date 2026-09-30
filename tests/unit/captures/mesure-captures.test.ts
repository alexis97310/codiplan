import { describe, expect, it } from "vitest";

import {
  type CibleMesuree,
  type TexteMesure,
  ligneMesureReadme,
  mesurer,
} from "../../../scripts/lib/mesure-captures";

/**
 * LA MESURE D'UNE CAPTURE, ÉPROUVÉE SANS NAVIGATEUR (9BZ-TP-UX1-1-ECHELLE,
 * UX1-d) — même discipline que `verdict-temoin.test.ts` (99O-CAPTURES-TEMOIN).
 */

function texte(taille: number, element = "span", graisse = 400): TexteMesure {
  return { element, taille, graisse, debut: "texte" };
}

function cible(
  largeur: number,
  hauteur: number,
  dansLeTexte = false,
): CibleMesuree {
  return { element: "a", largeur, hauteur, debut: "cible", dansLeTexte };
}

describe("mesurer — textes sous 12 px (D138)", () => {
  it("un texte à 11,5 px compte", () => {
    const resultat = mesurer({
      ecran: "e",
      largeur: 375,
      terrain: false,
      textes: [texte(11.5)],
      cibles: [],
      debordement: 0,
      erreurs: [],
    });
    expect(resultat.textesSousLeSeuil).toHaveLength(1);
  });

  it("un texte à 12 px ne compte pas", () => {
    const resultat = mesurer({
      ecran: "e",
      largeur: 375,
      terrain: false,
      textes: [texte(12)],
      cibles: [],
      debordement: 0,
      erreurs: [],
    });
    expect(resultat.textesSousLeSeuil).toHaveLength(0);
  });
});

describe("mesurer — cibles sous le seuil au bureau (32×32, spec §10 :963)", () => {
  it("une cible de 31×40 compte au bureau (largeur sous le seuil)", () => {
    const resultat = mesurer({
      ecran: "e",
      largeur: 375,
      terrain: false,
      textes: [],
      cibles: [cible(31, 40)],
      debordement: 0,
      erreurs: [],
    });
    expect(resultat.ciblesSousLeSeuil).toHaveLength(1);
  });

  it("une cible de 32×32 ne compte pas au bureau", () => {
    const resultat = mesurer({
      ecran: "e",
      largeur: 375,
      terrain: false,
      textes: [],
      cibles: [cible(32, 32)],
      debordement: 0,
      erreurs: [],
    });
    expect(resultat.ciblesSousLeSeuil).toHaveLength(0);
  });

  it("un lien dans le texte, sous le seuil, ne compte jamais", () => {
    const resultat = mesurer({
      ecran: "e",
      largeur: 375,
      terrain: false,
      textes: [],
      cibles: [cible(20, 18, true)],
      debordement: 0,
      erreurs: [],
    });
    expect(resultat.ciblesSousLeSeuil).toHaveLength(0);
  });
});

describe("mesurer — cibles sous le seuil au terrain (44×44, CDC §13.4)", () => {
  it("une cible de 40×40 compte au terrain", () => {
    const resultat = mesurer({
      ecran: "e",
      largeur: 390,
      terrain: true,
      textes: [],
      cibles: [cible(40, 40)],
      debordement: 0,
      erreurs: [],
    });
    expect(resultat.ciblesSousLeSeuil).toHaveLength(1);
  });

  it("la même cible de 40×40 ne compte pas au bureau", () => {
    const resultat = mesurer({
      ecran: "e",
      largeur: 390,
      terrain: false,
      textes: [],
      cibles: [cible(40, 40)],
      debordement: 0,
      erreurs: [],
    });
    expect(resultat.ciblesSousLeSeuil).toHaveLength(0);
  });
});

describe("mesurer — débordement horizontal (spec §10 :965, PR-10)", () => {
  it("scrollWidth > clientWidth compte", () => {
    const resultat = mesurer({
      ecran: "e",
      largeur: 375,
      terrain: false,
      textes: [],
      cibles: [],
      debordement: 24,
      erreurs: [],
    });
    expect(resultat.debordement).toBe(24);
  });

  it("aucun débordement rend 0, jamais une valeur négative", () => {
    const resultat = mesurer({
      ecran: "e",
      largeur: 375,
      terrain: false,
      textes: [],
      cibles: [],
      debordement: -3,
      erreurs: [],
    });
    expect(resultat.debordement).toBe(0);
  });
});

describe("mesurer — textes hors échelle (spec §3.2, D138, D143)", () => {
  it("un texte à 17 px, hors des huit tailles, compte", () => {
    const resultat = mesurer({
      ecran: "e",
      largeur: 1280,
      terrain: false,
      textes: [texte(17)],
      cibles: [],
      debordement: 0,
      erreurs: [],
    });
    expect(resultat.textesHorsEchelle).toHaveLength(1);
  });

  it("un texte à 16 px, une taille de l'échelle, ne compte pas", () => {
    const resultat = mesurer({
      ecran: "e",
      largeur: 1280,
      terrain: false,
      textes: [texte(16)],
      cibles: [],
      debordement: 0,
      erreurs: [],
    });
    expect(resultat.textesHorsEchelle).toHaveLength(0);
  });

  it("un texte à 16,04 px, arrondi au dixième à 16 px, ne compte pas", () => {
    const resultat = mesurer({
      ecran: "e",
      largeur: 1280,
      terrain: false,
      textes: [texte(16.04)],
      cibles: [],
      debordement: 0,
      erreurs: [],
    });
    expect(resultat.textesHorsEchelle).toHaveLength(0);
  });
});

describe("mesurer — petits textes légers (décision du 30/09/2026, point 11)", () => {
  it("un texte à 12 px et 699 de graisse compte", () => {
    const resultat = mesurer({
      ecran: "e",
      largeur: 1280,
      terrain: false,
      textes: [texte(12, "span", 699)],
      cibles: [],
      debordement: 0,
      erreurs: [],
    });
    expect(resultat.petitsTextesLegers).toHaveLength(1);
  });

  it("un texte à 12 px et 700 de graisse ne compte pas", () => {
    const resultat = mesurer({
      ecran: "e",
      largeur: 1280,
      terrain: false,
      textes: [texte(12, "span", 700)],
      cibles: [],
      debordement: 0,
      erreurs: [],
    });
    expect(resultat.petitsTextesLegers).toHaveLength(0);
  });

  it("un texte à 14 px et 400 de graisse, hors de 12-13 px, ne compte pas", () => {
    const resultat = mesurer({
      ecran: "e",
      largeur: 1280,
      terrain: false,
      textes: [texte(14, "span", 400)],
      cibles: [],
      debordement: 0,
      erreurs: [],
    });
    expect(resultat.petitsTextesLegers).toHaveLength(0);
  });
});

describe("mesurer — textes du terrain sous 16 px (décision du 30/09/2026, point 8)", () => {
  it("un texte à 15,9 px sur un écran terrain compte", () => {
    const resultat = mesurer({
      ecran: "e",
      largeur: 390,
      terrain: true,
      textes: [texte(15.9)],
      cibles: [],
      debordement: 0,
      erreurs: [],
    });
    expect(resultat.textesTerrainSous16).toHaveLength(1);
  });

  it("un texte à 16 px sur un écran terrain ne compte pas", () => {
    const resultat = mesurer({
      ecran: "e",
      largeur: 390,
      terrain: true,
      textes: [texte(16)],
      cibles: [],
      debordement: 0,
      erreurs: [],
    });
    expect(resultat.textesTerrainSous16).toHaveLength(0);
  });

  it("le même texte à 15,9 px hors du terrain ne compte pas", () => {
    const resultat = mesurer({
      ecran: "e",
      largeur: 1280,
      terrain: false,
      textes: [texte(15.9)],
      cibles: [],
      debordement: 0,
      erreurs: [],
    });
    expect(resultat.textesTerrainSous16).toHaveLength(0);
  });
});

describe("mesurer — erreurs de console (spec §10 :966)", () => {
  it("zéro erreur rend zéro", () => {
    const resultat = mesurer({
      ecran: "e",
      largeur: 375,
      terrain: false,
      textes: [],
      cibles: [],
      debordement: 0,
      erreurs: [],
    });
    expect(resultat.erreurs).toHaveLength(0);
  });

  it("les erreurs mesurées se retrouvent telles quelles", () => {
    const resultat = mesurer({
      ecran: "e",
      largeur: 375,
      terrain: false,
      textes: [],
      cibles: [],
      debordement: 0,
      erreurs: ["TypeError: x n'est pas une fonction"],
    });
    expect(resultat.erreurs).toEqual(["TypeError: x n'est pas une fonction"]);
  });
});

describe("ligneMesureReadme", () => {
  it("rend une ligne de tableau par résultat, à zéro partout", () => {
    const lignes = ligneMesureReadme([
      mesurer({
        ecran: "planning",
        largeur: 1280,
        terrain: false,
        textes: [],
        cibles: [],
        debordement: 0,
        erreurs: [],
      }),
    ]);
    expect(
      lignes.some((l) => l.includes("`planning`") && l.includes("1280")),
    ).toBe(true);
  });

  it("liste les 5 premiers exemples d'un dépassement, jamais plus", () => {
    const resultat = mesurer({
      ecran: "registre",
      largeur: 375,
      terrain: false,
      textes: Array.from({ length: 8 }, (_, i) => texte(10, `span-${i}`)),
      cibles: [],
      debordement: 0,
      erreurs: [],
    });
    const lignes = ligneMesureReadme([resultat]);
    // Un texte à 10 px est aussi hors échelle (D143) : sa propre section
    // porte les mêmes 5 exemples plus bas — la borne isole la section
    // « textes < 12 px » pour ne compter qu'un seul dépassement.
    const debut = lignes.findIndex((l) =>
      l.includes("textes < 12 px (5 premiers)"),
    );
    const fin = lignes.indexOf("", debut + 2);
    const exemples = lignes
      .slice(debut + 1, fin)
      .filter((l) => l.trimStart().startsWith("- span-"));
    expect(exemples).toHaveLength(5);
  });

  it("n'écrit aucune section d'exemples quand rien ne dépasse", () => {
    const resultat = mesurer({
      ecran: "planning",
      largeur: 1280,
      terrain: false,
      textes: [],
      cibles: [],
      debordement: 0,
      erreurs: [],
    });
    const lignes = ligneMesureReadme([resultat]);
    expect(lignes.some((l) => l.includes("textes < 12 px (5 premiers)"))).toBe(
      false,
    );
  });
});

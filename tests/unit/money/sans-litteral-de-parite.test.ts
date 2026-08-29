import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PARITES } from "@/prisma/seed-data";

import { RACINE, fichiersSource } from "../outils/fichiers-source";

/**
 * Gardien n°2 du ticket L0-07 : **aucun littéral de parité ailleurs que dans le
 * seed de la table `parite`.**
 *
 * Une parité écrite dans le code est une parité qui ne bougera plus quand la
 * table bougera, et deux rapports finiront par se contredire sans que rien ne
 * l'annonce. Pas même la parité légale fixe du franc Pacifique n'échappe à la
 * règle : elle est fixe, mais elle est une donnée, et le produit est destiné à
 * des sociétés qui n'auront ni l'euro ni le franc Pacifique pour devises.
 *
 * **Le gardien part du seed, pas d'une liste.** Les taux interdits sont
 * **dérivés de `PARITES`** : ce fichier ne cite aucun chiffre. Une parité
 * ajoutée demain au seed est donc protégée le jour même, sans que personne ait
 * à revenir mettre ce test à jour — c'est la leçon du gardien d'exhaustivité de
 * D41, appliquée ici (CLAUDE.md §9).
 */

/** Les deux seuls fichiers qui ont le droit de porter un taux : le seed, et le test qui le fige. */
const EXEMPTS = ["prisma/seed-data.ts", "tests/unit/seed-data.test.ts"];

/** Tout le dépôt : un taux recopié dans un test est déjà un taux recopié. */
const REPERTOIRES_TAUX = [
  "app",
  "components",
  "lib",
  "prisma",
  "scripts",
  "tests",
];

/**
 * Pour la règle générale, les seuls chemins applicatifs : un test doit pouvoir
 * fabriquer un taux à six décimales pour éprouver la conversion, et un taux
 * fabriqué ne consolide aucun rapport.
 */
const REPERTOIRES_APPLICATIFS = [
  "app",
  "components",
  "lib",
  "prisma",
  "scripts",
];

/**
 * Écritures d'un même taux qu'il faut savoir reconnaître : le point décimal du
 * stockage, la virgule de la prose française, et les chiffres seuls — un taux
 * remis à l'échelle en entier reste un taux.
 */
function ecritures(taux: string): string[] {
  return [taux, taux.replace(".", ","), taux.replace(".", "")];
}

/** Le contenu porte-t-il l'un des taux donnés, sous l'une de ses écritures ? */
function porteUnTaux(contenu: string, taux: readonly string[]): boolean {
  return taux.some((valeur) =>
    ecritures(valeur).some((ecriture) => contenu.includes(ecriture)),
  );
}

/** Un décimal à quatre chiffres ou plus après la virgule : la forme d'une parité. */
const FORME_PARITE = /[0-9]+[.,][0-9]{4,}/;

/**
 * Exemption de la seule règle de FORME — et elle porte sur des VALEURS, jamais
 * sur un endroit (ticket L0-09).
 *
 * **Le fait qui la fonde.** WCAG 2.1 définit la luminance relative par
 * `L = 0,2126 R + 0,7152 G + 0,0722 B`, sur des canaux linéarisés autour du
 * seuil `0,04045`. Ces quatre nombres ont exactement la forme d'une parité sans
 * en être une : ce sont les constantes nommées d'une norme d'accessibilité.
 *
 * **L'exemption est donc aussi étroite que ce fait.** Elle liste ces quatre
 * valeurs et les retire du texte AVANT d'y chercher la forme d'une parité,
 * n'importe où dans le dépôt. Elle n'exempte aucun répertoire : un fichier de
 * `lib/theme/` qui écrirait un taux fabriqué est pris comme n'importe quel
 * autre — un répertoire exempté l'aurait laissé passer. C'est la règle de
 * `CLOISONNEE_PAR_IDENTITE` transposée : une exemption vaut pour le fait
 * qu'elle nomme, et elle est gardée.
 *
 * **Et elle est bornée par ses deux côtés.** Une valeur n'est retirée que si
 * aucun chiffre ne la précède ni ne la suit : `10,2126` et `0,21267` ne sont pas
 * les constantes de la norme, ce sont des nombres qui commencent comme elles, et
 * ils restent pris.
 *
 * **Pourquoi exempter plutôt que contourner.** Le motif lit le fichier brut :
 * écrire `2126 / 10000` pour passer dessous aurait rendu le code incomparable au
 * texte de la norme, et interdit jusqu'à CITER les coefficients en commentaire.
 * C'est la faute que le gardien `SECURITY DEFINER` de D50 a commise puis
 * corrigée — un gardien qui interdit d'écrire sa raison d'être apprend surtout à
 * ne plus l'écrire.
 */
const CONSTANTES_WCAG = [
  /** Coefficient du canal rouge dans la luminance relative. */
  "0.2126",
  /** Coefficient du canal vert — 71 % de la luminance perçue. */
  "0.7152",
  /** Coefficient du canal bleu. */
  "0.0722",
  /** Seuil de la partie linéaire de la fonction de transfert sRGB. */
  "0.04045",
] as const;

/**
 * Le texte privé des seules constantes de WCAG 2.1, sous leurs deux écritures —
 * point décimal du code, virgule de la prose française.
 */
function sansConstantesWcag(contenu: string): string {
  return CONSTANTES_WCAG.reduce((texte, valeur) => {
    const [entier, decimales] = valeur.split(".");
    const motif = new RegExp(
      `(?<![0-9])${entier}[.,]${decimales}(?![0-9])`,
      "g",
    );
    return texte.replace(motif, " ");
  }, contenu);
}

describe("aucun littéral de parité hors du seed (I2, D20)", () => {
  it("le seed déclare bien au moins une parité — sinon le gardien serait vide", () => {
    expect(PARITES.length).toBeGreaterThan(0);
  });

  it("aucun autre fichier du dépôt ne porte un taux du seed", () => {
    const interdits = PARITES.map((parite) => parite.taux);
    const fautifs = fichiersSource(REPERTOIRES_TAUX)
      .filter((fichier) => !EXEMPTS.includes(fichier.chemin))
      .filter((fichier) => porteUnTaux(fichier.contenu, interdits))
      .map((fichier) => fichier.chemin);

    expect(
      fautifs,
      "une parité est recopiée hors du seed de la table parite : elle cessera " +
        "de suivre la table le jour où la table changera",
    ).toEqual([]);
  });

  it("aucun code applicatif ne porte de décimal en forme de parité", () => {
    const fautifs = fichiersSource(REPERTOIRES_APPLICATIFS)
      .filter((fichier) => !EXEMPTS.includes(fichier.chemin))
      .filter((fichier) =>
        FORME_PARITE.test(sansConstantesWcag(fichier.contenu)),
      )
      .map((fichier) => fichier.chemin);

    expect(
      fautifs,
      "un taux de conversion est écrit dans le code : les parités se lisent " +
        "dans la table parite, avec leur date d'effet (D20)",
    ).toEqual([]);
  });

  it("le gardien détecte réellement un taux — éprouvé sur un cas fabriqué", () => {
    // Un taux fabriqué, jamais celui du seed : ce fichier ne cite aucun chiffre
    // réel, sans quoi il serait lui-même la fuite qu'il traque.
    const fabrique = ["12.345678"];
    expect(porteUnTaux('const taux = "12.345678";', fabrique)).toBe(true);
    expect(porteUnTaux("1 EUR = 12,345678 XXX", fabrique)).toBe(true);
    expect(porteUnTaux("const mantisse = 12345678;", fabrique)).toBe(true);
    expect(porteUnTaux("const taux = lireEnBase();", fabrique)).toBe(false);

    expect(FORME_PARITE.test('const taux = "12.345678";')).toBe(true);
    expect(FORME_PARITE.test("le taux vaut 12,345678 unités")).toBe(true);
  });

  it("l'exemption ne porte que sur les quatre constantes de la norme", () => {
    // Ce qui est exempté l'est par VALEUR : les constantes de WCAG 2.1, et
    // elles seules. Les nombres qui commencent comme elles restent pris.
    for (const constante of CONSTANTES_WCAG) {
      expect(FORME_PARITE.test(`const c = ${constante};`)).toBe(true);
      expect(
        FORME_PARITE.test(sansConstantesWcag(`const c = ${constante};`)),
        `la constante ${constante} devrait être exemptée`,
      ).toBe(false);
      // Écriture française, dans une phrase de documentation.
      const enProse = `le coefficient vaut ${constante.replace(".", ",")} ici`;
      expect(FORME_PARITE.test(sansConstantesWcag(enProse))).toBe(false);
    }

    // Bornée des deux côtés : ces nombres-là ne sont PAS les constantes.
    for (const voisin of ["10.2126", "0.21267", "1.0722", "0.040451"]) {
      expect(
        FORME_PARITE.test(sansConstantesWcag(`const taux = ${voisin};`)),
        `${voisin} passerait au travers`,
      ).toBe(true);
    }
  });

  it("un taux fabriqué DANS lib/theme reste pris — c'est le trou qu'aurait ouvert une exemption de répertoire", () => {
    // §9, forme 4 : une soustraction au périmètre se prouve AVEC une vraie
    // faute, dans le vrai fichier. Ici, deux fautes : un taux fabriqué, que la
    // règle de forme doit prendre, et une parité du seed, que la règle forte
    // doit prendre. Aucune n'est écrite en clair dans ce fichier — la première
    // est fabriquée, la seconde vient de PARITES.
    const interdits = PARITES.map((parite) => parite.taux);
    const reel = readFileSync(join(RACINE, "lib/theme/couleur.ts"), "utf8");

    // Tel quel, le fichier réel passe les deux règles.
    expect(FORME_PARITE.test(sansConstantesWcag(reel))).toBe(false);
    expect(porteUnTaux(reel, interdits)).toBe(false);

    // Un taux fabriqué écrit dedans : pris par la règle de forme.
    const avecTaux = `${reel}\nconst taux = 12.345678;`;
    expect(FORME_PARITE.test(sansConstantesWcag(avecTaux))).toBe(true);

    // Une parité du seed écrite dedans : prise par la règle forte.
    expect(
      porteUnTaux(`${reel}\nconst taux = ${interdits[0]};`, interdits),
    ).toBe(true);
  });

  it("le gardien laisse passer un montant ordinaire — éprouvé sur un cas fabriqué", () => {
    expect(FORME_PARITE.test("const tauxHoraire = 7000;")).toBe(false);
    expect(FORME_PARITE.test("const majoration = 1.5;")).toBe(false);
    expect(FORME_PARITE.test("const centimes = 12.34;")).toBe(false);
  });
});

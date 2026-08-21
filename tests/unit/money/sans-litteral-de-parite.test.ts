import { describe, expect, it } from "vitest";

import { PARITES } from "@/prisma/seed-data";

import { fichiersSource } from "../outils/fichiers-source";

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
      .filter((fichier) => FORME_PARITE.test(fichier.contenu))
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

  it("le gardien laisse passer un montant ordinaire — éprouvé sur un cas fabriqué", () => {
    expect(FORME_PARITE.test("const tauxHoraire = 7000;")).toBe(false);
    expect(FORME_PARITE.test("const majoration = 1.5;")).toBe(false);
    expect(FORME_PARITE.test("const centimes = 12.34;")).toBe(false);
  });
});

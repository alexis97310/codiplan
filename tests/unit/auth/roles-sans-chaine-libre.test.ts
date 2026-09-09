import { describe, expect, it } from "vitest";

import { Role, ROLES } from "@/lib/auth/roles";

import { fichiersSource } from "../outils/fichiers-source";

/**
 * « Aucun rôle en chaîne libre nulle part » (ticket L0-06, point 1).
 *
 * Un rôle s'écrit `Role.adv`, jamais `"adv"`. La différence n'est pas
 * cosmétique : la première forme suit l'énumération quand elle change, la
 * seconde survit à son propre retrait et devient un droit fantôme.
 *
 * **Périmètre.** Les sources TypeScript du dépôt. Le SQL des migrations en est
 * exclu à dessein : il cite les rôles à travers le type PostgreSQL `"Role"`, si
 * bien qu'une valeur inventée fait échouer la migration — la base a son propre
 * garde-fou, plus fort qu'une recherche textuelle.
 *
 * **Le cas de `client`.** Ce mot est aussi le nom d'une table métier, qui
 * apparaît légitimement entre guillemets dans le SQL brut des fixtures. Il est
 * donc écarté de la recherche par littéral, et couvert autrement : d'une part
 * par la recherche d'affectation ci-dessous, d'autre part par le typage — un
 * rôle est partout de type `Role`, et `"client"` ne compilerait qu'aux endroits
 * où un rôle est attendu, endroits que la seconde recherche couvre.
 */
const REPERTOIRES = ["app", "components", "lib", "prisma", "scripts", "tests"];

/** Le module qui définit l'énumération, et ce test, sont exemptés. */
const EXEMPTS = [
  "lib/auth/roles.ts",
  "tests/unit/auth/roles.test.ts",
  "tests/unit/auth/roles-sans-chaine-libre.test.ts",
];

/**
 * Les rôles recherchés comme littéraux — tous sauf `client` ET `technicien`.
 *
 * **`technicien` rejoint `client` au ticket L2-10, et pour la raison exacte
 * qui avait fait écarter `client`** : le chapitre 11.2 nomme `technicien` une
 * TABLE, créée par cette migration, et son nom apparaît donc légitimement entre
 * guillemets — dans le SQL brut, dans la liste des tables auditées, dans un
 * `@@map`. Le motif ne sait pas distinguer un nom de rôle d'un nom de table :
 * ce sont les mêmes lettres.
 *
 * **Ce n'est pas un trou, c'est un déplacement**, et il est le même que pour
 * `client` : le rôle reste couvert d'une part par la recherche d'AFFECTATION
 * ci-dessous — `role = "technicien"` est prise —, d'autre part par le typage,
 * un rôle étant partout de type `Role`, si bien que `"technicien"` ne
 * compilerait qu'aux endroits où un rôle est attendu, endroits que la seconde
 * recherche couvre.
 *
 * *Ce que cela coûte, écrit plutôt que tu : un littéral `"technicien"` passé
 * là où un `Role` n'est pas exigé par le type — un tableau de `string`, une
 * comparaison lâche — n'est plus vu par la première recherche.*
 */
const ROLES_RECHERCHES = ROLES.filter(
  (role) => role !== Role.client && role !== Role.technicien,
);

describe("aucun rôle en chaîne libre", () => {
  const fichiers = fichiersSource(REPERTOIRES).filter(
    (fichier) => !EXEMPTS.includes(fichier.chemin),
  );

  it("parcourt bien des fichiers — sinon le gardien serait vide", () => {
    expect(fichiers.length).toBeGreaterThan(20);
  });

  it("aucun littéral ne porte le nom d'un rôle", () => {
    // Guillemets simples et doubles seulement : l'accent grave sert aussi à
    // citer un rôle dans la prose des commentaires, ce qui est une bonne
    // pratique et non une faute.
    const motifs = ROLES_RECHERCHES.map(
      (role) => new RegExp(`(["'])${role}\\1`),
    );

    const fautifs = fichiers.filter((fichier) =>
      motifs.some((motif) => motif.test(fichier.contenu)),
    );

    expect(
      fautifs.map((fichier) => fichier.chemin),
      "un rôle est écrit en chaîne libre — utiliser `Role.<valeur>`",
    ).toEqual([]);
  });

  it("aucun champ `role` n'est affecté depuis un littéral", () => {
    // Couvre le cas `client`, que la recherche précédente écarte : ici, c'est
    // la CIBLE de l'affectation qui identifie un rôle, pas la valeur.
    const noms = ROLES.join("|");
    const affectation = new RegExp(
      `\\brole(_actif)?\\s*[:=]{1,3}\\s*(["'])(${noms})\\2`,
    );

    const fautifs = fichiers.filter((fichier) =>
      affectation.test(fichier.contenu),
    );

    expect(
      fautifs.map((fichier) => fichier.chemin),
      "un rôle est affecté depuis une chaîne — utiliser `Role.<valeur>`",
    ).toEqual([]);
  });

  it("le gardien détecte réellement une chaîne libre", () => {
    // Sans cette contre-épreuve, une expression régulière fautive rendrait le
    // gardien silencieux et vert pour toujours.
    const motif = new RegExp(`(["'])${Role.adv}\\1`);
    expect(motif.test('const role = "adv";')).toBe(true);
    expect(motif.test("const role = Role.adv;")).toBe(false);
  });
});

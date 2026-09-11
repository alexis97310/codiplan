import { readFileSync } from "node:fs";
import { join } from "node:path";

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
 * **Les mots qui sont AUSSI des noms de table.** `client` l'était depuis
 * L0-06 ; **`technicien` l'est devenu à L3-01a**. Ces mots apparaissent
 * légitimement entre guillemets dans du SQL brut et dans les listes de tables
 * que les gardiens tiennent — *un nom de table entre guillemets n'est pas un
 * rôle écrit en chaîne libre.*
 *
 * Ils sont donc écartés de la recherche par littéral, et couverts autrement :
 * d'une part par la recherche d'AFFECTATION ci-dessous, qui est celle qui
 * attrape le cas dangereux ; d'autre part par le typage — un rôle est partout
 * de type `Role`, et `"technicien"` ne compilerait qu'aux endroits où un rôle
 * est attendu, endroits que la seconde recherche couvre.
 *
 * **L'exception est ADOSSÉE** (§9, 31/08) : un scénario vérifie que chacun de
 * ces deux mots est bien le nom d'une table au schéma. *Le jour où l'un cesse
 * d'en être une, l'exception ne protège plus rien et doit disparaître.*
 */
const REPERTOIRES = ["app", "components", "lib", "prisma", "scripts", "tests"];

/** Le module qui définit l'énumération, et ce test, sont exemptés. */
const EXEMPTS = [
  "lib/auth/roles.ts",
  "tests/unit/auth/roles.test.ts",
  "tests/unit/auth/roles-sans-chaine-libre.test.ts",
];

/**
 * Les rôles qui sont AUSSI des noms de table, et qu'on ne cherche donc pas
 * comme littéraux. Voir l'en-tête — liste close, et adossée par le scénario
 * « chaque exception est bien le nom d'une table ».
 */
const AUSSI_DES_TABLES: readonly string[] = [Role.client, Role.technicien];

/** Les rôles recherchés comme littéraux — tous sauf ceux-là, voir l'entête. */
const ROLES_RECHERCHES = ROLES.filter(
  (role) => !AUSSI_DES_TABLES.includes(role),
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

  it("chaque exception est bien le nom d'une TABLE — sinon elle ne protège rien", () => {
    // *Une exemption qui ne s'adosse à rien n'exempte plus personne et ne fait
    // jamais échouer personne* (§9, 31/08). Elle est confrontée au SCHÉMA, une
    // source que ce fichier ne contrôle pas.
    const schema = readFileSync(
      join(process.cwd(), "prisma/schema.prisma"),
      "utf8",
    );
    // Témoin de non-vacuité : sans lui, une liste vide passerait la boucle.
    expect(AUSSI_DES_TABLES.length).toBeGreaterThan(1);
    for (const mot of AUSSI_DES_TABLES) {
      expect(schema, mot).toContain(`@@map("${mot}")`);
    }
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

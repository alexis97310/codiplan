import { describe, expect, it } from "vitest";

import { SEUIL_TEXTE, rapportDeContraste } from "@/lib/theme/contraste";
import { ACCENT_NEUTRE, PRIMAIRE_NEUTRE } from "@/lib/theme/defaut";
import {
  NOM_NEUTRE,
  THEME_DEFAUT,
  themeDeSociete,
  themeLisible,
  type SourceTheme,
} from "@/lib/theme/theme";
import { VARIABLES, variablesCss } from "@/lib/theme/variables";

/**
 * Le thème est une DONNÉE de la société (ticket L0-09, points 1 et 2).
 *
 * Un client change ses couleurs sans qu'on redéploie : le thème se construit à
 * partir de trois colonnes, et rien d'autre. Un seul mécanisme, alimenté par la
 * table — aucun fichier de style propre à une société, aucun nom de société
 * dans le code.
 */

const SOCIETE_A: SourceTheme = {
  raison_sociale: "Société A",
  couleur_primaire: "#0b5cad",
  couleur_secondaire: "#f4a300",
};

const SOCIETE_B: SourceTheme = {
  raison_sociale: "Société B",
  couleur_primaire: "#7a1f3d",
  couleur_secondaire: "#c9f2d8",
};

describe("le thème neutre est LE défaut, pas le thème d'une société", () => {
  it("s'applique en l'absence de société active", () => {
    expect(themeDeSociete(null)).toBe(THEME_DEFAUT);
    expect(THEME_DEFAUT.origine).toBe("defaut");
    expect(THEME_DEFAUT.nom).toBe(NOM_NEUTRE);
  });

  it("porte les couleurs neutres définies une seule fois", () => {
    expect(THEME_DEFAUT.primaire.fond).toBe(PRIMAIRE_NEUTRE);
    expect(THEME_DEFAUT.accent.fond).toBe(ACCENT_NEUTRE);
    expect(themeLisible(THEME_DEFAUT)).toBe(true);
  });

  it("s'applique à une société SANS charte, sous le nom de cette société", () => {
    // « Société sans thème » est un état représentable depuis L0-09 : les deux
    // colonnes sont nullables, précisément pour qu'un provisionnement n'invente
    // pas deux couleurs.
    const theme = themeDeSociete({
      raison_sociale: "Société sans charte",
      couleur_primaire: null,
      couleur_secondaire: null,
    });

    expect(theme.origine).toBe("defaut");
    expect(theme.nom).toBe("Société sans charte");
    expect(theme.primaire.fond).toBe(PRIMAIRE_NEUTRE);
  });

  it("remplace au cas par cas une valeur qui n'est pas une couleur", () => {
    // Une contrainte CHECK refuse déjà ces valeurs en base. Le rendu se défend
    // quand même : une reprise de données ne doit pas casser une page.
    const theme = themeDeSociete({
      raison_sociale: "Société bancale",
      couleur_primaire: "bleu marine",
      couleur_secondaire: "#f4a300",
    });

    expect(theme.origine).toBe("societe");
    expect(theme.primaire.fond).toBe(PRIMAIRE_NEUTRE);
    expect(theme.accent.fond).toBe("#f4a300");
  });
});

describe("le thème d'une société vient de ses colonnes", () => {
  it("normalise la graphie de la couleur", () => {
    const theme = themeDeSociete({
      raison_sociale: "Société",
      couleur_primaire: "#0B5CAD",
      couleur_secondaire: "#FA0",
    });

    expect(theme.primaire.fond).toBe("#0b5cad");
    expect(theme.accent.fond).toBe("#ffaa00");
  });

  it("calcule une encre lisible sur CHAQUE couleur, jamais un blanc par défaut", () => {
    const theme = themeDeSociete(SOCIETE_A);

    // Bleu profond : encre claire. Orange lumineux : encre sombre. C'est le
    // défaut que le ticket vise — un blanc systématique aurait donné 2,08:1
    // sur cet orange.
    expect(theme.primaire.encre).toBe("#ffffff");
    expect(theme.accent.encre).toBe("#000000");
    for (const couleur of [theme.primaire, theme.accent]) {
      expect(couleur.rapportEncre).toBeGreaterThanOrEqual(SEUIL_TEXTE);
      expect(rapportDeContraste(couleur.fond, couleur.encre)).toBeCloseTo(
        couleur.rapportEncre,
        10,
      );
    }
    expect(themeLisible(theme)).toBe(true);
  });

  it("reste lisible sur une charte volontairement pâle", () => {
    const theme = themeDeSociete({
      raison_sociale: "Société pâle",
      couleur_primaire: "#fff9c4",
      couleur_secondaire: "#c9f2d8",
    });

    expect(theme.primaire.encre).toBe("#000000");
    expect(theme.accent.encre).toBe("#000000");
    expect(themeLisible(theme)).toBe(true);
    // Et la variante « encre sur la surface » a bien dû être assombrie.
    expect(theme.primaire.lisible).not.toBe(theme.primaire.fond);
    expect(theme.primaire.rapportLisible).toBeGreaterThanOrEqual(SEUIL_TEXTE);
  });
});

describe("les variables CSS sont le seul mécanisme d'application", () => {
  it("les six variables sont posées, et seulement elles", () => {
    const variables = variablesCss(themeDeSociete(SOCIETE_A));
    expect(Object.keys(variables).sort()).toEqual([...VARIABLES].sort());
  });

  it("deux sociétés produisent deux jeux de variables distincts", () => {
    const a = variablesCss(themeDeSociete(SOCIETE_A));
    const b = variablesCss(themeDeSociete(SOCIETE_B));

    expect(a).not.toEqual(b);
    for (const variable of VARIABLES) {
      expect(typeof Reflect.get(a, variable)).toBe("string");
    }
    expect(Reflect.get(a, "--societe-primaire")).toBe("#0b5cad");
    expect(Reflect.get(b, "--societe-primaire")).toBe("#7a1f3d");
    // L'encre de l'accent change AUSSI de camp : orange soutenu contre vert
    // très clair. Une bascule ne déplace donc pas que des fonds.
    expect(Reflect.get(a, "--societe-accent-encre")).toBe("#000000");
    expect(Reflect.get(b, "--societe-accent-encre")).toBe("#000000");
    expect(Reflect.get(a, "--societe-primaire-encre")).toBe("#ffffff");
    expect(Reflect.get(b, "--societe-primaire-encre")).toBe("#ffffff");
  });

  it("ne contient aucun nom de société — seulement des couleurs", () => {
    const variables = variablesCss(themeDeSociete(SOCIETE_A));
    for (const valeur of Object.values(variables)) {
      expect(String(valeur)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

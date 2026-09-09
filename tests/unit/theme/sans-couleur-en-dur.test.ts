import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { porteUneCouleur } from "../outils/couleurs";
import {
  EXTENSIONS_CSS,
  RACINE,
  fichiersSource,
  sansCommentaires,
} from "../outils/fichiers-source";

/**
 * Gardien du ticket L0-09, point 5 : **aucun littéral de couleur dans les
 * composants — tout passe par les variables**.
 *
 * **Ce qu'une couleur en dur coûte.** Écrire `#0b5cad` ou `bg-blue-700` dans un
 * composant, c'est décider que la plateforme est bleue. La solution est vendue
 * (chapitre 22) : le premier client dont la charte est rouge verrait sa moitié
 * d'interface rester bleue, et le défaut ne se manifesterait que chez lui.
 * C'est la même faute que `code_winpro` et que le fuseau en dur — un
 * paramétrage transformé en constante de compilation.
 *
 * **Le périmètre, et sa coupure.** Le code applicatif : `app/`, `components/`,
 * `lib/`. `lib/theme/` en est exempté — c'est LE mécanisme, l'endroit désigné
 * où le noir, le blanc et le thème neutre s'écrivent. L'exemption est un
 * PRÉFIXE DE RÉPERTOIRE, pas une correspondance de nom : `lib/themeur.ts` n'en
 * bénéficierait pas.
 *
 * **Dans une feuille de style, la coupure est autre** : une couleur y est
 * licite dans une DÉCLARATION DE VARIABLE (`--x: #fff`) — c'est la définition
 * d'un jeton — et fautive partout ailleurs (`color: #fff`). C'est la même
 * distinction que « documentation contre exécution » du gardien de D50 : ce
 * n'est pas le fichier qui est exempté, c'est une forme d'écriture.
 *
 * **Éprouvé selon les six formes du §9 du CLAUDE.md**, et le verdict de chacune
 * est écrit dans un scénario ci-dessous plutôt que dans une opinion. La sixième
 * — l'assemblage délibéré — passe, et le gardien le dit lui-même.
 */

/** Le code applicatif. `prisma/` et `scripts/` portent des données, pas du rendu. */
const REPERTOIRES = ["app", "components", "lib"];

/**
 * Le mécanisme lui-même. Préfixe de répertoire : c'est là, et là seulement, que
 * `#000000`, `#ffffff` et les couleurs du thème neutre s'écrivent.
 */
const EXEMPT_MECANISME = "lib/theme/";

/**
 * Dans une feuille de style, seules les DÉCLARATIONS DE VARIABLE ont le droit
 * de porter une couleur. Rend les lignes fautives.
 */
function lignesFautivesCss(contenu: string): string[] {
  return sansCommentaires(contenu)
    .split("\n")
    .filter(
      (ligne) => porteUneCouleur(ligne) && !/^\s*--[\w-]+\s*:/.test(ligne),
    )
    .map((ligne) => ligne.trim());
}

const SOURCES = fichiersSource(REPERTOIRES)
  .filter((fichier) => !fichier.chemin.startsWith(EXEMPT_MECANISME))
  .map((fichier) => ({
    chemin: fichier.chemin,
    contenu: sansCommentaires(fichier.contenu),
  }));

const FEUILLES = fichiersSource(REPERTOIRES, EXTENSIONS_CSS);

describe("aucune couleur en dur hors du mécanisme de thème (L0-09)", () => {
  it("parcourt bien des fichiers — sinon le gardien serait vide", () => {
    expect(SOURCES.length).toBeGreaterThan(10);
    expect(FEUILLES.length).toBeGreaterThan(0);
  });

  it("aucun composant, aucune route, aucun module ne porte de couleur", () => {
    const fautifs = SOURCES.filter((fichier) =>
      porteUneCouleur(fichier.contenu),
    ).map((fichier) => fichier.chemin);

    expect(
      fautifs,
      "une couleur est écrite en dur : la charte est une donnée de la société " +
        "(L0-09), et les composants ne connaissent que les variables",
    ).toEqual([]);
  });

  it("aucune feuille de style ne pose de couleur ailleurs que dans une variable", () => {
    const fautifs = FEUILLES.flatMap((fichier) =>
      lignesFautivesCss(fichier.contenu).map(
        (ligne) => `${fichier.chemin} — ${ligne}`,
      ),
    );

    expect(fautifs).toEqual([]);
  });

  /**
   * Le corollaire du « seul mécanisme » : les six variables de société ne sont
   * définies dans AUCUNE feuille de style. Elles arrivent du serveur, calculées
   * depuis la table. Une définition en CSS serait un thème écrit à la main —
   * c'est-à-dire un fichier de style propre à une société, que le ticket
   * interdit — et elle masquerait l'absence de charte au lieu de la révéler.
   */
  it("les variables de société ne sont définies dans aucune feuille de style", () => {
    const definitions = FEUILLES.filter((fichier) =>
      /^\s*--societe-[\w-]+\s*:/m.test(sansCommentaires(fichier.contenu)),
    ).map((fichier) => fichier.chemin);

    expect(definitions).toEqual([]);
  });
});

/**
 * Les six formes du §9. Chaque scénario porte le verdict d'une forme.
 */
describe("le gardien éprouvé sur les six formes équivalentes (§9)", () => {
  it("forme 1 — GRAPHIE : casse, longueur, espaces, retour à la ligne", () => {
    const fautes = [
      'const c = "#fff";',
      'const c = "#FFF";',
      'const c = "#0B5CAD";',
      'const c = "#0b5cadff";',
      'const c = "rgb(11, 92, 173)";',
      'const c = "RGBA( 11 , 92 , 173 , .5 )";',
      "const c = `hsl(\n  210deg 88% 36%\n)`;",
      'const c = "oklch(0.5 0.1 250)";',
      'const c = "color-mix(in oklab, #fff, #000)";',
    ];
    for (const faute of fautes) {
      expect(porteUneCouleur(faute), `non détecté : ${faute}`).toBe(true);
    }
  });

  it("forme 2 — ENVELOPPE : la faute dans une chaîne, un gabarit, un appel", () => {
    // Le périmètre examiné ne retire JAMAIS les chaînes littérales : une
    // couleur ne s'écrit pratiquement que là.
    const fautes = [
      'className={cn("bg-[#0b5cad]", classe)}',
      "const style = { backgroundColor: `#0b5cad` };",
      'el.setAttribute("style", "color: #fff");',
      'const classes = ["text-white", "font-bold"].join(" ");',
      'const gabarit = `<div style="background:#f4a300"></div>`;',
    ];
    for (const faute of fautes) {
      expect(porteUneCouleur(faute), `non détecté : ${faute}`).toBe(true);
    }
  });

  it("forme 3 — DEUX TEMPS : la couleur déclarée ici, appliquée ailleurs", () => {
    // C'est l'ÉTAT FINAL qui compte, pas le verbe qui l'installe : le gardien
    // mord sur la déclaration comme sur l'application, et sur la réécriture
    // d'une variable de thème côté navigateur.
    const fautes = [
      'const PRIMAIRE = "#0b5cad";',
      "style={{ background: PRIMAIRE }}\nconst PRIMAIRE = '#0b5cad';",
      'document.documentElement.style.setProperty("--societe-primaire", teinte);',
      "racine.style.setProperty(`--societe-accent`, valeur);",
    ];
    for (const faute of fautes) {
      expect(porteUneCouleur(faute), `non détecté : ${faute}`).toBe(true);
    }
  });

  it("forme 4 — L'EXEMPTION elle-même : elle ne fait entrer aucune faute", () => {
    // (a) L'exemption est un préfixe de RÉPERTOIRE : un fichier dont le nom
    //     commence par « theme » hors de ce répertoire n'en bénéficie pas.
    const voisins = [
      "lib/themeur.ts",
      "lib/theme.ts",
      "components/theme/bandeau-societe.tsx",
    ];
    for (const chemin of voisins) {
      expect(
        chemin.startsWith(EXEMPT_MECANISME),
        `${chemin} serait exempté à tort`,
      ).toBe(false);
    }

    // (b) La coupure des feuilles de style est une FORME D'ÉCRITURE, pas un
    //     fichier : dans un même fichier, la déclaration de variable passe et
    //     la faute posée à côté est prise.
    const melange = [
      ":root {",
      "  --societe-demo: #0b5cad;",
      "  color: #0b5cad;",
      "}",
    ].join("\n");
    expect(lignesFautivesCss(melange)).toEqual(["color: #0b5cad;"]);

    // (c) Une documentation qui CITE une couleur reste licite — un commentaire
    //     n'est pas exécuté — mais une vraie faute dans le même fichier est
    //     prise malgré elle.
    const documente = [
      "// La charte de démonstration vaut #0b5cad.",
      "/** Encre blanche : #ffffff. */",
      "const fond = theme.primaire.fond;",
    ].join("\n");
    expect(porteUneCouleur(sansCommentaires(documente))).toBe(false);
    expect(
      porteUneCouleur(sansCommentaires(`${documente}\nconst dur = "#0b5cad";`)),
    ).toBe(true);
  });

  it("forme 5 — LA FORME VOISINE, greffée dans le fichier réel", () => {
    // Ce qu'un correcteur BIEN INTENTIONNÉ écrirait : « la couleur ne s'affiche
    // pas, je la mets en dur le temps de déboguer ». Greffée dans le vrai
    // fichier, celui où la faute se commettrait — jamais dans un fichier
    // fabriqué (leçon du 21/08).
    const chemin = "components/theme/bandeau-societe.tsx";
    const reel = readFileSync(join(RACINE, chemin), "utf8");
    expect(porteUneCouleur(sansCommentaires(reel))).toBe(false);

    const greffes = [
      reel.replace("bg-societe-primaire", "bg-[#0b5cad]"),
      reel.replace("text-societe-primaire-encre", "text-white"),
      reel.replace("bg-societe-accent", "bg-amber-500"),
      reel.replace(
        "data-origine-theme={theme.origine}",
        'style={{ backgroundColor: "#f4a300" }}',
      ),
    ];
    for (const [index, greffe] of greffes.entries()) {
      expect(greffe, `greffe n°${index + 1} inopérante`).not.toBe(reel);
      expect(
        porteUneCouleur(sansCommentaires(greffe)),
        `greffe n°${index + 1} non détectée`,
      ).toBe(true);
    }
  });

  it("forme 6 — CE QUI RESTE HORS DE PORTÉE, et le gardien le dit", () => {
    // Un gardien statique arrête la correction bien intentionnée, pas un
    // contournement décidé. Ces trois écritures passent, et c'est la limite
    // annoncée : les tenir exigerait d'exécuter le code, pas de le lire.
    const horsPortee = [
      'const c = "#" + "0b5cad";',
      "const c = String.fromCharCode(35) + teinte;",
      'const classe = `bg-${"blue"}-700`;',
      // Une couleur ASSEMBLÉE à l'exécution. Le motif `#${…}` serait tentant à
      // interdire ; il attraperait aussi une ancre d'URL construite de la même
      // façon, et un gardien qui crie sur du licite finit désactivé.
      "const c = `#${teinte}`;",
    ];
    for (const contournement of horsPortee) {
      expect(porteUneCouleur(contournement)).toBe(false);
    }
  });

  it("ne crie pas sur ce qui n'est pas une couleur", () => {
    const licites = [
      'className="bg-societe-primaire text-societe-primaire-encre"',
      'className="text-muted-foreground bg-background border-border"',
      "style={variablesCss(theme)}",
      "const fond = theme.accent.fond;",
      'const ancre = "https://exemple.test/page#section";',
      'const classe = "grid-cols-3 gap-4 px-6";',
    ];
    for (const licite of licites) {
      expect(porteUneCouleur(licite), `faux positif : ${licite}`).toBe(false);
    }
  });
});

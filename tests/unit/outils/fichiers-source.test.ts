import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RACINE, sansCommentaires } from "./fichiers-source";

/**
 * GARDE-FOU DE `sansCommentaires` (ticket 9CN-RETOUCHES-3).
 *
 * `accept="image/*"` (`app/(mobile)/terrain/[id]/page.tsx`) ouvrait un faux
 * commentaire bloc dans l'ancienne version — une chaîne ne la protégeait pas.
 * Ce fichier éprouve, sur des cas fabriqués, que la version actuelle respecte
 * les chaînes, les gabarits, les littéraux regex, et ne décale plus les
 * numéros de ligne en aval d'un commentaire retiré.
 */
describe("sansCommentaires — respecte les chaînes et les gabarits", () => {
  it('un `/*` dans un attribut `accept="image/*"` n\'ouvre pas de faux commentaire', () => {
    const source = [
      'const a = <input accept="image/*" />;',
      "const b = 1;",
      "/* un vrai commentaire */",
      "const c = 2;",
    ].join("\n");
    const resultat = sansCommentaires(source);
    expect(resultat).toContain('accept="image/*"');
    expect(resultat).toContain("const b = 1;");
    expect(resultat).toContain("const c = 2;");
    expect(resultat).not.toContain("un vrai commentaire");
  });

  it('un `/*` dans un gabarit de chemin `"**/api/*/x"` n\'ouvre pas de faux commentaire — un VRAI commentaire bloc suit, pour que le cas ne soit pas vacant contre le bug qu\'il nomme (constat du 02/10/2026 : l\'ancienne fonction, régulière, coupait à "page.route(\\"**/api" et perdait tout le reste jusqu\'au "*/" de la ligne suivante)', () => {
    const source = [
      'page.route("**/api/*/x", () => {});',
      "const apres = 1;",
      "/* fin */",
    ].join("\n");
    const resultat = sansCommentaires(source);
    expect(resultat).toContain('"**/api/*/x"');
    expect(resultat).toContain("const apres = 1;");
    expect(resultat).not.toContain("fin");
  });

  it("une URL `http://` dans du texte JSX — HORS chaîne — reste entière (constat du 02/10/2026)", () => {
    const source = "const e = <a>http://x.invalid/a</a>;";
    expect(sansCommentaires(source)).toBe(source);
  });

  it("un vrai commentaire qui suit un `:` AVEC une espace reste retiré (lib/interventions/depot.ts:1519)", () => {
    const source = [
      "const a = {",
      "  b",
      "      : // Le filtre société est explicite",
      "};",
    ].join("\n");
    const resultat = sansCommentaires(source);
    expect(resultat).not.toContain("Le filtre société");
    expect(resultat).toContain("const a = {");
    expect(resultat).toContain("};");
  });

  it("un `//` collé à un `:` SANS schéma d'URL ouvre un vrai commentaire (constat du 02/10/2026, relecture 9CR)", () => {
    const source = "a ? b :// note";
    expect(sansCommentaires(source)).toBe("a ? b :");
  });

  it("une URL `https://` dans une balise JSX suivie d'un vrai commentaire `// vrai` : l'URL ET la balise fermante restent entières, le commentaire est retiré (constat du 02/10/2026, relecture 9CR)", () => {
    const source = "const e = <a>https://x</a>; // vrai";
    const resultat = sansCommentaires(source);
    expect(resultat).toContain("<a>https://x</a>;");
    expect(resultat).not.toContain("vrai");
  });

  it("une URL `//` dans une chaîne reste entière", () => {
    const source = 'const url = "https://exemple.invalid/a";';
    expect(sansCommentaires(source)).toBe(source);
  });

  it("un `//` précédé d'un caractère quelconque, dans une chaîne, reste entier", () => {
    const source = 'const x = "a]//b";';
    expect(sansCommentaires(source)).toBe(source);
  });

  it("un vrai commentaire ligne et un vrai commentaire bloc sont retirés", () => {
    const source = ["const a = 1; // note", "/* bloc */ const b = 2;"].join(
      "\n",
    );
    const resultat = sansCommentaires(source);
    expect(resultat).not.toContain("note");
    expect(resultat).not.toContain("bloc");
    expect(resultat).toContain("const a = 1;");
    expect(resultat).toContain("const b = 2;");
  });

  it("un commentaire bloc de trois lignes laisse le même nombre de lignes", () => {
    const source = ["const a = 1;", "/*", "x", "*/", "const b = 2;"].join("\n");
    const resultat = sansCommentaires(source);
    expect(resultat.split("\n").length).toBe(source.split("\n").length);
    expect(resultat).not.toContain("x");
  });

  it("un littéral regex `/\\/\\*/` est préservé", () => {
    const source = "const r = /\\/\\*/;";
    expect(sansCommentaires(source)).toBe(source);
  });

  it("un `<` NON suivi immédiatement d'un `/` n'empêche pas un littéral regex de s'ouvrir juste après — l'opérateur « inférieur à », pas une balise fermante (`a < /re/.test(x)`, constat du 03/10/2026, relecture 9CY, lot 9CZ-RETOUCHES-9)", () => {
    const source = "const ok = a < /re/.test(x);";
    expect(sansCommentaires(source)).toBe(source);
  });

  it("MESURE DU DÉFAUT — sans la correction ci-dessus, un `/` lu comme une division juste après `<` avalait tout jusqu'au premier `*/` RÉEL, loin en aval (constat du 03/10/2026, relecture 9CY, lot 9CZ-RETOUCHES-9)", () => {
    // `/x\/*y/` est UN littéral regex (le `\/` est un `/` échappé). Lu comme
    // une division, le `/` qui suit l'échappement rencontre un `*` : la
    // version fautive y ouvrait un commentaire bloc, et cherchait son `*/`
    // dans TOUT le reste du fichier — ici celui d'un vrai commentaire, bien
    // plus loin, qu'elle n'avait pas à regarder.
    const source = [
      "const ok = a < /x\\/*y/.test(s);",
      "const vrai = 1; /* à retirer */",
    ].join("\n");
    const resultat = sansCommentaires(source);
    expect(resultat).toContain("/x\\/*y/.test(s);");
    expect(resultat).toContain("const vrai = 1;");
    expect(resultat).not.toContain("à retirer");
  });

  it("un `<` IMMÉDIATEMENT suivi d'un `/` reste lu comme une balise fermante — le témoin que la correction ci-dessus ne défait pas le cas du 02/10/2026", () => {
    const source = "const e = <a>https://x</a>; // vrai";
    const resultat = sansCommentaires(source);
    expect(resultat).toContain("<a>https://x</a>;");
    expect(resultat).not.toContain("vrai");
  });

  it("TÉMOIN — la sortie de app/(mobile)/terrain/[id]/page.tsx contient la ligne du bouton d'ajout de photo", () => {
    const source = readFileSync(
      join(RACINE, "app/(mobile)/terrain/[id]/page.tsx"),
      "utf8",
    );
    expect(sansCommentaires(source)).toContain('{t("terrain.photos.ajouter")}');
  });
});

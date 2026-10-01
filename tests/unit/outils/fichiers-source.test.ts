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

  it('un `/*` dans un gabarit de chemin `"**/api/*/x"` n\'ouvre pas de faux commentaire', () => {
    const source = [
      'page.route("**/api/*/x", () => {});',
      "const apres = 1;",
    ].join("\n");
    const resultat = sansCommentaires(source);
    expect(resultat).toContain('"**/api/*/x"');
    expect(resultat).toContain("const apres = 1;");
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

  it("TÉMOIN — la sortie de app/(mobile)/terrain/[id]/page.tsx contient la ligne du bouton d'ajout de photo", () => {
    const source = readFileSync(
      join(RACINE, "app/(mobile)/terrain/[id]/page.tsx"),
      "utf8",
    );
    expect(sansCommentaires(source)).toContain('{t("terrain.photos.ajouter")}');
  });
});

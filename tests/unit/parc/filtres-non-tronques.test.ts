import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { fr } from "@/lib/i18n";

/**
 * LES FILTRES DU PARC TRONQUÉS EN PRODUCTION (9EWA-RENDU-VISUEL-1, point 4)
 * — « Tous l… » : les quatre `<select>` étaient `truncate`, pour des
 * libellés qui répétaient le nom du filtre déjà affiché au-dessus
 * (« Filtrer par statut » / « Tous les statuts »).
 *
 * **La largeur reste `w-[100px]`/`w-[105px]`, VOLONTAIREMENT** — un premier
 * essai à `min-w-[140px]` a fait passer la barre de filtres sur deux lignes
 * à 1280px, et a fait rougir `tests/e2e/parc-tri.spec.ts` (la liste doit
 * montrer au moins 480 px sous la barre, constat 30 re-mesuré le
 * 08/10/2026) : la hauteur gagnée par la troisième ligne de filtres se
 * perdait sur la liste. Les libellés raccourcis (« Tous »/« Toutes »,
 * quelques caractères) tiennent déjà dans la largeur d'origine une fois
 * `truncate` retiré — élargir n'était pas nécessaire pour corriger le
 * défaut constaté.
 */

const PAGE = readFileSync(
  join(process.cwd(), "app/(back-office)/parc/page.tsx"),
  "utf8",
);

describe("parc — les quatre filtres ne tronquent plus leur libellé", () => {
  it.each([
    ["statut", "parc.filtre_statut.tous"],
    ["client", "parc.filtre_client.tous"],
    ["site", "parc.filtre_site.tous"],
    ["famille", "parc.filtre_famille.tous"],
  ] as const)("l'option « tous » de %s est courte", (_id, cle) => {
    expect(fr[cle].length).toBeLessThanOrEqual(6);
  });

  it("aucun des quatre <select> ne porte plus `truncate`", () => {
    expect(PAGE).not.toMatch(/<select[^>]*\btruncate\b/);
  });

  it.each(["statut", "client", "site", "famille"] as const)(
    "le <select> %s garde sa largeur d'origine, sans `min-w`",
    (id) => {
      const motif = new RegExp(`id="${id}"[\\s\\S]{0,200}?className="([^"]+)"`);
      const trouve = motif.exec(PAGE);
      expect(trouve).not.toBeNull();
      expect(trouve![1]).toMatch(/\bw-\[(100|105)px\]/);
      expect(trouve![1]).not.toContain("min-w-");
    },
  );
});

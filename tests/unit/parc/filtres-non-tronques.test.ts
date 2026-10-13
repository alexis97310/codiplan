import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { fr } from "@/lib/i18n";

/**
 * LES FILTRES DU PARC TRONQUÉS EN PRODUCTION (9EWA-RENDU-VISUEL-1, point 4)
 * — « Tous l… » : les quatre `<select>` étaient à la fois trop étroits
 * (`w-[100px]`/`w-[105px]`) et `truncate`, pour des libellés qui répétaient
 * le nom du filtre déjà affiché au-dessus (« Filtrer par statut » / « Tous
 * les statuts »). Les libellés raccourcis et la largeur élargie se
 * vérifient à la source — la troncature réelle (polices, zoom) reste du
 * ressort de la capture d'écran, prise à 1280 et 375 (passation du lot).
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
    "le <select> %s a une largeur d'au moins 140px",
    (id) => {
      const motif = new RegExp(`id="${id}"[\\s\\S]{0,200}?className="([^"]+)"`);
      const trouve = motif.exec(PAGE);
      expect(trouve).not.toBeNull();
      expect(trouve![1]).toMatch(/\b(?:min-)?w-\[(1[4-9]\d|[2-9]\d\d)px\]/);
    },
  );
});

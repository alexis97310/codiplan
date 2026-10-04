import { describe, expect, it } from "vitest";

import { fr } from "@/lib/i18n/fr";
import {
  PORTES_PARAMETRAGE,
  SECTIONS_PARAMETRAGE,
} from "@/lib/navigation/portes-parametrage";

/**
 * LE HUB « Paramètres » EST RANGÉ EN SECTIONS (QT-21, D167, 05/10/2026,
 * TP-NAV1) — plutôt qu'une grille plate de onze portes.
 *
 * La population vient de `PORTES_PARAMETRAGE` et `SECTIONS_PARAMETRAGE` —
 * jamais une liste recopiée ici, qui divergerait en silence le jour où une
 * porte ou une section change.
 */
describe("les portes du hub de paramétrage sont rangées en cinq sections (QT-21)", () => {
  it("chaque porte range dans l'une des cinq sections closes", () => {
    const sectionsValides = new Set(SECTIONS_PARAMETRAGE.map((s) => s.id));
    expect(sectionsValides.size).toBe(5);
    for (const porte of PORTES_PARAMETRAGE) {
      expect(sectionsValides.has(porte.section), porte.chemin).toBe(true);
    }
  });

  it("chaque section a sa clé au dictionnaire", () => {
    for (const section of SECTIONS_PARAMETRAGE) {
      expect(Object.hasOwn(fr, section.titre), section.titre).toBe(true);
    }
  });

  it("« Clients », « Sites » et « Societe » (Charte) ne sont plus des portes du hub (QT-21, QT-22)", () => {
    const chemins = PORTES_PARAMETRAGE.map((p) => p.chemin);
    expect(chemins).not.toContain("/clients");
    expect(chemins).not.toContain("/sites");
    expect(chemins).not.toContain("/parametres/societe");
  });

  it("« Imports » est désormais une porte du hub, section Données (QT-21)", () => {
    const imports = PORTES_PARAMETRAGE.find((p) => p.chemin === "/imports");
    expect(imports).toBeDefined();
    expect(imports?.section).toBe("donnees");
  });

  it("aucune porte n'est dupliquée", () => {
    const chemins = PORTES_PARAMETRAGE.map((p) => p.chemin);
    expect(new Set(chemins).size).toBe(chemins.length);
  });
});

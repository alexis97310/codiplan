import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PORTES_PARAMETRAGE } from "@/lib/navigation/portes-parametrage";

/**
 * LE RETOUR VERS « Paramètres » DEPUIS SES SOUS-PAGES (CG1, audit du
 * 26/09/2026, constat C-G2 ; renommé QT-21, D167, 05/10/2026, TP-NAV1 ;
 * devenu un FIL D'ARIANE le 06/10/2026, 9DR-TP-NAV2-RETOURS-FIL, D168).
 *
 * `<RetourParametres />` — un lien nu — a été RETIRÉ : la décision 9 du
 * 03/10/2026 (D168) pose un fil d'Ariane sur toutes les sous-pages de
 * Paramètres, et son premier maillon rend le même service (un lien vers
 * `/parametres`), sans dupliquer ce que le fil affiche déjà. Ce fichier
 * tenait la présence de l'ancien composant ; il tient désormais la présence
 * du fil, à la même population — déduite de `PORTES_PARAMETRAGE`, jamais
 * une liste de fichiers écrite à la main.
 *
 * **HUIT, pas neuf, depuis QT-22** : `/parametres/societe` (Charte) a quitté
 * `PORTES_PARAMETRAGE` — la page existe encore, en redirection seule.
 */

describe("les huit sous-pages de paramétrage portent un fil d'Ariane vers /parametres", () => {
  const cheminsDeParametrage = PORTES_PARAMETRAGE.filter((porte) =>
    porte.chemin.startsWith("/parametres/"),
  ).map((porte) => porte.chemin);

  it("en dénombre au moins huit", () => {
    expect(cheminsDeParametrage.length).toBeGreaterThanOrEqual(8);
  });

  for (const chemin of cheminsDeParametrage) {
    it(`${chemin} porte un \`filAriane\` vers « /parametres »`, () => {
      const contenu = readFileSync(
        join(process.cwd(), "app/(back-office)", chemin, "page.tsx"),
        "utf-8",
      );
      expect(contenu).toContain("filAriane={[");
      expect(contenu).toContain('href: "/parametres" }');
    });

    it(`${chemin} n'importe plus le composant retiré`, () => {
      const contenu = readFileSync(
        join(process.cwd(), "app/(back-office)", chemin, "page.tsx"),
        "utf-8",
      );
      expect(contenu).not.toContain(
        "@/components/navigation/retour-parametres",
      );
    });
  }
});

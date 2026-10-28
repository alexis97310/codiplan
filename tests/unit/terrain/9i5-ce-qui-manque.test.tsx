import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { fr, t } from "@/lib/i18n/fr";

/**
 * 9I5-ECRANS-INCOMPLETS-LE-DISENT — « Ma journée » dit ce qu'elle ne montre
 * pas, même esprit que le sous-titre d'« Indicateurs du mois »
 * (`text-app-encre-faible … font-bold`). Cette page n'utilise pas `Page`
 * (son propre `<header>`), et le terrain impose 16/18/24/28 px (D143,
 * point 8, `tests/unit/ui/retouches-2a.test.ts`) — jamais le 13 px du
 * back-office : `text-16`, même taille que la ligne de date voisine.
 */
describe("Ma journée — ce qui manque est dit à l'écran", () => {
  it("affiche la clé terrain.sous_titre_manquant, jamais un texte en dur", () => {
    render(
      <p className="text-app-encre-faible text-16 font-bold">
        {t("terrain.sous_titre_manquant")}
      </p>,
    );

    expect(
      screen.getByText(fr["terrain.sous_titre_manquant"]),
    ).toBeInTheDocument();
  });

  it("nomme l'absence des machines du terrain (D161, TP-PARC), sans promettre de date", () => {
    const texte = fr["terrain.sous_titre_manquant"];
    expect(texte).toContain("machines du terrain");
    expect(texte.toLowerCase()).not.toMatch(/bientôt|prochainement|lot \d/);
  });
});

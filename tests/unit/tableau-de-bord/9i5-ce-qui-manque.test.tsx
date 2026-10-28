import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Page } from "@/components/mise-en-page/page";
import { fr, t } from "@/lib/i18n/fr";

/**
 * 9I5-ECRANS-INCOMPLETS-LE-DISENT — le tableau de bord dit ce qu'il ne
 * montre pas, sur le modèle du sous-titre d'« Indicateurs du mois »
 * (`indicateurs.sous_titre`, D170). Le slot `sousTitre` de `Page` est déjà
 * pris par `sousTitreTableauDeBord` sur cet écran : la phrase est un second
 * `<p>`, même classes que celui que `Page` rend pour `sousTitre`
 * (`components/mise-en-page/page.tsx`), passé en enfant — exactement la
 * forme posée dans `app/(back-office)/tableau-de-bord/page.tsx`.
 */
describe("tableau de bord — ce qui manque est dit à l'écran", () => {
  it("affiche la clé tableau_de_bord.sous_titre_manquant, jamais un texte en dur", () => {
    render(
      <Page titre={fr["tableau_de_bord.titre"]}>
        <p className="text-app-encre-faible text-[13px] font-bold">
          {t("tableau_de_bord.sous_titre_manquant")}
        </p>
      </Page>,
    );

    expect(
      screen.getByText(fr["tableau_de_bord.sous_titre_manquant"]),
    ).toBeInTheDocument();
  });

  it("dit ce qui manque, au présent, sans promettre de date", () => {
    const texte = fr["tableau_de_bord.sous_titre_manquant"];
    expect(texte).toContain("ne facture pas");
    expect(texte.toLowerCase()).not.toMatch(/bientôt|prochainement|lot \d/);
  });
});

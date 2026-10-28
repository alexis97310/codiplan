import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Page } from "@/components/mise-en-page/page";
import { fr, t } from "@/lib/i18n/fr";

/**
 * 9I5-ECRANS-INCOMPLETS-LE-DISENT — le registre VGP dit ce qu'il ne montre
 * pas, sur le modèle du sous-titre d'« Indicateurs du mois ». `sousTitre`
 * est déjà pris par la phrase sur la conformité (D88/D166) : la phrase sur
 * l'onglet « Réserves » absent (D166) est un second `<p>`, mêmes classes,
 * exactement la forme posée dans `app/(back-office)/vgp/page.tsx`.
 */
describe("VGP — ce qui manque est dit à l'écran", () => {
  it("affiche la clé vgp.sous_titre_manquant, jamais un texte en dur", () => {
    render(
      <Page titre={fr["vgp.titre"]} sousTitre={fr["vgp.sous_titre"]}>
        <p className="text-app-encre-faible text-[13px] font-bold">
          {t("vgp.sous_titre_manquant")}
        </p>
      </Page>,
    );

    expect(screen.getByText(fr["vgp.sous_titre"])).toBeInTheDocument();
    expect(screen.getByText(fr["vgp.sous_titre_manquant"])).toBeInTheDocument();
  });

  it("nomme l'absence de l'onglet « Réserves », au présent, sans promettre de date", () => {
    const texte = fr["vgp.sous_titre_manquant"];
    expect(texte).toContain("réserves");
    expect(texte.toLowerCase()).not.toMatch(/bientôt|prochainement|lot \d/);
  });
});

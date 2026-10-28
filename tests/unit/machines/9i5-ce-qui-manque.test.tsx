import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Page } from "@/components/mise-en-page/page";
import { fr, t } from "@/lib/i18n/fr";

/**
 * 9I5-ECRANS-INCOMPLETS-LE-DISENT — la fiche machine dit ce qu'elle ne
 * montre pas, sur le modèle du sous-titre d'« Indicateurs du mois ». Le
 * slot `sousTitre` de `Page` est libre sur cet écran (aucun appelant ne le
 * posait avant ce ticket) : `app/(back-office)/parc/[id]/page.tsx` le pose
 * directement, comme `indicateurs/page.tsx` le fait pour la sienne.
 */
describe("fiche machine — ce qui manque est dit à l'écran", () => {
  it("affiche la clé machine.fiche.sous_titre_manquant via le sous-titre de Page", () => {
    render(
      <Page
        titre={fr["machine.fiche.titre"]}
        sousTitre={t("machine.fiche.sous_titre_manquant")}
      >
        {null}
      </Page>,
    );

    expect(
      screen.getByText(fr["machine.fiche.sous_titre_manquant"]),
    ).toBeInTheDocument();
  });

  it("nomme les gestes et la carte VGP absents (D192, QT-12), au présent, sans promettre de date", () => {
    const texte = fr["machine.fiche.sous_titre_manquant"];
    expect(texte).toContain("gestes sur la machine");
    expect(texte).toContain("carte VGP séparée");
    expect(texte.toLowerCase()).not.toMatch(/bientôt|prochainement|lot \d/);
  });
});

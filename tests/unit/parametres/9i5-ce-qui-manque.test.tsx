import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Page } from "@/components/mise-en-page/page";
import { fr, t } from "@/lib/i18n/fr";
import { motDansUnePhrase } from "@/lib/i18n/vocabulaire";

/**
 * 9I5-ECRANS-INCOMPLETS-LE-DISENT — « Données à compléter » dit ce qu'elle
 * ne compte pas, sur le modèle du sous-titre d'« Indicateurs du mois ».
 * `sousTitre` est déjà pris (`donnees_a_completer.sous_titre`) : la phrase
 * sur les cinq points hors de ce lot (D170, QE-19 (a)) est un second `<p>`,
 * mêmes classes, exactement la forme posée dans
 * `app/(back-office)/parametres/donnees/page.tsx` — coupée en trois clés
 * pour que « site »/« agence » se composent depuis `motDansUnePhrase` (§3,
 * D5/D47) plutôt que de s'écrire dans le dictionnaire.
 */
describe("Données à compléter — ce qui manque est dit à l'écran", () => {
  it("affiche la phrase complète (clés + mots composés), jamais un texte en dur", () => {
    render(
      <Page
        titre={fr["donnees_a_completer.titre"]}
        sousTitre={fr["donnees_a_completer.sous_titre"]}
      >
        <p className="text-app-encre-faible text-[13px] font-bold">
          {t("donnees_a_completer.sous_titre_manquant_1")}{" "}
          {motDansUnePhrase("site", true)}{" "}
          {t("donnees_a_completer.sous_titre_manquant_2")}{" "}
          {motDansUnePhrase("agence", true)}{" "}
          {t("donnees_a_completer.sous_titre_manquant_3")}
        </p>
      </Page>,
    );

    expect(
      screen.getByText(fr["donnees_a_completer.sous_titre"]),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `${fr["donnees_a_completer.sous_titre_manquant_1"]} ${motDansUnePhrase("site", true)} ${fr["donnees_a_completer.sous_titre_manquant_2"]} ${motDansUnePhrase("agence", true)} ${fr["donnees_a_completer.sous_titre_manquant_3"]}`,
      ),
    ).toBeInTheDocument();
  });

  it("nomme les cinq points hors de ce lot (D170, QE-19 (a)), sans promettre de date, sans écrire « site » ni « agence »", () => {
    for (const cle of [
      "donnees_a_completer.sous_titre_manquant_1",
      "donnees_a_completer.sous_titre_manquant_2",
      "donnees_a_completer.sous_titre_manquant_3",
    ] as const) {
      expect(fr[cle].toLowerCase()).not.toMatch(/\b(?:agences?|sites?)\b/);
      expect(fr[cle].toLowerCase()).not.toMatch(/bientôt|prochainement|lot \d/);
    }
    expect(fr["donnees_a_completer.sous_titre_manquant_1"]).toContain(
      "Cinq autres",
    );
  });
});

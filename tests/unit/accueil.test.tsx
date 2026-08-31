import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PageAccueil from "@/app/page";
import { fr } from "@/lib/i18n/fr";

/*
 * Ticket L0-01 — critère d'acceptation : la page d'accueil affiche « CODIPLAN ».
 *
 * Le texte ATTENDU vient du dictionnaire, et non d'un littéral recopié ici
 * (L0-11) : un scénario de rendu qui fige la chaîne de son côté ne prouve plus
 * que l'écran la tient du dictionnaire — il prouve seulement que deux endroits
 * disent la même chose, jusqu'au jour où l'un des deux change. Que la valeur
 * soit bien « CODIPLAN » se vérifie là où le dictionnaire est le SUJET, dans
 * `tests/unit/i18n/dictionnaire.test.ts`.
 */
describe("page d'accueil", () => {
  it("affiche le titre du dictionnaire en premier niveau", () => {
    render(<PageAccueil />);

    expect(
      screen.getByRole("heading", { level: 1, name: fr["accueil.titre"] }),
    ).toBeInTheDocument();
  });

  it("ne rend que des chaînes issues du dictionnaire français", () => {
    render(<PageAccueil />);

    const chainesAttendues = [
      fr["accueil.titre"],
      fr["accueil.accroche"],
      fr["accueil.socle"],
      fr["accueil.action"],
    ];

    for (const chaine of chainesAttendues) {
      expect(screen.getByText(chaine)).toBeInTheDocument();
    }
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PageAccueil from "@/app/page";
import { fr } from "@/lib/i18n/fr";

// Ticket L0-01 — critère d'acceptation : la page d'accueil affiche « CODIPLAN ».
describe("page d'accueil", () => {
  it("affiche CODIPLAN comme titre de premier niveau", () => {
    render(<PageAccueil />);

    expect(
      screen.getByRole("heading", { level: 1, name: "CODIPLAN" }),
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

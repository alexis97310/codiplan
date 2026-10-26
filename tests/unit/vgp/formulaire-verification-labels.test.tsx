import { createElement } from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormulaireVerification } from "@/components/vgp/formulaire-verification";
import { fr } from "@/lib/i18n/fr";

/**
 * 9G6-FORMULAIRES, point 5 — LE FORMULAIRE VGP PORTE « (OBLIGATOIRE) » /
 * « (FACULTATIF) », ET UN « ANNULER ».
 *
 * Avant ce lot, les cinq champs n'avaient AUCUNE mention malgré trois
 * `required` (`date_verification`, `origine`, `organisme`) et deux facultatifs
 * (`reference_rapport`, `observations`) ; le formulaire n'avait pas non plus
 * de lien « Annuler » à côté d'« Enregistrer », contrairement aux autres
 * formulaires de création/modification du dépôt.
 */
describe("FormulaireVerification — mentions obligatoire/facultatif, et Annuler", () => {
  it("les trois champs requis portent « (obligatoire) »", () => {
    render(
      createElement(FormulaireVerification, {
        action: "/api/vgp/enregistrer/machine-1",
        dateMax: "2026-10-26",
      }),
    );
    expect(
      screen.getByLabelText(
        `${fr["vgp.verifier.champ.date_verification"]} ${fr["intervention.creation.obligatoire_suffixe"]}`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        `${fr["vgp.verifier.champ.origine"]} ${fr["intervention.creation.obligatoire_suffixe"]}`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        `${fr["vgp.verifier.champ.organisme"]} ${fr["intervention.creation.obligatoire_suffixe"]}`,
      ),
    ).toBeInTheDocument();
  });

  it("les deux champs facultatifs portent « (facultatif) »", () => {
    render(
      createElement(FormulaireVerification, {
        action: "/api/vgp/enregistrer/machine-1",
        dateMax: "2026-10-26",
      }),
    );
    expect(
      screen.getByLabelText(
        `${fr["vgp.verifier.champ.reference_rapport"]} ${fr["intervention.creation.facultatif_suffixe"]}`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        `${fr["vgp.verifier.champ.observations"]} ${fr["intervention.creation.facultatif_suffixe"]}`,
      ),
    ).toBeInTheDocument();
  });

  it("« Annuler » mène au registre VGP", () => {
    render(
      createElement(FormulaireVerification, {
        action: "/api/vgp/enregistrer/machine-1",
        dateMax: "2026-10-26",
      }),
    );
    const lien = screen.getByRole("link", {
      name: fr["vgp.verifier.annuler"],
    });
    expect(lien).toHaveAttribute("href", "/vgp");
  });
});

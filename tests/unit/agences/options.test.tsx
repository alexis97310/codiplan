import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OptionsAgence } from "@/components/agences/options";
import { mot } from "@/lib/i18n/vocabulaire";

/**
 * LE MENU DE RATTACHEMENT DISTINGUE DEUX AGENCES DE MÊME LIBELLÉ
 * (AGENCE-CODE-1).
 *
 * ## Ce que ce fichier éprouve, et pourquoi UN SEUL composant suffit
 *
 * `OptionsAgence` est le SEUL endroit qui compose les `<option>` d'un menu de
 * rattachement — le rattachement d'un technicien (`parametres/equipe`), le
 * filtre du registre (`/interventions`), et le rattachement d'un site
 * (`/sites/nouveau`, `/sites/[id]`) l'importent tous les quatre. Avant ce
 * lot, chacun de ces quatre écrans composait sa propre liste avec
 * `{agence.libelle}` seul : deux agences de même libellé y rendaient deux
 * options au texte IDENTIQUE, impossibles à distinguer au clavier comme à la
 * souris. Éprouver ce composant unique éprouve les quatre écrans qui
 * l'utilisent — une divergence future se verrait ici, pas quatre fois.
 *
 * Mesuré le 23/09/2026 sur la base de production d'Alexis : deux agences
 * « DUCOS » y coexistent avec deux identifiants distincts.
 */
describe("OptionsAgence (AGENCE-CODE-1)", () => {
  it("deux agences de même libellé et de codes différents rendent deux options au texte distinct", () => {
    render(
      <select aria-label={mot("agence")}>
        <OptionsAgence
          agences={[
            { id: "11111111-1111-7111-8111-111111111111", libelle: "Ducos", code: "DUCOS" },
            { id: "22222222-2222-7222-8222-222222222222", libelle: "Ducos", code: "DUCOS-2" },
          ]}
        />
      </select>,
    );

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    const textes = options.map((option) => option.textContent);
    // Le défaut mesuré, exactement : avant ce lot, les deux textes auraient
    // été « Ducos » et « Ducos » — indiscernables.
    expect(new Set(textes).size).toBe(2);
    expect(textes.every((texte) => texte?.startsWith("Ducos"))).toBe(true);
    expect(screen.getByText(/DUCOS-2/)).toBeInTheDocument();
    expect(screen.getByText(/^Ducos.*DUCOS$/)).toBeInTheDocument();
  });
});

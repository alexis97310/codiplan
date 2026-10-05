import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FilAriane } from "@/components/navigation/fil-d-ariane";
import { fr } from "@/lib/i18n/fr";

const CLIENTS = fr["fil_ariane.clients"];
const SITES = fr["vocabulaire.site.pluriel"];
const DEMANDES = fr["nav.demandes"];
const COURANT = fr["machine.fiche.titre"];

/**
 * LE FIL D'ARIANE PARTAGÉ (9DR-TP-NAV2-RETOURS-FIL, D168). Les libellés de
 * ces scénarios viennent du dictionnaire (L0-11) — même quand ils ne
 * désignent pas, ici, l'écran qu'ils nomment en production : ce composant
 * ne lit jamais les chaînes, seulement leur position dans `elements`.
 */
describe("FilAriane", () => {
  it("ne rend rien pour une liste vide", () => {
    const { container } = render(<FilAriane elements={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("rend chaque maillon, séparé, le dernier sans lien", () => {
    render(
      <FilAriane
        elements={[
          { libelle: CLIENTS, href: "/clients" },
          { libelle: COURANT },
        ]}
      />,
    );
    screen.getByRole("navigation", { name: fr["navigation.fil_ariane"] });
    expect(
      screen.getAllByRole("link", { name: CLIENTS }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(COURANT)).toHaveAttribute("aria-current", "page");
  });

  it("le lien réduit au téléphone pointe vers le PARENT immédiat", () => {
    render(
      <FilAriane
        elements={[
          { libelle: SITES, href: "/sites" },
          { libelle: DEMANDES, href: "/clients/abc" },
          { libelle: COURANT },
        ]}
      />,
    );
    const liensParent = screen.getAllByRole("link", { name: DEMANDES });
    expect(liensParent.length).toBeGreaterThan(0);
    expect(liensParent[0]).toHaveAttribute("href", "/clients/abc");
  });

  it("un seul maillon (aucun parent) : aucun lien réduit", () => {
    render(<FilAriane elements={[{ libelle: COURANT }]} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText(COURANT)).toHaveAttribute("aria-current", "page");
  });
});

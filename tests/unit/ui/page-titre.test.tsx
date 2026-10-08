import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Page } from "@/components/mise-en-page/page";
import { fr } from "@/lib/i18n/fr";

/**
 * LE `<h1>` DE `Page`, SANS PASTILLES NI FAITS — régression du 08/10/2026
 * (addendum 9EM-CORRECTIFS-ALEXIS-08-10, point 4).
 *
 * 9EE-TP-UX4-1-FICHE-INTERVENTION-1 a rendu le `<h1>` de TOUS les appelants
 * (41 au moment du constat) `flex flex-wrap items-center gap-3`, le titre
 * enveloppé dans `<span className="min-w-0 break-all">` — alors que ce
 * besoin ne vient que de la fiche intervention, seul écran à poser des
 * `pastilles` ou des `faits` à côté du titre. Un titre long peut désormais
 * être coupé au milieu d'un mot sur les quarante autres écrans. Ce fichier
 * garde les deux rendus séparés : identique à celui d'avant 9EE-1 quand
 * `pastilles` et `faits` sont absents, inchangé (flex + `break-all`) sinon.
 */
describe("le <h1> de Page", () => {
  it("sans pastilles ni faits, le <h1> n'a ni flex ni break-all (rendu de 23e45c98)", () => {
    render(<Page titre={fr["client.actif"]}>{null}</Page>);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.className).not.toContain("break-all");
    expect(h1.className).not.toContain("flex");
    expect(h1.textContent).toBe(fr["client.actif"]);
  });

  it("avec des pastilles, le <h1> garde flex et break-all sur le titre", () => {
    render(
      <Page
        titre={fr["client.actif"]}
        pastilles={<span>{fr["clients.inactif"]}</span>}
      >
        {null}
      </Page>,
    );
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.className).toContain("flex");
    const span = screen.getByText(fr["client.actif"]);
    expect(span.className).toContain("break-all");
  });

  it("avec des faits, le <h1> garde flex et break-all sur le titre", () => {
    render(
      <Page
        titre={fr["client.actif"]}
        faits={<span>{fr["client.ridet"]}</span>}
      >
        {null}
      </Page>,
    );
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.className).toContain("flex");
    const span = screen.getByText(fr["client.actif"]);
    expect(span.className).toContain("break-all");
  });
});

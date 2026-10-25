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
 * `pastilles` et `faits` sont absents, inchangé (flex + coupure aux mots)
 * sinon.
 *
 * `break-all` coupait un mot même quand il n'y avait aucun débordement à
 * éviter (« Atlas C / opco GA-11 » coupé en deux, 9G3-TITRES-CIBLES-ACTIONS,
 * point 1) : `break-words hyphens-auto` ne coupe qu'en dernier recours, et
 * avec une césure plutôt qu'une coupure arbitraire.
 */
describe("le <h1> de Page", () => {
  it("sans pastilles ni faits, le <h1> n'a ni flex ni break-words (rendu de 23e45c98)", () => {
    render(<Page titre={fr["client.actif"]}>{null}</Page>);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.className).not.toContain("break-words");
    expect(h1.className).not.toContain("flex");
    expect(h1.textContent).toBe(fr["client.actif"]);
  });

  it("avec des pastilles, le <h1> garde flex et une coupure aux mots sur le titre, jamais break-all", () => {
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
    expect(span.className).toContain("break-words");
    expect(span.className).toContain("hyphens-auto");
    expect(span.className).not.toContain("break-all");
  });

  it("avec des faits, le <h1> garde flex et une coupure aux mots sur le titre, jamais break-all", () => {
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
    expect(span.className).toContain("break-words");
    expect(span.className).toContain("hyphens-auto");
    expect(span.className).not.toContain("break-all");
  });
});

/**
 * `<main id="contenu">` PORTE UNE MARGE DE DÉFILEMENT (9G3-TITRES-CIBLES-
 * ACTIONS, point 4) — sans elle, le lien d'évitement de
 * `app/(back-office)/layout.tsx` amène le focus SOUS les bandeaux collants
 * (`BandeauMobile`, 52 px ; `BandeauBureau`, 64 px dès 901 px) : le `<h1>`
 * arrive flush avec le haut de la fenêtre, donc masqué derrière eux.
 */
describe('la cible du lien d\'évitement (<main id="contenu">)', () => {
  it("porte scroll-mt-[52px], effacé par min-[901px]:scroll-mt-[64px]", () => {
    const { container } = render(
      <Page titre={fr["client.actif"]}>{null}</Page>,
    );
    const main = container.querySelector("main#contenu");
    expect(main).not.toBeNull();
    expect(main!.className).toContain("scroll-mt-[52px]");
    expect(main!.className).toContain("min-[901px]:scroll-mt-[64px]");
  });
});

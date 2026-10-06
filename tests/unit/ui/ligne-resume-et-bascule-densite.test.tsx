import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BasculeDensite } from "@/components/ui/bascule-densite";
import { LigneResume } from "@/components/ui/ligne-resume";
import { fr, t } from "@/lib/i18n/fr";

/**
 * `LigneResume` ET `BasculeDensite` (TP-UX3-1-REGISTRE-1, §5.3 de la
 * spécification du 28/09/2026) — deux composants neufs du registre.
 */
describe("LigneResume", () => {
  it("« <b>N interventions</b> · tri : … », sans lien quand aucun filtre n'est actif", () => {
    const { container } = render(
      <LigneResume
        nombre={3}
        libelleUn={fr["interventions.resultat_un"]}
        libellePluriel={fr["interventions.resultat"]}
        texteTri={fr["interventions.ordre.toutes"]}
      />,
    );
    expect(container.querySelector("b")?.textContent).toBe(
      `3 ${fr["interventions.resultat"]}`,
    );
    expect(container.textContent).toContain(fr["interventions.ordre.toutes"]);
    expect(
      screen.queryByText(fr["interventions.puce_tout_effacer"]),
    ).not.toBeInTheDocument();
  });

  it("le singulier s'accorde à 1, jamais « 1 interventions »", () => {
    const { container } = render(
      <LigneResume
        nombre={1}
        libelleUn={fr["interventions.resultat_un"]}
        libellePluriel={fr["interventions.resultat"]}
        texteTri={fr["interventions.ordre.toutes"]}
      />,
    );
    expect(container.querySelector("b")?.textContent).toBe(
      `1 ${fr["interventions.resultat_un"]}`,
    );
  });

  it("`hrefEffacer` fourni — le lien « Effacer les filtres » apparaît, et mène à cette adresse", () => {
    render(
      <LigneResume
        nombre={0}
        libelleUn={fr["interventions.resultat_un"]}
        libellePluriel={fr["interventions.resultat"]}
        texteTri={fr["interventions.ordre.a_planifier"]}
        hrefEffacer="/interventions?vue=a_planifier"
      />,
    );
    expect(
      screen.getByRole("link", { name: fr["interventions.puce_tout_effacer"] }),
    ).toHaveAttribute("href", "/interventions?vue=a_planifier");
  });
});

describe("BasculeDensite", () => {
  it("« Confort » actif par défaut — aria-current sur Confort seulement", () => {
    render(
      <BasculeDensite
        hrefConfort="/interventions"
        hrefCompact="/interventions?densite=compact"
        actif="confort"
      />,
    );
    expect(
      screen.getByRole("link", { name: t("densite.confort") }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: t("densite.compact") }),
    ).not.toHaveAttribute("aria-current");
  });

  it("« Compact » actif — aria-current bascule, les href restent ceux fournis", () => {
    render(
      <BasculeDensite
        hrefConfort="/interventions?q=x"
        hrefCompact="/interventions?q=x&densite=compact"
        actif="compact"
      />,
    );
    expect(
      screen.getByRole("link", { name: t("densite.compact") }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: t("densite.confort") }),
    ).toHaveAttribute("href", "/interventions?q=x");
    expect(
      screen.getByRole("link", { name: t("densite.compact") }),
    ).toHaveAttribute("href", "/interventions?q=x&densite=compact");
  });
});

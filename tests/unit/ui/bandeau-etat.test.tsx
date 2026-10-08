import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BandeauEtat } from "@/components/ui/bandeau-etat";
import { fr } from "@/lib/i18n/fr";

/**
 * LE BANDEAU D'ÉTAT DE LA FICHE (9EE-TP-UX4-1-FICHE-INTERVENTION-1) — quatre
 * tons, dont « information » que `Message` (`components/ui/message.tsx`) ne
 * porte pas.
 *
 * Titre et texte viennent du dictionnaire, jamais d'une phrase inventée ici
 * (le gardien `sans-chaine-visible-en-dur` refuse tout texte litteral dans
 * une requête d'écran).
 */
const TITRE = fr["intervention.bandeau.planifiee"];
const TEXTE = fr["intervention.bandeau.cloture_impossible"];

describe("BandeauEtat", () => {
  it("rend le titre et le texte", () => {
    const { getByText } = render(
      <BandeauEtat ton="information" titre={TITRE} texte={TEXTE} />,
    );
    expect(getByText(TITRE)).not.toBeNull();
    expect(getByText(TEXTE)).not.toBeNull();
  });

  it("rend sans texte quand aucun n'est fourni", () => {
    const { getByRole } = render(<BandeauEtat ton="succes" titre={TITRE} />);
    expect(getByRole("status").textContent).toBe(TITRE);
  });

  it.each([
    ["information", "status"],
    ["avertissement", "status"],
    ["succes", "status"],
    ["refus", "alert"],
  ] as const)("ton « %s » porte le rôle « %s »", (ton, role) => {
    const { getByRole } = render(<BandeauEtat ton={ton} titre={TITRE} />);
    expect(getByRole(role)).not.toBeNull();
  });

  it("le ton « information » porte les jetons `app-bleu-*`", () => {
    const { getByRole } = render(
      <BandeauEtat ton="information" titre={TITRE} />,
    );
    expect(getByRole("status").className).toContain("bg-app-bleu-fond");
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BoutonPlus } from "@/components/ui/bouton-plus";
import { Role } from "@/lib/auth/roles";
import { fr } from "@/lib/i18n/fr";

/**
 * LE BOUTON « + » FLOTTANT — RIEN sans la capacité, RIEN sans session
 * (QE-6b, 9DV-TP-NAV4-TELEPHONE-GLOSSAIRE). Mêmes capacités, mêmes rôles que
 * `components/navigation/menu-creer.tsx` : une capacité absente d'un rôle
 * cache l'option là-bas, cache le bouton ici.
 */
describe("BoutonPlus", () => {
  it("ne rend rien sans session (role null)", () => {
    render(
      <BoutonPlus
        href="/interventions/nouvelle"
        capacite="creer_demande"
        libelle="planning.creer"
        role={null}
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("ne rend rien si le rôle n'a pas la capacité", () => {
    // `creer_demande` est large (ADMS, DIR, RM, RS, ADV, TEC, CLI) — seul
    // `admin_plateforme` (l'éditeur, hors société) en est exclu.
    render(
      <BoutonPlus
        href="/interventions/nouvelle"
        capacite="creer_demande"
        libelle="planning.creer"
        role={Role.admin_plateforme}
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("rend un lien accessible vers la création, quand la capacité le permet", () => {
    render(
      <BoutonPlus
        href="/interventions/nouvelle"
        capacite="creer_demande"
        libelle="planning.creer"
        role={Role.admin_societe}
      />,
    );
    const lien = screen.getByRole("link", { name: fr["planning.creer"] });
    expect(lien).toHaveAttribute("href", "/interventions/nouvelle");
  });
});

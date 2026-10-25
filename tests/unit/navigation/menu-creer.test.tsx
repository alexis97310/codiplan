import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MenuCreer } from "@/components/navigation/menu-creer";
import { Role } from "@/lib/auth/roles";
import { fr } from "@/lib/i18n/fr";

/**
 * LE MENU « CRÉER » FERME LUI AUSSI CE QUE D221 FERME AU TECHNICIEN
 * (9G8E-NAV-TECHNICIEN-SANS-ENTREES-BUREAU) — `creer_demande` et
 * `gerer_machine` restent vraies pour ce rôle (`lib/auth/habilitations.ts`),
 * ce qui gardait « Intervention » et « Machine » dans ce menu malgré leurs
 * routes (`/interventions/nouvelle`, `/parc/nouvelle`) fermées par D221.
 * Seule `/absences?declarer=1` reste ouverte au technicien, et c'est la seule
 * option qui doit survivre ici.
 */
function ouvrirLeMenu() {
  fireEvent.click(screen.getByRole("button", { name: fr["nav.creer"] }));
}

describe("MenuCreer pour le rôle technicien", () => {
  it("ne propose que « Absence » — « Intervention » et « Machine » mènent à des routes que D221 ferme", () => {
    render(<MenuCreer role={Role.technicien} />);
    ouvrirLeMenu();
    expect(
      screen.getByRole("menuitem", { name: new RegExp(fr["creer.absence"]) }),
    ).toHaveAttribute("href", "/absences?declarer=1");
    expect(
      screen.queryByRole("menuitem", {
        name: new RegExp(fr["creer.intervention"]),
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("menuitem", { name: new RegExp(fr["creer.machine"]) }),
    ).toBeNull();
  });
});

describe("MenuCreer pour un rôle du bureau — inchangé", () => {
  it("admin_societe garde « Intervention » et « Machine », ouvertes pour lui", () => {
    render(<MenuCreer role={Role.admin_societe} />);
    ouvrirLeMenu();
    expect(
      screen.getByRole("menuitem", {
        name: new RegExp(fr["creer.intervention"]),
      }),
    ).toHaveAttribute("href", "/interventions/nouvelle");
    expect(
      screen.getByRole("menuitem", { name: new RegExp(fr["creer.machine"]) }),
    ).toHaveAttribute("href", "/parc/nouvelle");
  });
});

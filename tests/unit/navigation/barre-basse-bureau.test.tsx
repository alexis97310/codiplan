import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BarreBasseBureau } from "@/components/navigation/barre-basse-bureau";
import { FournisseurNavigationMobile } from "@/components/navigation/bandeau-mobile";
import { peut, peutPleinement } from "@/lib/auth/habilitations";
import { Role, ROLES_INTERNES } from "@/lib/auth/roles";
import { fr } from "@/lib/i18n/fr";

/**
 * LA BARRE BASSE DU BUREAU, FILTRÉE PAR CAPACITÉ — même doctrine que
 * `tests/unit/navigation/barre-par-role.test.tsx` (D132) : chaque assertion
 * s'appuie sur `peut`/`peutPleinement`, jamais sur une seconde liste de
 * rôles qui divergerait en silence de la matrice (§9, 01/09).
 */

let chemin = "/tableau-de-bord";

vi.mock("next/navigation", () => ({
  usePathname: () => chemin,
}));

function rendreLaBarrePour(role: Role) {
  return render(
    <FournisseurNavigationMobile>
      <BarreBasseBureau role={role} />
    </FournisseurNavigationMobile>,
  );
}

describe("la barre basse du bureau porte les quatre destinations, filtrées comme la barre latérale", () => {
  it.each(ROLES_INTERNES)("rôle %s", (role) => {
    chemin = "/tableau-de-bord";
    rendreLaBarrePour(role);

    const attendu = {
      "nav.barre_basse.accueil": peutPleinement(role, "consulter_planning"),
      "nav.planning": peut(role, "consulter_planning"),
      "nav.interventions": peutPleinement(role, "consulter_planning"),
      "nav.parc_machines": peut(role, "consulter_parc_complet"),
    } as const;

    for (const [cle, visible] of Object.entries(attendu)) {
      const lien = screen.queryByText(fr[cle as keyof typeof attendu]);
      expect(lien, `${cle} pour ${role}`).toSatisfy((n: unknown) =>
        visible ? n !== null : n === null,
      );
    }
  });

  it("« Plus » est toujours présent, quel que soit le rôle", () => {
    chemin = "/tableau-de-bord";
    rendreLaBarrePour(Role.technicien);
    expect(screen.getByText(fr["nav.barre_basse.plus"])).toBeVisible();
  });

  it("la destination active porte aria-current, par préfixe de segment", () => {
    chemin = "/interventions/nouvelle";
    rendreLaBarrePour(Role.admin_societe);

    const interventions = screen
      .getByText(fr["nav.interventions"])
      .closest("a");
    expect(interventions).toHaveAttribute("aria-current", "page");

    const accueil = screen
      .getByText(fr["nav.barre_basse.accueil"])
      .closest("a");
    expect(accueil).not.toHaveAttribute("aria-current");
  });

  it("« Plus » ouvre le même tiroir que le bandeau mobile (aria-controls, aria-expanded)", () => {
    chemin = "/tableau-de-bord";
    rendreLaBarrePour(Role.admin_societe);

    const bouton = screen
      .getByText(fr["nav.barre_basse.plus"])
      .closest("button");
    expect(bouton).toHaveAttribute("aria-controls", "colonne-navigation");
    expect(bouton).toHaveAttribute("aria-expanded", "false");
  });
});

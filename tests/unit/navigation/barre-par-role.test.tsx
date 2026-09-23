import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BarreDeNavigation } from "@/components/navigation/barre";
import { peut } from "@/lib/auth/habilitations";
import { Role } from "@/lib/auth/roles";
import { fr } from "@/lib/i18n/fr";
import { ENTREES, feuilles } from "@/lib/navigation/entrees";
import { THEME_DEFAUT } from "@/lib/theme/theme";

/**
 * LA BARRE DU BACK-OFFICE NE MONTRE PLUS CE QU'ON NE PEUT PAS OUVRIR — D132
 * (23/09/2026, VISUEL-1).
 *
 * *Mesuré en production le 23/09 sur un compte `admin_societe` (audit Codex) :
 * « Contrats » et « Console éditeur » n'ouvraient rien pour aucun rôle ;
 * « Portail client » menait à une page « réservée aux clients » ; « App
 * technicien » redirigeait sans explication.* Ce fichier éprouve le REMÈDE,
 * pas le CONSTAT : `entreesAffichables` (`lib/navigation/entrees.ts`) retire
 * toujours les entrées inertes, et retire une entrée réelle quand le rôle
 * fourni n'a pas la capacité que `CAPACITE_REQUISE` lui associe.
 *
 * **Aucune seconde liste de rôles ici.** Chaque assertion s'appuie sur
 * `peut(role, capacité)`, lu dans `lib/auth/habilitations.ts` — la même
 * matrice que la porte des routes consulte. Si la matrice change un jour,
 * c'est elle qui fait rougir ce scénario, jamais une copie qui aurait
 * divergé en silence (§9, 01/09).
 */

vi.mock("next/navigation", () => ({ usePathname: () => "/planning" }));

function rendreLaBarrePour(role: Role) {
  render(
    <BarreDeNavigation
      theme={THEME_DEFAUT}
      initiales="AB"
      entrees={ENTREES}
      role={role}
      accueil="/planning"
    />,
  );
}

describe("la barre du back-office rendue pour admin_societe", () => {
  it("ne porte ni « Contrats » ni « Console éditeur » — les deux sont inertes", () => {
    rendreLaBarrePour(Role.admin_societe);
    expect(screen.queryByText(fr["nav.contrats"])).toBeNull();
    expect(screen.queryByText(fr["nav.console_editeur"])).toBeNull();
  });

  it("ne porte pas « Portail client » — la capacité qui l'ouvre n'appartient qu'au rôle client", () => {
    // Le témoin : c'est bien parce qu'admin_societe n'a PAS cette capacité
    // que l'entrée doit disparaître — sans lui, l'assertion suivante ne
    // prouverait rien de la matrice, seulement du code de ce test.
    expect(peut(Role.admin_societe, "consulter_parc_propre")).toBe(false);
    rendreLaBarrePour(Role.admin_societe);
    expect(screen.queryByText(fr["nav.portail_client"])).toBeNull();
  });

  it("garde les destinations pour lesquelles admin_societe a bien la capacité", () => {
    // La paire qui prouve que le filtre ne masque pas tout : Planning
    // (consulter_planning) et Sociétés & tarifs (parametrer_societe) sont
    // toutes deux au complet pour ce rôle.
    expect(peut(Role.admin_societe, "consulter_planning")).toBe(true);
    expect(peut(Role.admin_societe, "parametrer_societe")).toBe(true);
    rendreLaBarrePour(Role.admin_societe);
    expect(
      screen.getByRole("link", { name: fr["nav.planning"] }),
    ).toHaveAttribute("href", "/planning");
    expect(
      screen.getByRole("link", { name: fr["nav.societes_tarifs"] }),
    ).toHaveAttribute("href", "/parametres");
  });

  it("aucune entrée rendue n'est ni inerte ni hors de la capacité du rôle", () => {
    // La forme générale de l'assertion ci-dessus, sur les quatorze
    // destinations plutôt que sur un échantillon choisi à la main.
    rendreLaBarrePour(Role.admin_societe);
    const nav = screen.getByRole("navigation");
    for (const entree of feuilles(ENTREES)) {
      const rendue = nav.textContent?.includes(fr[entree.cle]) ?? false;
      if (entree.chemin === null) {
        expect(rendue, `${fr[entree.cle]} est inerte`).toBe(false);
      }
    }
  });
});

import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { fr } from "@/lib/i18n";
import { MenuGestesAccesActif } from "@/app/(back-office)/parametres/equipe/menu-nouveau-lien";

/**
 * DÉCISION B d'Alexis (30/10/2026, D223, 9I7D-RESERVES-DE-REVUE-ACCES-ET-
 * MENTIONS) — l'entrée « Copier le lien d'accès » du menu « … » disparaît
 * pour un compte de direction ou un autre administrateur de société
 * (`copieNouveauLienAutorisee={false}`, posé par `page.tsx` sur
 * `estCibleProtegeeCopieNouveauLien`) : jamais un bouton que le serveur
 * refuserait quand même. « Envoyer un nouveau lien d'accès » (le courriel)
 * n'est pas concerné — il reste toujours présent.
 */
describe("MenuGestesAccesActif — décision B, cible protégée (D223)", () => {
  it("l'entrée « Copier » est présente par défaut (technicien, ou un rôle de bureau non protégé)", () => {
    const { getByLabelText, getByRole, getByText } = render(
      <MenuGestesAccesActif
        nom="Personne de l'épreuve"
        courriel="personne@codima.test"
        action="/api/equipe/x/nouveau-lien"
        actionCopier="/api/equipe/x/copier-nouveau-lien"
      />,
    );
    fireEvent.click(getByLabelText(fr["ui.menu_plus.titre"]));
    expect(getByRole("menu")).toBeInTheDocument();
    expect(getByText(fr["equipe.menu.nouveau_lien"])).toBeInTheDocument();
    expect(
      getByRole("menuitem", {
        name: new RegExp(fr["equipe.acces.copier_lien"]),
      }),
    ).toBeInTheDocument();
  });

  it("l'entrée « Copier » disparaît quand copieNouveauLienAutorisee=false, « Envoyer » reste", () => {
    const { getByLabelText, getByRole, getByText, queryByRole } = render(
      <MenuGestesAccesActif
        nom="Compte de direction de l'épreuve"
        courriel="direction@codima.test"
        action="/api/equipe/bureau/x/nouveau-lien"
        actionCopier="/api/equipe/bureau/x/copier-nouveau-lien"
        copieNouveauLienAutorisee={false}
      />,
    );
    fireEvent.click(getByLabelText(fr["ui.menu_plus.titre"]));
    expect(getByRole("menu")).toBeInTheDocument();
    expect(getByText(fr["equipe.menu.nouveau_lien"])).toBeInTheDocument();
    expect(
      queryByRole("menuitem", {
        name: new RegExp(fr["equipe.acces.copier_lien"]),
      }),
    ).toBeNull();
  });
});

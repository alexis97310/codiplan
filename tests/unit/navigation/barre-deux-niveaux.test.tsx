import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BarreDeNavigation } from "@/components/navigation/barre";
import { fr } from "@/lib/i18n/fr";
import { ENTREES } from "@/lib/navigation/entrees";
import { THEME_DEFAUT } from "@/lib/theme/theme";

/**
 * LA BARRE DU BACK-OFFICE SUR DEUX NIVEAUX (D118).
 *
 * `tests/unit/navigation/entrees.test.ts` éprouve la LISTE — six entrées de
 * premier niveau, dix destinations une fois les groupes ouverts, aucun
 * libellé inventé. Ce fichier éprouve le RENDU : un groupe s'ouvre au clic sur
 * son titre, ce titre n'est lui-même jamais une destination, et une entrée
 * inerte nichée reste inerte au même titre qu'une entrée inerte de premier
 * niveau.
 */

vi.mock("next/navigation", () => ({ usePathname: () => "/planning" }));

function rendreLaBarre() {
  render(
    <BarreDeNavigation
      theme={THEME_DEFAUT}
      initiales="AB"
      entrees={ENTREES}
      accueil="/planning"
    />,
  );
}

describe("le groupe « Planning »", () => {
  it("son titre n'est pas un lien — c'est un <summary>, jamais un <a>", () => {
    // La preuve porte sur la BALISE plutôt que sur le rôle accessible : un
    // `<summary>` nu n'expose PAS `button` sous Chromium (mesuré le
    // 17/09/2026, #217/#220) — c'est `role="button"` qui le porte
    // explicitement sur l'élément, et une balise reste vraie quel que soit le
    // moteur d'accessibilité qui la lit.
    rendreLaBarre();
    const nav = screen.getByRole("navigation");
    const titre = within(nav).getByText(fr["nav.planning"], {
      selector: "summary",
    });
    // Un lien direct vers /planning existerait AUSSI au premier niveau si le
    // titre du groupe en était un — ce n'est pas le cas ici : le seul lien
    // nommé « Planning » est celui du sous-menu, jamais le titre.
    expect(titre.closest("a")).toBeNull();
  });

  it("« Interventions » est atteignable depuis ce groupe, avec sa bonne route", () => {
    rendreLaBarre();
    const lien = screen.getByRole("link", { name: fr["nav.interventions"] });
    expect(lien).toHaveAttribute("href", "/interventions");
  });
});

describe("le groupe « Sociétés & tarifs »", () => {
  it("porte, parmi ses enfants, sa propre destination", () => {
    rendreLaBarre();
    const lien = screen.getByRole("link", { name: fr["nav.societes_tarifs"] });
    expect(lien).toHaveAttribute("href", "/parametres");
  });

  it("« Imports Excel » y est atteignable", () => {
    rendreLaBarre();
    const lien = screen.getByRole("link", { name: fr["nav.imports_excel"] });
    expect(lien).toHaveAttribute("href", "/imports");
  });

  it("ses deux entrées inertes restent inertes — pas de lien, le motif au survol", () => {
    rendreLaBarre();
    expect(
      screen.queryByRole("link", { name: fr["nav.app_technicien"] }),
    ).toBeNull();
    expect(
      screen.queryByRole("link", { name: fr["nav.console_editeur"] }),
    ).toBeNull();
    expect(screen.getByText(fr["nav.app_technicien"])).toHaveAttribute(
      "title",
      fr["nav.a_venir"],
    );
  });
});

describe("les quatre entrées qui restent au premier niveau", () => {
  it("sont des liens directs, sans passer par un groupe", () => {
    rendreLaBarre();
    const nav = screen.getByRole("navigation");
    expect(
      within(nav).getByRole("link", { name: fr["nav.parc_machines"] }),
    ).toHaveAttribute("href", "/parc");
    expect(
      within(nav).getByRole("link", { name: fr["nav.portail_client"] }),
    ).toHaveAttribute("href", "/portail");
    expect(
      within(nav).getByRole("link", { name: fr["nav.tableau_de_bord"] }),
    ).toHaveAttribute("href", "/tableau-de-bord");
  });

  it("« Contrats » reste inerte, au premier niveau", () => {
    rendreLaBarre();
    expect(screen.queryByRole("link", { name: fr["nav.contrats"] })).toBeNull();
  });
});

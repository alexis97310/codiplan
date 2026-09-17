import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BarreDeNavigation } from "@/components/navigation/barre";
import { fr } from "@/lib/i18n/fr";
import { ENTREES } from "@/lib/navigation/entrees";
import { THEME_DEFAUT } from "@/lib/theme/theme";

/**
 * LA BARRE DU BACK-OFFICE, EN COLONNE À TROIS DOMAINES (D121).
 *
 * `tests/unit/navigation/entrees.test.ts` éprouve la LISTE — trois titres de
 * domaine, quatorze destinations une fois les groupes ouverts, confrontés à
 * la maquette dans le même ordre. Ce fichier éprouve le RENDU : un titre de
 * domaine n'est ni un bouton ni un lien, ses destinations sont TOUTES
 * visibles sans le moindre clic, et une entrée inerte nichée reste inerte au
 * même titre qu'avant.
 *
 * Il remplace `barre-deux-niveaux.test.tsx` (D118) : la forme qu'il éprouvait
 * — un `<details>` qui s'ouvre au clic sur son titre — n'existe plus. C'est
 * elle qui portait le défaut mesuré par N-07 : fermer ce `<details>` DANS le
 * clic sur un de ses liens masquait ce lien pendant que sa navigation était
 * encore en vol, et `next/link` annulait la requête en cours (voir le
 * commentaire de `components/navigation/barre.tsx`). Une colonne qui ne
 * referme jamais rien ne peut plus reproduire cette course.
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

describe("le domaine « Exploitation »", () => {
  it("son titre n'est ni un lien ni un bouton — un simple texte", () => {
    rendreLaBarre();
    const nav = screen.getByRole("navigation");
    const titre = within(nav).getByText(fr["nav.groupe_exploitation"]);
    expect(titre.closest("a")).toBeNull();
    expect(titre.closest("button")).toBeNull();
    expect(
      screen.queryByRole("button", { name: fr["nav.groupe_exploitation"] }),
    ).toBeNull();
  });

  it("« Interventions » et « Absences » y sont atteignables SANS ouvrir quoi que ce soit", () => {
    rendreLaBarre();
    // Aucun `<details>` dans le document : rien à déplier avant de lire ces
    // liens, contrairement à la forme d'avant D121.
    expect(document.querySelectorAll("details")).toHaveLength(0);
    expect(
      screen.getByRole("link", { name: fr["nav.interventions"] }),
    ).toHaveAttribute("href", "/interventions");
    expect(
      screen.getByRole("link", { name: fr["nav.absences"] }),
    ).toHaveAttribute("href", "/absences");
  });
});

describe("le domaine « Clients & parc » — quatre entrées qui n'avaient encore aucune porte", () => {
  it("Clients, Sites, Parc machines et VGP mènent chacune à leur écran", () => {
    rendreLaBarre();
    expect(
      screen.getByRole("link", { name: fr["nav.clients"] }),
    ).toHaveAttribute("href", "/clients");
    expect(
      screen.getByRole("link", { name: fr["vocabulaire.site.pluriel"] }),
    ).toHaveAttribute("href", "/sites");
    expect(
      screen.getByRole("link", { name: fr["nav.parc_machines"] }),
    ).toHaveAttribute("href", "/parc");
    expect(screen.getByRole("link", { name: fr["nav.vgp"] })).toHaveAttribute(
      "href",
      "/vgp",
    );
  });
});

describe("le domaine « Paramètres »", () => {
  it("porte, parmi ses entrées, « Sociétés & tarifs » et « Imports Excel »", () => {
    rendreLaBarre();
    expect(
      screen.getByRole("link", { name: fr["nav.societes_tarifs"] }),
    ).toHaveAttribute("href", "/parametres");
    expect(
      screen.getByRole("link", { name: fr["nav.imports_excel"] }),
    ).toHaveAttribute("href", "/imports");
  });

  it("ses trois entrées inertes restent inertes — pas de lien, le motif au survol", () => {
    rendreLaBarre();
    for (const cle of [
      "nav.contrats",
      "nav.app_technicien",
      "nav.console_editeur",
    ] as const) {
      expect(screen.queryByRole("link", { name: fr[cle] })).toBeNull();
      expect(screen.getByText(fr[cle])).toHaveAttribute(
        "title",
        fr["nav.a_venir"],
      );
    }
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BarreDeNavigation } from "@/components/navigation/barre";
import { fr, type CleTraduction } from "@/lib/i18n/fr";
import { ENTREES, ENTREES_PORTAIL, feuilles } from "@/lib/navigation/entrees";
import { THEME_DEFAUT } from "@/lib/theme/theme";

/**
 * LES ICÔNES DU MENU (D139, TP-UX1-3, commit « icônes du menu »).
 *
 * `navModel()` de la maquette du 28/09 (:1918-1933) pose une icône devant
 * chacune des douze destinations qu'elle dessine. `ENTREES`/`ENTREES_PORTAIL`
 * (`lib/navigation/entrees.ts`) n'est pas modifié ici : la table `chemin →
 * NomIcone` vit dans `components/navigation/barre.tsx` (§ « CE QUE CE
 * TICKET FAIT »), et ce gardien éprouve le RENDU — jamais une seconde copie
 * de la table.
 *
 * **La population se DÉDUIT** de `feuilles(ENTREES)` et `ENTREES_PORTAIL` —
 * jamais une liste recopiée — filtrée aux seules entrées dont `chemin` n'est
 * pas `null` (les deux entrées inertes, `nav.contrats` et
 * `nav.console_editeur`, n'ont par construction aucune destination à
 * illustrer). Une entrée écrite demain y entre le jour où son fichier
 * apparaît.
 *
 * **UNE SEULE EXCEPTION, EXPLICITE ET EXACTE** — `nav.portail_client`
 * (`/portail`, back-office) : la maquette du 28/09 ne dessine PAS cette
 * entrée dans sa colonne (:5631) — icône à fixer par Alexis. `nav.portail_parc`
 * (barre du portail) n'a PAS besoin de cette exception : ce n'est pas la
 * MÊME entrée — voir plus bas, elle est éprouvée séparément.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/planning",
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * `nav.portail_client` seul — la maquette du 28/09 ne dessine aucune icône
 * pour cette destination (:5631). Rouge si une exception reçoit une icône,
 * ou si une entrée nouvelle n'en a pas.
 */
const EXCEPTIONS: readonly CleTraduction[] = ["nav.portail_client"];

function rendreLaBarreDuBackOffice(): void {
  render(
    <BarreDeNavigation
      theme={THEME_DEFAUT}
      initiales="AB"
      entrees={ENTREES}
      accueil="/planning"
    />,
  );
}

const DESTINATIONS = feuilles(ENTREES).filter(
  (entree) => entree.chemin !== null,
);

describe("chaque destination du back-office porte une icône, sauf l'exception nommée", () => {
  it("la population n'est pas vide", () => {
    expect(DESTINATIONS.length).toBeGreaterThan(0);
  });

  it.each(DESTINATIONS.map((entree) => [entree.cle, entree] as const))(
    "%s",
    (_cle, entree) => {
      rendreLaBarreDuBackOffice();
      const lien = screen.getByRole("link", { name: fr[entree.cle] });
      const svg = lien.querySelector("svg");
      if (EXCEPTIONS.includes(entree.cle)) {
        expect(svg).toBeNull();
      } else {
        expect(svg).not.toBeNull();
        expect(svg).toHaveAttribute("aria-hidden", "true");
      }
    },
  );
});

describe("le nom accessible de chaque lien n'a pas changé", () => {
  it.each(DESTINATIONS.map((entree) => [entree.cle, entree] as const))(
    "%s reste atteignable par son libellé seul",
    (_cle, entree) => {
      rendreLaBarreDuBackOffice();
      expect(
        screen.getByRole("link", { name: fr[entree.cle] }),
      ).toHaveAttribute("href", entree.chemin);
    },
  );
});

describe("la barre du portail — nav.portail_parc n'a pas d'icône non plus", () => {
  it("aucune icône : la maquette du 28/09 ne dessine pas cette entrée (:5631)", () => {
    render(
      <BarreDeNavigation
        theme={THEME_DEFAUT}
        initiales="AB"
        entrees={ENTREES_PORTAIL}
        accueil="/portail"
      />,
    );
    const lien = screen.getByRole("link", {
      name: fr["nav.portail_parc"],
    });
    expect(lien.querySelector("svg")).toBeNull();
  });
});

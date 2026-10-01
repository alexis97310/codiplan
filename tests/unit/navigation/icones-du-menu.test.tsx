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
 * **PLUS AUCUNE EXCEPTION** (décision d'Alexis du 30/09/2026, point 15 ;
 * D144) — `nav.portail_client` (`/portail`, back-office) ET `nav.portail_parc`
 * (`/portail`, portail) portent désormais chacune une icône, malgré le
 * chemin PARTAGÉ (`globe`/`machine`, voir `components/navigation/barre.tsx`,
 * `ICONE_PORTAIL_PAR_CLE`). La maquette du 28/09 ne dessinait aucune icône
 * pour cette destination (:5631) ; ce choix est celui du pilote, à confirmer
 * par Alexis sur capture.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/planning",
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * PLUS AUCUNE EXCEPTION (décision du 30/09/2026, point 15 ; D144) — rouge si
 * UNE SEULE destination du back-office n'a pas d'icône.
 */
const EXCEPTIONS: readonly CleTraduction[] = [];

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

describe("la barre du portail — nav.portail_parc porte désormais une icône (décision du 30/09, point 15 ; D144)", () => {
  it("une icône aria-hidden, malgré l'absence de cette destination dans la maquette du 28/09 (:5631)", () => {
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
    const svg = lien.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});

describe("aucune icône n'est portée par deux entrées de la barre du bureau (cas ajouté, D144)", () => {
  it("chaque forme SVG rendue est UNIQUE — /portail et /parc ne se confondent pas", () => {
    rendreLaBarreDuBackOffice();
    const formes = DESTINATIONS.map((entree) => {
      const lien = screen.getByRole("link", { name: fr[entree.cle] });
      const svg = lien.querySelector("svg");
      expect(svg, entree.cle).not.toBeNull();
      return svg!.innerHTML;
    });
    expect(new Set(formes).size).toBe(formes.length);
  });
});

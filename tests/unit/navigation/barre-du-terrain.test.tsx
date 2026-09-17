import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BarreDeNavigation } from "@/components/navigation/barre";
import { fr } from "@/lib/i18n/fr";
import {
  ENTREES,
  ENTREES_PORTAIL,
  ENTREES_TERRAIN,
  feuilles,
} from "@/lib/navigation/entrees";
import { THEME_DEFAUT } from "@/lib/theme/theme";

/**
 * LA BARRE DU TERRAIN NE PORTE AUCUNE ENTRÉE (R5-01).
 *
 * Même motif que R2-17 pour le portail, et même mesure : *une entrée de menu
 * renseigne par sa seule existence.* Onze entrées de back-office au-dessus d'un
 * téléphone de terrain nommeraient « Facturation » et « Contrats » à quelqu'un
 * qui ne les ouvrira jamais — et une entrée inerte inventée pour lui
 * promettrait un outil que personne n'a décidé de lui donner.
 *
 * **Ce que ce fichier éprouve dans les DEUX SENS.** Qu'aucun libellé des deux
 * autres barres n'apparaisse — c'est le cas qui doit rougir —, et que le
 * chrome soit bel et bien rendu : marque, point de retour, pastille. *Une barre
 * qui ne rendrait rien du tout passerait la première moitié, et elle la
 * passerait pour la pire des raisons* (§9, 11/09).
 */

vi.mock("next/navigation", () => ({ usePathname: () => "/terrain" }));

// `feuilles` ouvre les groupes de premier niveau (D118) : sans elle, les
// libellés nichés sous « Planning » ou « Sociétés & tarifs » — Interventions,
// Imports Excel, … — manqueraient à cette liste, et le témoin ci-dessous
// perdrait la moitié de ce qu'il est censé surveiller.
const LIBELLES_AILLEURS = [...feuilles(ENTREES), ...ENTREES_PORTAIL].map(
  (entree) => fr[entree.cle],
);

function rendreLaBarreDuTerrain() {
  render(
    <BarreDeNavigation
      theme={THEME_DEFAUT}
      initiales="ML"
      entrees={ENTREES_TERRAIN}
      accueil="/terrain"
    />,
  );
}

describe("la barre du terrain", () => {
  it("ne porte aucune entrée, et la liste le dit", () => {
    expect(ENTREES_TERRAIN).toHaveLength(0);
  });

  it("ne rend aucun libellé des deux autres barres", () => {
    rendreLaBarreDuTerrain();
    // Le témoin : la population comparée n'est pas vide — sans lui, la boucle
    // ci-dessous serait verte sur zéro libellé à chercher.
    expect(LIBELLES_AILLEURS.length).toBeGreaterThan(10);
    for (const libelle of LIBELLES_AILLEURS) {
      expect(screen.queryByText(libelle)).toBeNull();
    }
  });

  /**
   * LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON.
   *
   * « Aucune entrée » n'est pas « aucune barre » : le point de retour est
   * l'argument même qui a donné sa barre au portail, et il doit mener à la
   * journée — jamais à `/planning`, que ce compte ne doit pas ouvrir.
   */
  it("rend quand même le chrome, et sa marque retourne à la journée", () => {
    rendreLaBarreDuTerrain();
    expect(screen.getByText(fr["nav.marque_debut"])).toBeTruthy();
    const retour = screen
      .getAllByRole("link")
      .map((lien) => lien.getAttribute("href"));
    expect(retour).toContain("/terrain");
    expect(retour).not.toContain("/planning");
  });
});

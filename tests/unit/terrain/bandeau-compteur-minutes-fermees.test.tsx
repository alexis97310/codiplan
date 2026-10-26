import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BandeauCompteurEnCours } from "@/components/terrain/bandeau-compteur";

/**
 * LA MÊME DURÉE QUE LA FICHE OÙ IL TOURNE (point 7, 9G5-TERRAIN-ERGONOMIE) —
 * sans `minutesFermees`, ce bandeau ne comptait que le segment OUVERT depuis
 * `depuis` : la même intervention affichait une durée plus courte ici que
 * sur sa propre fiche (`/terrain/[id]`, qui ajoute les segments déjà
 * fermés). `instantServeur = depart` isole l'écoulé du segment ouvert à
 * zéro, pour lire directement les minutes fermées dans le texte rendu.
 */
describe("BandeauCompteurEnCours porte les minutes déjà fermées, comme la fiche de l'intervention où il tourne", () => {
  it("2 h 05 déjà fermées, segment ouvert à l'instant même : affiche 02:05:00", () => {
    const depart = new Date("2026-10-26T00:00:00.000Z");
    render(
      <BandeauCompteurEnCours
        interventionId="11111111-1111-1111-1111-111111111111"
        client="Client X"
        depuis={depart}
        fuseau="Pacific/Noumea"
        minutesFermees={125}
        instantServeur={depart}
      />,
    );
    expect(screen.getByRole("link").textContent).toContain("02:05:00");
  });

  it("sans minutesFermees (défaut), segment ouvert à l'instant même : affiche 00:00:00", () => {
    const depart = new Date("2026-10-26T00:00:00.000Z");
    render(
      <BandeauCompteurEnCours
        interventionId="11111111-1111-1111-1111-111111111111"
        client="Client X"
        depuis={depart}
        fuseau="Pacific/Noumea"
        instantServeur={depart}
      />,
    );
    expect(screen.getByRole("link").textContent).toContain("00:00:00");
  });
});

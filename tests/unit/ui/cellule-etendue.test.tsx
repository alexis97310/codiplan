import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Cellule } from "@/components/ui/tableau";
import { fr } from "@/lib/i18n/fr";

/**
 * LA PROP `etendue` DE `Cellule` (9AT-CG6, audit C-G7, 28/09/2026).
 *
 * Une cellule qui porte un motif valable pour plusieurs colonnes le dit une
 * fois, sur toute leur largeur, plutôt que de le répéter dans chacune — c'est
 * le besoin de `/parametres/trajets` pour la zone Îles. `colSpan` est absent
 * tant qu'un appelant ne le passe pas : les 24 autres appelants de `Tableau`
 * restent inchangés octet pour octet.
 */
describe("Cellule — la prop etendue", () => {
  it("sans la prop, aucun attribut colspan n'est rendu", () => {
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <Cellule>{fr["trajets.non_reglee"]}</Cellule>
          </tr>
        </tbody>
      </table>,
    );
    const td = container.querySelector("td");
    expect(td).not.toBeNull();
    expect(td).not.toHaveAttribute("colspan");
  });

  it("avec etendue={2}, la cellule porte colspan=2", () => {
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <Cellule etendue={2}>{fr["trajets.non_reglee"]}</Cellule>
          </tr>
        </tbody>
      </table>,
    );
    const td = container.querySelector("td");
    expect(td).toHaveAttribute("colspan", "2");
  });
});

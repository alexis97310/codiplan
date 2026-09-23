import { describe, expect, it } from "vitest";

import { libelleMaterielComplet } from "@/lib/machines/presentation";

/**
 * LE LIBELLÉ COMPLET D'UN MATÉRIEL (AFFICHAGE-MATERIEL-1, 23/09/2026).
 *
 * *Mesuré le 23/09/2026 en production : « il manque la famille sur la page
 * intervention ».* Alexis nomme le format exact : « Pont 2 colonnes Cascos
 * 13442 S/N 10044 ».
 */
describe("libelleMaterielComplet", () => {
  it("compose famille, marque, référence, puis S/N et le numéro de série", () => {
    expect(
      libelleMaterielComplet({
        familleLibelle: "Pont 2 colonnes",
        marque: "Cascos",
        reference: "13442",
        numeroSerie: "10044",
      }),
    ).toBe("Pont 2 colonnes Cascos 13442 S/N 10044");
  });

  it("n'omet pas un numéro de série illisible saisi SN-INCONNU-…", () => {
    expect(
      libelleMaterielComplet({
        familleLibelle: "Pont Elevateur",
        marque: "RAVAGLIOLI",
        reference: "RAV4401.4",
        numeroSerie: "SN-INCONNU-RAV4401.4",
      }),
    ).toBe("Pont Elevateur RAVAGLIOLI RAV4401.4 S/N SN-INCONNU-RAV4401.4");
  });
});

import { describe, expect, it } from "vitest";

import { titreFiche } from "../../../app/(back-office)/demandes/presentation";

/**
 * QE-9 (a) du 03/10/2026, D176 — LE TITRE DE LA FICHE D'UNE DEMANDE EST LE
 * COUPLE « <client> · <site> » (revient sur GR17-M5, audit GR du 26/09,
 * constat M5).
 *
 * `demande.titre` (« Demandes ») sert encore la liste et le `<title>` de
 * l'onglet — ce fichier ne l'éprouve pas, il éprouve `titreFiche`, la
 * composition propre à la fiche.
 */
describe("titreFiche", () => {
  it("compose « <client> · <site> » quand les deux sont lus", () => {
    expect(
      titreFiche({ raison_sociale: "Garage Boulari" }, { libelle: "Atelier" }),
    ).toBe("Garage Boulari · Atelier");
  });

  it("rend le client seul quand le site n'a pas pu être lu", () => {
    expect(titreFiche({ raison_sociale: "Garage Boulari" }, null)).toBe(
      "Garage Boulari",
    );
  });

  it("rend « Demande » seul quand le client n'a pas pu être lu", () => {
    expect(titreFiche(null, null)).toBe("Demande");
  });
});

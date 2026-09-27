import { describe, expect, it } from "vitest";

import { titreFiche } from "../../../app/(back-office)/demandes/presentation";

/**
 * GR17-M5 (audit GR du 26/09/2026, constat M5) — LE TITRE DE LA FICHE
 * D'UNE DEMANDE, DISTINCT DE CELUI DE LA LISTE.
 *
 * `demande.titre` (« Demandes ») sert encore la liste et le `<title>` de
 * l'onglet — ce fichier ne l'éprouve pas, il éprouve `titreFiche`, la
 * composition propre à la fiche.
 */
describe("titreFiche", () => {
  it("compose « Demande — <raison sociale> » quand le client est lu", () => {
    expect(titreFiche({ raison_sociale: "Garage Boulari" })).toBe(
      "Demande — Garage Boulari",
    );
  });

  it("rend « Demande » seul quand le client n'a pas pu être lu", () => {
    expect(titreFiche(null)).toBe("Demande");
  });
});

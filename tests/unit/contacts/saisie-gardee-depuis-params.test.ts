import { describe, expect, it } from "vitest";

import { saisieContactGardeeDepuis } from "@/app/(back-office)/contacts/presentation";

/**
 * LA LECTURE DE `saisieGardee` DEPUIS LES `searchParams` D'UNE FICHE
 * (9BR-TP-A4b-MESSAGES, CS46) — même lecture pour la fiche client et la
 * fiche site.
 */
describe("saisieContactGardeeDepuis", () => {
  it("rend undefined hors refus (aucun paramètre contact_*)", () => {
    expect(
      saisieContactGardeeDepuis({ motif: "clients.modifie" }),
    ).toBeUndefined();
  });

  it("lit site_id, nom, fonction et un seul rôle", () => {
    expect(
      saisieContactGardeeDepuis({
        contact_site_id: "11111111-1111-1111-1111-111111111111",
        contact_nom: "TPA4-Contact",
        contact_fonction: "Responsable",
        contact_role: "donneur_ordre",
      }),
    ).toEqual({
      site_id: "11111111-1111-1111-1111-111111111111",
      nom: "TPA4-Contact",
      fonction: "Responsable",
      roles: ["donneur_ordre"],
    });
  });

  it("lit plusieurs rôles (tableau)", () => {
    const resultat = saisieContactGardeeDepuis({
      contact_role: ["donneur_ordre", "technique"],
    });
    expect(resultat?.roles).toEqual(["donneur_ordre", "technique"]);
  });
});

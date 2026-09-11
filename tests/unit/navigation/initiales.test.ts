import { describe, expect, it } from "vitest";

import { initialesDuNom } from "@/lib/navigation/initiales";

/**
 * LES INITIALES DE LA PASTILLE (D95).
 *
 * Un nom est une donnée SAISIE : il est vide, composé, en un seul mot, ou plein
 * d'espaces. Aucun de ces cas ne doit rendre une pastille vide ni faire échouer
 * un rendu — *la charte n'est jamais un motif d'échec de rendu*, et le repère
 * qui l'accompagne non plus.
 */

describe("les initiales d'un nom", () => {
  it("prend la première lettre des deux premiers mots", () => {
    expect(initialesDuNom("Alexis Poigoune")).toBe("AP");
    expect(initialesDuNom("direction de démonstration")).toBe("DD");
  });

  it("un seul mot rend ses deux premières lettres", () => {
    expect(initialesDuNom("Wamytan")).toBe("WA");
    expect(initialesDuNom("W")).toBe("W");
  });

  it("les noms composés se coupent sur le trait d'union et l'apostrophe", () => {
    expect(initialesDuNom("Jean-Baptiste")).toBe("JB");
    expect(initialesDuNom("N'Diaye Koné")).toBe("NK");
  });

  it("rien d'utilisable rend `null` — jamais une chaîne vide", () => {
    // Une chaîne vide rendrait une pastille de couleur sans contenu, qu'on
    // lirait comme un défaut d'affichage. `null` fait disparaître la pastille.
    expect(initialesDuNom("")).toBeNull();
    expect(initialesDuNom("   ")).toBeNull();
    expect(initialesDuNom(null)).toBeNull();
    expect(initialesDuNom(undefined)).toBeNull();
  });

  it("les accents et la casse ne cassent rien", () => {
    expect(initialesDuNom("éric Étienne")).toBe("ÉÉ");
    expect(initialesDuNom("  marie   curie  ")).toBe("MC");
  });
});

import { describe, expect, it } from "vitest";

import { comparerAlphanumerique, trierAlphanumeriquement } from "@/lib/tri/collation";

/**
 * LE TRI ALPHANUMÉRIQUE DES LISTES DE RÉFÉRENTIEL (LISTES-1, 23/09/2026).
 *
 * Les deux exemples mesurés en production le 23/09/2026 : « AVIS SLAP
 * LOCATOIN » passait AVANT « Anse Vata » — les majuscules d'abord — et une
 * liste triée numériquement à la lexicographique range « Site 10 » avant
 * « Site 2 ». Ce fichier fige les DEUX cas.
 */

describe("comparerAlphanumerique", () => {
  it("ignore la casse — « Anse Vata » avant « AVIS SLAP LOCATOIN »", () => {
    const trie = ["AVIS SLAP LOCATOIN", "Anse Vata", "avis autre"].sort(
      comparerAlphanumerique,
    );
    expect(trie).toEqual(["Anse Vata", "avis autre", "AVIS SLAP LOCATOIN"]);
  });

  it("ignore les accents — deux graphies d'un même mot sont à égalité", () => {
    expect(comparerAlphanumerique("Kone", "Koné")).toBe(0);
    expect(comparerAlphanumerique("École", "Ecole")).toBe(0);
  });

  it("compare les nombres numériquement, jamais lexicographiquement", () => {
    const trie = ["Site 10", "Site 2", "Site 1"].sort(comparerAlphanumerique);
    expect(trie).toEqual(["Site 1", "Site 2", "Site 10"]);
  });
});

describe("trierAlphanumeriquement", () => {
  it("trie une liste d'objets par une clé textuelle", () => {
    const items = [{ libelle: "Koné" }, { libelle: "Dolbeau" }, { libelle: "Ducos" }];
    expect(trierAlphanumeriquement(items, (i) => i.libelle)).toEqual([
      { libelle: "Dolbeau" },
      { libelle: "Ducos" },
      { libelle: "Koné" },
    ]);
  });

  it("départage deux clés égales par la fonction de départage", () => {
    const items = [
      { libelle: "Atelier", id: "b" },
      { libelle: "Atelier", id: "a" },
    ];
    expect(
      trierAlphanumeriquement(
        items,
        (i) => i.libelle,
        (i) => i.id,
      ),
    ).toEqual([
      { libelle: "Atelier", id: "a" },
      { libelle: "Atelier", id: "b" },
    ]);
  });

  it("ne trie pas en place — la liste d'origine n'est pas modifiée", () => {
    const items = [{ libelle: "Z" }, { libelle: "A" }];
    const copie = [...items];
    trierAlphanumeriquement(items, (i) => i.libelle);
    expect(items).toEqual(copie);
  });
});

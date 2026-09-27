import { describe, expect, it } from "vitest";

import { montant, type Devise } from "@/lib/money";
import { formatMoney } from "@/lib/money/format";
import { libelleDuMontant } from "@/lib/tarification/libelle-montant";

/**
 * LE LIBELLÉ DU CHAMP « MONTANT », SELON LA DEVISE (audit GR, M2).
 *
 * Deux devises FABRIQUÉES ici — jamais le XPF ou l'EUR du semis — l'une à
 * zéro décimale, l'autre à deux : c'est le nombre de décimales qui décide de
 * la forme du libellé, rien d'autre.
 */
describe("libelleDuMontant", () => {
  it("devise sans décimale : nomme le code, jamais « centimes »", () => {
    const devise: Devise = { code: "ZZZ", decimales: 0, symbole: null };

    const libelle = libelleDuMontant(devise);

    expect(libelle).toContain("ZZZ");
    expect(libelle).not.toContain("centimes");
  });

  it("devise à décimales : porte un exemple chiffré sorti de formatMoney", () => {
    const devise: Devise = { code: "YYY", decimales: 2, symbole: "¥" };

    const libelle = libelleDuMontant(devise);

    expect(libelle).toContain(formatMoney(montant(1250, devise.code), devise));
  });
});

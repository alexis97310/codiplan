import { describe, expect, it } from "vitest";

import { arrondirAuPlusProche } from "@/lib/money/arrondi";

/**
 * Ticket L0-07, point 4 : « au plus proche, et à égale distance on s'éloigne de
 * zéro ». Les cas limites — demi-unités et valeurs négatives — sont éprouvés
 * explicitement, parce que c'est exactement là que `Math.round` diverge : il
 * arrondit `-2,5` à `-2`, ce qui casse la symétrie d'un avoir et de la facture
 * qu'il annule.
 */
const DIX = BigInt(10);

/** Écrit `n / 10` — une valeur à une décimale, sans jamais l'écrire en flottant. */
function dixiemes(n: number): bigint {
  return arrondirAuPlusProche(BigInt(n), DIX);
}

describe("arrondirAuPlusProche", () => {
  it("arrondit au plus proche, en dessous de la demi-unité", () => {
    expect(dixiemes(24)).toBe(BigInt(2));
    expect(dixiemes(-24)).toBe(BigInt(-2));
  });

  it("arrondit au plus proche, au-dessus de la demi-unité", () => {
    expect(dixiemes(26)).toBe(BigInt(3));
    expect(dixiemes(-26)).toBe(BigInt(-3));
  });

  it("à égale distance, s'éloigne de zéro — positifs", () => {
    expect(dixiemes(5)).toBe(BigInt(1));
    expect(dixiemes(15)).toBe(BigInt(2));
    expect(dixiemes(25)).toBe(BigInt(3));
  });

  it("à égale distance, s'éloigne de zéro — négatifs", () => {
    // C'est ici que `Math.round` donnerait -0, -1 et -2.
    expect(dixiemes(-5)).toBe(BigInt(-1));
    expect(dixiemes(-15)).toBe(BigInt(-2));
    expect(dixiemes(-25)).toBe(BigInt(-3));
  });

  it("est symétrique : arrondir l'opposé donne l'opposé de l'arrondi", () => {
    for (let n = -35; n <= 35; n += 1) {
      expect(dixiemes(-n)).toBe(-dixiemes(n));
    }
  });

  it("laisse les valeurs déjà entières inchangées", () => {
    expect(dixiemes(0)).toBe(BigInt(0));
    expect(dixiemes(30)).toBe(BigInt(3));
    expect(dixiemes(-30)).toBe(BigInt(-3));
  });

  it("accepte un diviseur négatif sans changer la règle", () => {
    // -25 / -10 vaut 2,5 : on s'éloigne de zéro, donc 3.
    expect(arrondirAuPlusProche(BigInt(-25), BigInt(-10))).toBe(BigInt(3));
    expect(arrondirAuPlusProche(BigInt(25), BigInt(-10))).toBe(BigInt(-3));
  });

  it("reste exact bien au-delà de l'entier sûr de JavaScript", () => {
    // 2^53 + 1 francs : un `number` ne saurait plus distinguer cette valeur de
    // sa voisine. L'arithmétique entière, si.
    const grand = BigInt("9007199254740993");
    expect(arrondirAuPlusProche(grand * DIX + BigInt(5), DIX)).toBe(
      grand + BigInt(1),
    );
  });

  it("refuse un diviseur nul plutôt que de rendre l'infini", () => {
    expect(() => arrondirAuPlusProche(BigInt(1), BigInt(0))).toThrow(
      /diviseur est nul/,
    );
  });
});

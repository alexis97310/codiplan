import { describe, expect, it } from "vitest";

import {
  additionner,
  comparer,
  estEgal,
  estNegatif,
  montant,
  multiplier,
  opposer,
  soustraire,
  zero,
  ErreurDeviseIncompatible,
  ErreurMontantNonEntier,
} from "@/lib/money";

/**
 * Ticket L0-07, points 1 et 2 : un montant est un entier dans l'unité la plus
 * fine de sa devise, et il ne voyage jamais sans elle (I2, RG-TAR-01).
 */
describe("construction d'un montant", () => {
  it("stocke un entier, jamais un flottant", () => {
    expect(montant(7000, "XPF").valeur).toBe(BigInt(7000));
    expect(typeof montant(7000, "XPF").valeur).toBe("bigint");
  });

  it("porte toujours sa devise", () => {
    expect(montant(7000, "XPF").devise).toBe("XPF");
    expect(zero("EUR").devise).toBe("EUR");
  });

  it("refuse une valeur à décimales — il faut arrondir d'abord", () => {
    expect(() => montant(12.34, "EUR")).toThrow(ErreurMontantNonEntier);
  });

  it("refuse une valeur au-delà de l'entier sûr", () => {
    // 2^53 francs : au-delà, un `number` cesse de compter juste sans le dire.
    expect(() => montant(2 ** 53 + 1, "XPF")).toThrow(ErreurMontantNonEntier);
  });

  it("accepte un bigint sans borne — le franc Pacifique s'écrit en grands nombres", () => {
    const enorme = BigInt("90071992547409931");
    expect(montant(enorme, "XPF").valeur).toBe(enorme);
  });
});

describe("arithmétique d'une même devise", () => {
  it("additionne et soustrait", () => {
    const a = montant(7000, "XPF");
    const b = montant(2500, "XPF");
    expect(additionner(a, b).valeur).toBe(BigInt(9500));
    expect(soustraire(a, b).valeur).toBe(BigInt(4500));
  });

  it("conserve la devise du résultat", () => {
    expect(additionner(montant(1, "EUR"), montant(2, "EUR")).devise).toBe(
      "EUR",
    );
  });

  it("oppose et multiplie par un entier", () => {
    expect(opposer(montant(7000, "XPF")).valeur).toBe(BigInt(-7000));
    expect(multiplier(montant(7000, "XPF"), 3).valeur).toBe(BigInt(21000));
  });

  it("refuse un facteur fractionnaire — l'arrondi relève de la règle de gestion", () => {
    expect(() => multiplier(montant(7000, "XPF"), 1.5)).toThrow(
      ErreurMontantNonEntier,
    );
  });

  it("compare", () => {
    expect(comparer(montant(1, "EUR"), montant(2, "EUR"))).toBe(-1);
    expect(comparer(montant(2, "EUR"), montant(2, "EUR"))).toBe(0);
    expect(comparer(montant(3, "EUR"), montant(2, "EUR"))).toBe(1);
    expect(estEgal(montant(2, "EUR"), montant(2, "EUR"))).toBe(true);
    expect(estNegatif(montant(-1, "EUR"))).toBe(true);
  });
});

describe("deux devises différentes ne se mélangent jamais (I2)", () => {
  // Les codes ne sont pas connus littéralement ici : ils viennent d'une
  // variable, exactement comme deux lignes lues en base. Le compilateur ne peut
  // donc rien affirmer, et c'est l'exécution qui refuse.
  const codeXpf: string = "XPF";
  const codeEur: string = "EUR";

  it("l'addition échoue et nomme les deux devises", () => {
    expect(() =>
      additionner(montant(1, codeXpf), montant(1, codeEur)),
    ).toThrowError(/XPF et EUR/);
  });

  it("la soustraction échoue", () => {
    expect(() => soustraire(montant(1, codeXpf), montant(1, codeEur))).toThrow(
      ErreurDeviseIncompatible,
    );
  });

  it("la comparaison échoue — un ordre entre deux devises n'existe pas", () => {
    expect(() => comparer(montant(1, codeXpf), montant(1, codeEur))).toThrow(
      ErreurDeviseIncompatible,
    );
  });

  it("l'erreur porte l'opération et les deux codes", () => {
    try {
      additionner(montant(1, codeXpf), montant(1, codeEur));
      expect.unreachable("l'addition aurait dû échouer");
    } catch (erreur) {
      expect(erreur).toBeInstanceOf(ErreurDeviseIncompatible);
      const incompatible = erreur as ErreurDeviseIncompatible;
      expect(incompatible.operation).toBe("addition");
      expect(incompatible.gauche).toBe("XPF");
      expect(incompatible.droite).toBe("EUR");
    }
  });

  it("le type l'interdit déjà quand les codes sont littéraux", () => {
    // @ts-expect-error un Montant<"XPF"> et un Montant<"EUR"> ne s'additionnent pas
    expect(() => additionner(montant(1, "XPF"), montant(1, "EUR"))).toThrow();
  });
});

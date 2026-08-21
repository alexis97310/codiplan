import { describe, expect, it } from "vitest";

import { agreger, montant } from "@/lib/money";

/**
 * L'agrégat est le seul objet que la conversion accepte (D19 : la conversion
 * « refuse d'être appelée sur un montant unitaire »). Ce fichier éprouve la
 * somme ; le refus, lui, se prouve au type et est vérifié dans
 * `tests/unit/reporting/consolidation.test.ts`.
 */
describe("agreger", () => {
  it("somme des montants d'une même devise", () => {
    const total = agreger(
      [montant(7000, "XPF"), montant(2500, "XPF"), montant(-500, "XPF")],
      "XPF",
    );
    expect(total.valeur).toBe(BigInt(9000));
    expect(total.devise).toBe("XPF");
    expect(total.lignes).toBe(3);
  });

  it("accepte une liste vide — un mois sans intervention reste un agrégat", () => {
    const total = agreger([], "EUR");
    expect(total.valeur).toBe(BigInt(0));
    expect(total.devise).toBe("EUR");
    expect(total.lignes).toBe(0);
  });

  it("refuse une devise étrangère à la somme et nomme les deux codes", () => {
    // Codes non littéraux : deux lignes lues en base ne se distinguent pas au
    // type, c'est donc l'exécution qui refuse.
    const codeXpf: string = "XPF";
    const codeEur: string = "EUR";
    expect(() =>
      agreger([montant(1, codeXpf), montant(1, codeEur)], codeXpf),
    ).toThrowError(/XPF et EUR/);
  });

  it("le type refuse déjà une devise étrangère quand les codes sont littéraux", () => {
    // @ts-expect-error un Montant<"EUR"> n'entre pas dans un agrégat en XPF
    expect(() => agreger([montant(1, "EUR")], "XPF")).toThrow();
  });

  it("n'est pas un montant réel : les deux natures ne se confondent pas", () => {
    const total = agreger([montant(7000, "XPF")], "XPF");
    expect(total.nature).toBe("agrege");
    expect(montant(7000, "XPF").nature).toBe("reel");
  });
});

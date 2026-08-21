import { describe, expect, it } from "vitest";

import { DEVISES } from "@/prisma/seed-data";
import {
  agreger,
  formatMoney,
  lireDevise,
  montant,
  type Devise,
} from "@/lib/money";

/**
 * Ticket L0-07, point 3, et arbitrage D19 : symbole si la devise en a un, code
 * sinon ; typographie française — espace insécable comme séparateur de
 * milliers, virgule décimale.
 *
 * Les devises viennent du **seed de la table `devise`**, et non de constantes
 * réécrites ici : c'est la table qui porte le nombre de décimales (I3,
 * RG-TAR-03), et un test qui recopierait `decimales: 0` cesserait de prouver
 * quoi que ce soit le jour où la table changerait.
 */
function deviseDuSeed<C extends string>(code: C): Devise<C> {
  const ligne = DEVISES.find((entree) => entree.code === code);
  if (ligne === undefined) {
    throw new Error(`le seed ne déclare pas la devise ${code}`);
  }
  return { ...lireDevise(ligne), code };
}

const XPF = deviseDuSeed("XPF");
const EUR = deviseDuSeed("EUR");

/** U+00A0 — le séparateur attendu, nommé pour que les cas restent lisibles. */
const INSECABLE = "\u00a0";

describe("formatMoney — devise sans symbole (XPF)", () => {
  it("affiche le code, sans décimale : 7 000 XPF", () => {
    expect(formatMoney(montant(7000, "XPF"), XPF)).toBe(
      `7${INSECABLE}000${INSECABLE}XPF`,
    );
  });

  it("groupe les milliers par trois", () => {
    expect(formatMoney(montant(1234567, "XPF"), XPF)).toBe(
      `1${INSECABLE}234${INSECABLE}567${INSECABLE}XPF`,
    );
  });

  it("n'insère aucun séparateur en deçà du millier", () => {
    expect(formatMoney(montant(999, "XPF"), XPF)).toBe(`999${INSECABLE}XPF`);
    expect(formatMoney(montant(0, "XPF"), XPF)).toBe(`0${INSECABLE}XPF`);
  });

  it("porte le signe devant, pour un avoir", () => {
    expect(formatMoney(montant(-7000, "XPF"), XPF)).toBe(
      `-7${INSECABLE}000${INSECABLE}XPF`,
    );
  });
});

describe("formatMoney — devise à symbole (EUR)", () => {
  it("affiche le symbole et deux décimales : 1 234,56 €", () => {
    expect(formatMoney(montant(123456, "EUR"), EUR)).toBe(
      `1${INSECABLE}234,56${INSECABLE}€`,
    );
  });

  it("complète les centimes manquants", () => {
    expect(formatMoney(montant(10000, "EUR"), EUR)).toBe(`100,00${INSECABLE}€`);
    expect(formatMoney(montant(5, "EUR"), EUR)).toBe(`0,05${INSECABLE}€`);
  });

  it("porte le signe devant, décimales comprises", () => {
    expect(formatMoney(montant(-123456, "EUR"), EUR)).toBe(
      `-1${INSECABLE}234,56${INSECABLE}€`,
    );
  });
});

describe("le nombre de décimales vient de la devise, jamais du code", () => {
  it("une devise fabriquée à trois décimales s'affiche à trois décimales", () => {
    // Le dinar tunisien en a trois. La table reste ouverte (chapitre 4.3) :
    // aucune ligne de `lib/money` ne connaît la liste des devises.
    const troisDecimales: Devise<"TND"> = {
      ...lireDevise({ code: "TND", decimales: 3, symbole: null }),
      code: "TND",
    };
    expect(formatMoney(montant(1234567, "TND"), troisDecimales)).toBe(
      `1${INSECABLE}234,567${INSECABLE}TND`,
    );
  });

  it("le même entier ne rend pas la même chose selon la devise", () => {
    const memeEntier = 100;
    expect(formatMoney(montant(memeEntier, "XPF"), XPF)).toBe(
      `100${INSECABLE}XPF`,
    );
    expect(formatMoney(montant(memeEntier, "EUR"), EUR)).toBe(
      `1,00${INSECABLE}€`,
    );
  });

  it("aucune locale n'intervient — le rendu ne dépend pas de l'environnement", () => {
    // Un rendu passé par Intl varierait avec la version d'ICU du serveur :
    // espace insécable ou espace fine insécable selon les versions.
    const rendu = formatMoney(montant(1000000, "XPF"), XPF);
    expect(rendu).not.toContain(" ");
    expect(rendu).not.toContain(" ");
    expect(rendu.split(INSECABLE)).toHaveLength(4);
  });

  it("refuse de formater un montant avec la ligne d'une autre devise", () => {
    // Codes non littéraux : c'est le cas d'un montant et d'un référentiel lus
    // séparément en base. Le rendu serait présentable, et faux.
    const codeXpf: string = "XPF";
    expect(() => formatMoney(montant(7000, codeXpf), EUR)).toThrowError(
      /XPF et EUR/,
    );
  });

  it("refuse une ligne de devise incohérente plutôt que de deviner", () => {
    expect(() =>
      lireDevise({ code: "XXX", decimales: -1, symbole: null }),
    ).toThrow();
    expect(() =>
      lireDevise({ code: "", decimales: 2, symbole: null }),
    ).toThrow();
  });
});

describe("un agrégat se formate comme un montant — c'est de l'argent réel", () => {
  it("affiche la somme dans sa devise", () => {
    const total = agreger([montant(7000, "XPF"), montant(2500, "XPF")], "XPF");
    expect(formatMoney(total, XPF)).toBe(`9${INSECABLE}500${INSECABLE}XPF`);
  });
});

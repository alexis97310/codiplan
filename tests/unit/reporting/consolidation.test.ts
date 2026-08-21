import { describe, expect, it } from "vitest";

import {
  additionner,
  agreger,
  formatMoneyConsolide,
  lireDevise,
  montant,
  type Devise,
} from "@/lib/money";
import {
  convertForConsolidation,
  resoudreParites,
  type LigneParite,
} from "@/lib/reporting/consolidation";
import { DEVISES } from "@/prisma/seed-data";

/**
 * Ticket L0-07, point 5 — le point sensible.
 *
 * **Les taux de ce fichier sont fabriqués.** La parité légale du franc
 * Pacifique n'y figure pas : elle n'existe qu'une fois dans le dépôt, dans
 * `prisma/seed-data.ts`, et le gardien
 * `tests/unit/money/sans-litteral-de-parite.test.ts` le vérifie. Un taux rond
 * rend d'ailleurs les cas d'arrondi lisibles, ce qu'un taux à six décimales ne
 * ferait pas.
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

/** Convention amorcée par le seed : le taux se lit « X pour 1 EUR » (D20). */
const BASE = "EUR";

const DATE = "2026-08-21";

function parites(...lignes: LigneParite[]) {
  return resoudreParites(lignes, BASE, DATE);
}

describe("resoudreParites", () => {
  it("retient la parité la plus récente qui précède la date demandée", () => {
    const resolues = resoudreParites(
      [
        { devise_code: "XPF", date_effet: "1999-01-01", taux: "2" },
        { devise_code: "XPF", date_effet: "2026-01-01", taux: "4" },
        { devise_code: "XPF", date_effet: "2027-01-01", taux: "8" },
      ],
      BASE,
      DATE,
    );
    const agregat = agreger([montant(1000, "XPF")], "XPF");
    // Taux 4 : 1 000 XPF valent 250,00 €.
    expect(convertForConsolidation(agregat, XPF, EUR, resolues).valeur).toBe(
      BigInt(25000),
    );
  });

  it("accepte une date d'effet lue en base — un Date à minuit UTC", () => {
    const resolues = resoudreParites(
      [
        {
          devise_code: "XPF",
          date_effet: new Date("2026-01-01T00:00:00.000Z"),
          taux: "4",
        },
      ],
      BASE,
      DATE,
    );
    expect(resolues.date).toBe(DATE);
  });

  it("donne le taux neutre à la devise de base", () => {
    const agregat = agreger([montant(12345, "EUR")], "EUR");
    const converti = convertForConsolidation(agregat, EUR, EUR, parites());
    expect(converti.valeur).toBe(BigInt(12345));
  });

  it("refuse une ligne portée par la devise de base — deux conventions coexisteraient", () => {
    expect(() =>
      parites({ devise_code: BASE, date_effet: "1999-01-01", taux: "2" }),
    ).toThrow(/déclarée devise de base/);
  });

  it("refuse une date qui n'est pas au format AAAA-MM-JJ", () => {
    expect(() => resoudreParites([], BASE, "21/08/2026")).toThrow();
    expect(() => resoudreParites([], BASE, "2026-13-01")).toThrow();
  });

  it("refuse un taux qui n'est pas un décimal positif", () => {
    expect(() =>
      parites({ devise_code: "XPF", date_effet: "1999-01-01", taux: "-2" }),
    ).toThrow();
    expect(() =>
      parites({ devise_code: "XPF", date_effet: "1999-01-01", taux: "2e3" }),
    ).toThrow();
  });
});

describe("convertForConsolidation", () => {
  const auTaux = (taux: string) =>
    parites({ devise_code: "XPF", date_effet: "1999-01-01", taux });

  it("convertit un agrégat XPF vers l'EUR", () => {
    const agregat = agreger(
      [montant(600000, "XPF"), montant(400000, "XPF")],
      "XPF",
    );
    // Taux 100 : 1 000 000 XPF valent 10 000,00 €.
    const converti = convertForConsolidation(agregat, XPF, EUR, auTaux("100"));
    expect(converti.valeur).toBe(BigInt(1000000));
    expect(converti.devise).toBe("EUR");
  });

  it("convertit dans l'autre sens, de l'EUR vers le XPF", () => {
    const agregat = agreger([montant(40000, "EUR")], "EUR");
    const converti = convertForConsolidation(agregat, EUR, XPF, auTaux("2.5"));
    expect(converti.valeur).toBe(BigInt(1000));
    expect(converti.devise).toBe("XPF");
  });

  it("lit l'échelle du taux dans la chaîne — jamais un nombre de décimales en dur", () => {
    const agregat = agreger([montant(1000, "XPF")], "XPF");
    const court = convertForConsolidation(agregat, XPF, EUR, auTaux("2.5"));
    const long = convertForConsolidation(agregat, XPF, EUR, auTaux("2.500000"));
    expect(court.valeur).toBe(BigInt(40000));
    expect(long.valeur).toBe(court.valeur);
  });

  it("arrondit par l'unique arrondi du dépôt, demi-unité comprise", () => {
    // Taux 8 : 1 XPF vaut 12,5 centimes. On s'éloigne de zéro.
    expect(
      convertForConsolidation(
        agreger([montant(1, "XPF")], "XPF"),
        XPF,
        EUR,
        auTaux("8"),
      ).valeur,
    ).toBe(BigInt(13));
    expect(
      convertForConsolidation(
        agreger([montant(-1, "XPF")], "XPF"),
        XPF,
        EUR,
        auTaux("8"),
      ).valeur,
    ).toBe(BigInt(-13));
  });

  it("reste exact sur des agrégats que le flottant ne saurait plus porter", () => {
    const enorme = BigInt("90071992547409931");
    const agregat = agreger([montant(enorme, "XPF")], "XPF");
    const converti = convertForConsolidation(agregat, XPF, EUR, auTaux("100"));
    expect(converti.valeur).toBe(enorme);
  });

  it("inscrit la date de parité sur le résultat", () => {
    const converti = convertForConsolidation(
      agreger([montant(1000, "XPF")], "XPF"),
      XPF,
      EUR,
      auTaux("100"),
    );
    expect(converti.dateParite).toBe(DATE);
  });

  it("refuse d'inventer un taux qui manque à la date demandée", () => {
    const resolues = resoudreParites(
      [{ devise_code: "XPF", date_effet: "2027-01-01", taux: "100" }],
      BASE,
      DATE,
    );
    expect(() =>
      convertForConsolidation(
        agreger([montant(1000, "XPF")], "XPF"),
        XPF,
        EUR,
        resolues,
      ),
    ).toThrow(/Aucune parité pour XPF/);
  });

  it("refuse un agrégat dont la devise dément la devise source annoncée", () => {
    const codeEur: string = "EUR";
    const agregat = agreger([montant(1000, codeEur)], codeEur);
    expect(() =>
      convertForConsolidation(agregat, XPF, EUR, auTaux("100")),
    ).toThrow(/L'agrégat est en EUR/);
  });
});

describe("les refus que porte le type", () => {
  // Dans les deux cas ci-dessous, l'assertion qui compte est le
  // `@ts-expect-error` : c'est `pnpm typecheck` qui échouerait si le refus
  // disparaissait. Le corps du test se contente de garder l'expression vivante.
  const tauxFabrique = () =>
    parites({ devise_code: "XPF", date_effet: "1999-01-01", taux: "100" });

  it("refuse un montant unitaire — la conversion ne s'applique qu'aux agrégats (D19)", () => {
    const unitaire = montant(1000, "XPF");
    const interdit = () =>
      convertForConsolidation(
        // @ts-expect-error un Montant n'est pas un MontantAgrege : la conversion ligne à ligne est interdite (I2)
        unitaire,
        XPF,
        EUR,
        tauxFabrique(),
      );
    expect(interdit).toBeTypeOf("function");
  });

  it("un montant consolidé ne rentre dans aucun calcul métier", () => {
    const converti = convertForConsolidation(
      agreger([montant(1000, "XPF")], "XPF"),
      XPF,
      EUR,
      tauxFabrique(),
    );
    expect(converti.nature).toBe("consolide");
    const interdit = () =>
      additionner(
        montant(1, "EUR"),
        // @ts-expect-error un MontantConsolide n'est pas un Montant : il ne s'additionne pas à de l'argent réel
        converti,
      );
    expect(interdit).toBeTypeOf("function");
  });

  it("un montant consolidé s'affiche par sa propre fonction, dans la devise de restitution", () => {
    const converti = convertForConsolidation(
      agreger([montant(1234567, "XPF")], "XPF"),
      XPF,
      EUR,
      tauxFabrique(),
    );
    expect(formatMoneyConsolide(converti, EUR)).toBe("12\u00a0345,67\u00a0€");
  });
});

import { describe, expect, it } from "vitest";

import { montant } from "@/lib/money";
import {
  arrondirAuQuartDHeureSuperieur,
  ErreurDureeInvalide,
  PLANCHER_MINUTES,
  valoriserTempsPasse,
} from "@/lib/tarification/valorisation";

/**
 * RG-TAR-05, amendée par D83 — « Le temps d'intervention est arrondi au quart
 * d'heure supérieur. La main-d'œuvre facturée ne peut être inférieure à une
 * heure au taux en vigueur. Arrondi puis plancher s'appliquent une seule fois,
 * sur l'intervention entière, jamais tâche par tâche. »
 *
 * ## LE JUMEAU QUI COMPTE, et pourquoi il est double
 *
 * Deux cas, et **aucun des deux ne suffit seul** :
 *
 * - **12 minutes doivent facturer une heure.** Ce cas passe déjà si l'on n'a
 *   écrit QUE le plancher — l'arrondi (12 → 15) y est invisible, le plancher
 *   l'écrasant.
 * - **3 h 47 doivent facturer 4 h 00.** Ce cas passe déjà si l'on n'a écrit QUE
 *   l'arrondi — le plancher n'y mord pas, 227 minutes étant très au-dessus de
 *   60.
 *
 * *Si l'un passe sans l'autre, la règle est mal posée* : chacun est aveugle à
 * la moitié que l'autre éprouve. C'est pourquoi ils sont écrits côte à côte,
 * avec leurs deux mises en échec — la règle amputée de son plancher, et la
 * règle amputée de son arrondi.
 */

/** Le taux de démonstration : 8 500 XPF de l'heure, zéro décimale (I3). */
const TAUX = montant(8500, "XPF");

describe("RG-TAR-05 / D83 — le jumeau des deux moitiés", () => {
  it("12 minutes facturent UNE HEURE — c'est le plancher qui mord", () => {
    const v = valoriserTempsPasse(12, TAUX);
    expect(v.minutesArrondies).toBe(15);
    expect(v.minutesFacturees).toBe(60);
    expect(v.plancherApplique).toBe(true);
    expect(v.mainDoeuvre.valeur).toBe(BigInt(8500));
  });

  it("3 h 47 facturent 4 h 00 — c'est l'arrondi qui mord", () => {
    const v = valoriserTempsPasse(227, TAUX);
    expect(v.minutesArrondies).toBe(240);
    expect(v.minutesFacturees).toBe(240);
    expect(v.plancherApplique).toBe(false);
    expect(v.mainDoeuvre.valeur).toBe(BigInt(34000));
  });

  /**
   * Le jumeau du §9 (24/08) : chaque refus s'accompagne de la mise en échec qui
   * retire réellement le verrou. Ici le « verrou » est chacune des deux moitiés
   * de la règle, rejouée telle qu'elle serait écrite si l'autre manquait.
   */
  it("la règle amputée de son PLANCHER laisse passer les 12 minutes", () => {
    const sansPlancher = arrondirAuQuartDHeureSuperieur(12);
    expect(sansPlancher).toBe(15);
    // 15 minutes facturées, soit un quart du taux : c'est exactement le défaut
    // que le plancher existe pour empêcher.
    expect(sansPlancher).not.toBe(
      valoriserTempsPasse(12, TAUX).minutesFacturees,
    );
  });

  it("la règle amputée de son ARRONDI laisse passer les 3 h 47", () => {
    const sansArrondi = Math.max(227, PLANCHER_MINUTES);
    expect(sansArrondi).toBe(227);
    expect(sansArrondi).not.toBe(
      valoriserTempsPasse(227, TAUX).minutesFacturees,
    );
  });
});

describe("l'arrondi au quart d'heure supérieur", () => {
  it("ne bouge pas un multiple de quinze", () => {
    expect(arrondirAuQuartDHeureSuperieur(30)).toBe(30);
    expect(arrondirAuQuartDHeureSuperieur(45)).toBe(45);
    expect(arrondirAuQuartDHeureSuperieur(240)).toBe(240);
  });

  it("monte dès la première minute au-dessus du pas", () => {
    expect(arrondirAuQuartDHeureSuperieur(1)).toBe(15);
    expect(arrondirAuQuartDHeureSuperieur(16)).toBe(30);
    expect(arrondirAuQuartDHeureSuperieur(61)).toBe(75);
  });

  it("laisse zéro à zéro — un temps absent n'est pas un quart d'heure", () => {
    expect(arrondirAuQuartDHeureSuperieur(0)).toBe(0);
  });

  it("refuse une durée négative ou fractionnaire", () => {
    expect(() => arrondirAuQuartDHeureSuperieur(-1)).toThrow(
      ErreurDureeInvalide,
    );
    expect(() => arrondirAuQuartDHeureSuperieur(12.5)).toThrow(
      ErreurDureeInvalide,
    );
  });
});

describe("l'application UNE SEULE FOIS, sur l'intervention entière", () => {
  /**
   * D57 tient l'écart entre les deux lectures : cinq passages de cinq minutes
   * sont cinq INTERVENTIONS, donc cinq arrondis. Ici, à l'inverse, quatre
   * TÂCHES de cinq minutes dans UNE intervention font vingt minutes, arrondies
   * une fois — puis relevées au plancher.
   */
  it("quatre tâches de 5 minutes font UN arrondi, pas quatre", () => {
    const taches = [5, 5, 5, 5];
    const cumule = taches.reduce((total, t) => total + t, 0);
    const uneFois = valoriserTempsPasse(cumule, TAUX);
    const tacheParTache = taches.reduce(
      (total, t) => total + arrondirAuQuartDHeureSuperieur(t),
      0,
    );
    expect(uneFois.minutesArrondies).toBe(30);
    expect(tacheParTache).toBe(60);
    expect(uneFois.minutesArrondies).not.toBe(tacheParTache);
  });

  it("une intervention étalée sur deux jours reste UNE intervention", () => {
    // 3 h 50 le lundi, 1 h 05 le mardi : 295 minutes, un seul arrondi à 300.
    const v = valoriserTempsPasse(230 + 65, TAUX);
    expect(v.minutesArrondies).toBe(300);
    expect(v.minutesFacturees).toBe(300);
  });
});

describe("le montant, en arithmétique entière", () => {
  it("ne dérive pas sur un taux qui ne se divise pas par quatre", () => {
    // 8 501 XPF de l'heure, 1 h 15 : 8501 × 75 / 60 = 10 626,25 → 10 626.
    const v = valoriserTempsPasse(75, montant(8501, "XPF"));
    expect(v.mainDoeuvre.valeur).toBe(BigInt(10626));
  });

  it("porte la devise du taux, jamais une devise supposée (I2, I3)", () => {
    const v = valoriserTempsPasse(90, montant(4550, "EUR"));
    expect(v.mainDoeuvre.devise).toBe("EUR");
    expect(v.mainDoeuvre.valeur).toBe(BigInt(6825));
  });
});

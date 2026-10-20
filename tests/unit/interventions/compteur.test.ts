import { describe, expect, it } from "vitest";

import {
  mesurer,
  peutArreter,
  peutDemarrer,
  segmentOuvert,
  segmentOuvertDeLaPersonne,
  verifierInstantAppareil,
  type Segment,
} from "@/lib/interventions/compteur";
import { arrondirAuQuartDHeureSuperieur } from "@/lib/tarification/valorisation";

/**
 * R5-02 — CE QUE LE COMPTEUR MESURE, ET CE QU'IL NE DÉCIDE PAS.
 *
 * *L'instant est un paramètre dans chaque scénario* : pas un `new Date()`
 * flottant, pas d'horloge. Un test qui lit l'heure devient vert parce qu'elle a
 * bougé, et rouge pour la même raison.
 */

const T = (heure: number, minute = 0): Date =>
  new Date(Date.UTC(2026, 8, 15, heure, minute, 0));

function segment(debut: Date, fin: Date | null, id = "s"): Segment {
  return { id, debut, fin };
}

describe("ce que les segments mesurent", () => {
  it("la somme des segments FERMÉS, en minutes tronquées", () => {
    const mesure = mesurer([
      segment(T(8), T(10), "a"),
      segment(T(14), T(16), "b"),
    ]);
    expect(mesure.minutes).toBe(240);
    expect(mesure.segmentsFermes).toBe(2);
    expect(mesure.ouvert).toBeNull();
  });

  /**
   * LE CŒUR DE « DES SEGMENTS, JAMAIS UN COUPLE ».
   *
   * Un couple unique 8 h → 16 h dirait HUIT heures. Les segments en disent
   * quatre, et c'est la pause qui fait la différence — *un fait, que le total
   * seul ne peut pas raconter.*
   */
  it("la pause n'est PAS comptée, et c'est tout l'objet de la table", () => {
    const avecPause = mesurer([
      segment(T(8), T(10), "a"),
      segment(T(14), T(16), "b"),
    ]).minutes;
    const couplenaif = (T(16).getTime() - T(8).getTime()) / 60_000;
    expect(avecPause).toBe(240);
    expect(couplenaif).toBe(480);
  });

  it("un segment qui TOURNE ne compte pas dans le total, et se rend à part", () => {
    const mesure = mesurer([
      segment(T(8), T(10), "a"),
      segment(T(14), null, "b"),
    ]);
    // *Un compteur qui tourne n'est pas un temps acquis* : l'additionner ferait
    // un total qui change tout seul.
    expect(mesure.minutes).toBe(120);
    expect(mesure.ouvert?.id).toBe("b");
    expect(mesure.segmentsFermes).toBe(1);
  });

  it("les secondes sont TRONQUÉES, jamais arrondies", () => {
    const debut = new Date(Date.UTC(2026, 8, 15, 8, 0, 0));
    const fin = new Date(Date.UTC(2026, 8, 15, 8, 0, 59));
    expect(mesurer([segment(debut, fin)]).minutes).toBe(0);
  });

  /**
   * L'ARRONDI N'EST PAS ICI, ET CE SCÉNARIO LE PROUVE PLUTÔT QU'IL NE
   * L'AFFIRME.
   *
   * Le compteur rend 61 minutes ; c'est `valorisation.ts` qui en fait 75. Si
   * `mesurer` arrondissait, les deux nombres seraient égaux — et le prix
   * dépendrait alors de deux arrondis dont un seul est écrit dans la règle.
   */
  it("mesurer ne fait AUCUN arrondi de prix — la valorisation, si", () => {
    const mesure = mesurer([segment(T(8), T(9, 1))]);
    expect(mesure.minutes).toBe(61);
    expect(arrondirAuQuartDHeureSuperieur(mesure.minutes)).toBe(75);
  });

  it("aucun segment : zéro minute, rien d'ouvert, et rien qui lève", () => {
    expect(mesurer([])).toEqual({
      minutes: 0,
      ouvert: null,
      segmentsFermes: 0,
    });
    expect(segmentOuvert([])).toBeNull();
  });
});

describe("segmentOuvertDeLaPersonne — jamais le segment d'un RENFORT (9F4H6, point 5)", () => {
  it("`ici` faux : rien, même si quelqu'un d'autre tourne sur cette intervention", () => {
    expect(
      segmentOuvertDeLaPersonne(false, {
        segment: segment(T(8), null),
      }),
    ).toBeNull();
  });

  it("`ici` vrai mais aucun compteur connu pour cette personne : rien", () => {
    expect(segmentOuvertDeLaPersonne(true, null)).toBeNull();
  });

  it("`ici` vrai, le segment EST celui de la personne connectée : son début", () => {
    expect(
      segmentOuvertDeLaPersonne(true, {
        segment: segment(T(8), null),
      }),
    ).toEqual({ debut: T(8).toISOString() });
  });
});

describe("les gestes permis", () => {
  it("on démarre quand rien ne tourne", () => {
    expect(peutDemarrer([segment(T(8), T(10))])).toEqual({ accepte: true });
  });

  it("on ne démarre PAS un second compteur — une personne, un compteur", () => {
    expect(peutDemarrer([segment(T(8), null)])).toEqual({
      accepte: false,
      cle: "compteur.refus.deja_en_cours",
    });
  });

  it("on n'arrête rien quand rien ne tourne", () => {
    expect(peutArreter([segment(T(8), T(10))], T(11))).toEqual({
      accepte: false,
      cle: "compteur.refus.aucun_en_cours",
    });
  });

  it("on arrête quand un compteur tourne", () => {
    expect(peutArreter([segment(T(8), null)], T(9))).toEqual({
      accepte: true,
    });
  });

  /**
   * LE CAS QUI DOIT ROUGIR, ET QUI ARRIVE VRAIMENT : l'horloge du terrain peut
   * reculer — fuseau mal réglé, appareil remis à l'heure. Le refus est nommé
   * ici pour que l'écran l'explique, et la base le refuse aussi (`CHECK`).
   */
  it("une fin qui précède le début est refusée, et le refus est NOMMÉ", () => {
    expect(peutArreter([segment(T(10), null)], T(9))).toEqual({
      accepte: false,
      cle: "compteur.refus.fin_avant_debut",
    });
    // Égalité comprise : un segment de durée nulle ne mesure rien, et
    // compterait pourtant comme du travail qui a eu lieu.
    expect(peutArreter([segment(T(10), null)], T(10))).toEqual({
      accepte: false,
      cle: "compteur.refus.fin_avant_debut",
    });
  });
});

/**
 * L'HEURE DU TÉLÉPHONE EST-ELLE CRÉDIBLE ? (9F4H2-HORS-RESEAU-HEURE-ET-REJEU,
 * décision n° 107 d'Alexis, 14/10/2026) — les deux arguments sont des
 * PARAMÈTRES, comme tout le reste de ce module : aucun scénario ne lit
 * l'horloge.
 */
describe("l'heure de l'appareil, confrontée à celle du serveur", () => {
  it("accepte une heure identique à celle du serveur", () => {
    expect(verifierInstantAppareil(T(10), T(10))).toBeNull();
  });

  it("accepte un léger retard ou une légère avance (≤ 5 minutes dans le futur)", () => {
    expect(verifierInstantAppareil(T(10), T(10, 4))).toBeNull();
    expect(verifierInstantAppareil(T(10), T(9, 0))).toBeNull();
  });

  it("refuse plus de 5 minutes dans le FUTUR, AVEC SA CLÉ", () => {
    expect(verifierInstantAppareil(T(10), T(10, 6))).toBe(
      "compteur.refus.instant_futur",
    );
  });

  it("refuse plus de 7 jours dans le PASSÉ, AVEC SA CLÉ", () => {
    const septJoursMoinsUneMinute = new Date(
      T(10).getTime() - (7 * 24 * 60 - 1) * 60_000,
    );
    const septJoursEtUneMinute = new Date(
      T(10).getTime() - (7 * 24 * 60 + 1) * 60_000,
    );
    expect(verifierInstantAppareil(T(10), septJoursMoinsUneMinute)).toBeNull();
    expect(verifierInstantAppareil(T(10), septJoursEtUneMinute)).toBe(
      "compteur.refus.instant_trop_ancien",
    );
  });
});

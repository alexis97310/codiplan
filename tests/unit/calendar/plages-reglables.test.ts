import { describe, expect, it } from "vitest";

import {
  chevauchent,
  creneauxDuJour,
  enMinutes,
  MINUTES_JOURNEE,
  plageLaPlusCourte,
  plageQuiChevauche,
  plageTientLePas,
  type Parametrage,
} from "@/lib/calendar/parametrage";

/**
 * R3-13 — les règles que l'écran de réglage oppose AVANT la base.
 *
 * Ces critères sont écrits deux fois : ici pour que le refus soit LISIBLE, et
 * dans trois déclencheurs pour qu'il soit TENU. *Deux lectures d'un même critère
 * divergent en silence* (§9, 01/09) — ce qui les confronte est
 * `tests/isolation/plages-reglables.test.ts`, qui fait prononcer la base sur les
 * mêmes cas et par le même chemin que l'application.
 */

const LUNDI = 1;
const plage = (debutMinutes: number, finMinutes: number, jourSemaine = LUNDI) =>
  ({ jourSemaine, debutMinutes, finMinutes }) as const;

describe("enMinutes — une heure saisie, ou rien", () => {
  it("lit une heure de formulaire", () => {
    expect(enMinutes("08:00")).toBe(480);
    expect(enMinutes("8:05")).toBe(485);
    expect(enMinutes("00:00")).toBe(0);
  });

  it("admet 24:00 — la fermeture à minuit, que la base autorise déjà", () => {
    expect(enMinutes("24:00")).toBe(MINUTES_JOURNEE);
  });

  it("REFUSE plutôt qu'elle ne devine", () => {
    // Un formulaire se forge, et une heure illisible prise pour minuit ouvrirait
    // une agence à 00:00 sans que personne l'ait demandé.
    expect(enMinutes("")).toBeNull();
    expect(enMinutes("huit heures")).toBeNull();
    expect(enMinutes("08h00")).toBeNull();
    expect(enMinutes("08:75")).toBeNull();
    expect(enMinutes("25:00")).toBeNull();
  });
});

describe("chevauchent — et deux plages qui se touchent ne se chevauchent pas", () => {
  it("deux plages qui se recouvrent se chevauchent", () => {
    expect(chevauchent(plage(480, 720), plage(600, 900))).toBe(true);
    // L'une entièrement dans l'autre : le cas qu'une comparaison naïve rate.
    expect(chevauchent(plage(480, 1020), plage(600, 660))).toBe(true);
  });

  it("08:00–12:00 et 12:00–17:00 sont la journée coupée par le déjeuner", () => {
    // Le cas ORDINAIRE. Un verrou qui le refuserait serait vert sur tous les
    // scénarios de chevauchement et interdirait la forme la plus répandue d'un
    // horaire d'agence.
    expect(chevauchent(plage(480, 720), plage(720, 1020))).toBe(false);
  });

  it("deux jours différents ne se chevauchent jamais", () => {
    expect(chevauchent(plage(480, 720, 1), plage(480, 720, 2))).toBe(false);
  });
});

describe("plageQuiChevauche — et une plage ne se chevauche pas elle-même", () => {
  const existantes = [
    { id: "matin", ...plage(480, 720) },
    { id: "apres-midi", ...plage(780, 1020) },
  ];

  it("nomme la plage recouverte", () => {
    expect(plageQuiChevauche(existantes, plage(600, 900))?.id).toBe("matin");
  });

  it("ignore la plage qu'on MODIFIE", () => {
    // L'oublier rendrait toute modification impossible : le verrou serait vert
    // et l'écran inutilisable.
    expect(plageQuiChevauche(existantes, plage(480, 700), "matin")).toBeNull();
  });

  it("rend null quand rien ne se recouvre", () => {
    expect(plageQuiChevauche(existantes, plage(720, 780))).toBeNull();
  });
});

describe("plageTientLePas — une plage plus courte que le pas rend une grille vide", () => {
  it("refuse la plage plus courte que le pas", () => {
    expect(plageTientLePas(plage(480, 510), 60)).toBe(false);
  });

  it("admet la plage qui vaut EXACTEMENT le pas — elle rend un créneau", () => {
    expect(plageTientLePas(plage(480, 540), 60)).toBe(true);
  });

  it("et la grille le confirme, par la fonction que le planning appelle", () => {
    // *Deux lectures d'un même critère* : celle-ci les fait répondre l'une à
    // côté de l'autre plutôt que de se ressembler.
    const parametrage: Parametrage = {
      calendrierId: "c",
      code: "C",
      libelle: "C",
      pasCreneauMinutes: 60,
      plages: [plage(480, 510)],
    };
    expect(creneauxDuJour(parametrage, LUNDI)).toStrictEqual([]);
    expect(
      creneauxDuJour({ ...parametrage, plages: [plage(480, 540)] }, LUNDI),
    ).toStrictEqual([480]);
  });
});

describe("plageLaPlusCourte — le second sens du même état", () => {
  it("rend la plus courte durée", () => {
    expect(plageLaPlusCourte([plage(480, 720), plage(780, 840)])).toBe(60);
  });

  it("rend null sans plage — un calendrier vide n'a pas de grille à vider", () => {
    expect(plageLaPlusCourte([])).toBeNull();
  });
});

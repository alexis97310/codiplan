import { describe, expect, it } from "vitest";

import {
  creneauxDuJour,
  enHeure,
  joursTravailles,
  schemaPasCreneau,
  type Parametrage,
} from "@/lib/calendar/parametrage";

/**
 * I7 — « Ducos ouvre du lundi au samedi, Koné du lundi au vendredi. **Aucun
 * calendrier global codé en dur.** »
 *
 * Le cas qui décide de la justesse de la grille n'est pas celui où elle tombe
 * juste : c'est celui où le PAS ne divise pas la plage. Un dernier créneau qui
 * déborderait la fermeture proposerait un rendez-vous que l'agence ne peut pas
 * tenir — *une grille qui déborde est pire qu'une grille courte : la seconde se
 * voit, la première se découvre sur place.*
 */

/** Ducos : lundi à samedi, 7 h 30 – 17 h 00, pas de 30 minutes. */
const DUCOS: Parametrage = {
  calendrierId: "d",
  code: "DUCOS",
  libelle: "Ducos",
  pasCreneauMinutes: 30,
  plages: [1, 2, 3, 4, 5, 6].map((jour) => ({
    jourSemaine: jour,
    debutMinutes: 450,
    finMinutes: 1020,
  })),
};

describe("les jours travaillés viennent des plages, jamais d'une liste écrite", () => {
  it("Ducos ouvre du lundi au samedi", () => {
    expect(joursTravailles(DUCOS)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("Koné, qui n'a pas de samedi, n'en propose pas — et le cas doit RESTER vert", () => {
    // Le pendant du cas ci-dessus, et il compte autant (§9, 11/09) : un gardien
    // est un prédicat à DEUX directions, et celle qui ne produit jamais de
    // signal est la permissive. Si les jours étaient écrits en dur quelque
    // part, Koné en aurait six comme Ducos.
    const kone: Parametrage = {
      ...DUCOS,
      code: "KONE",
      plages: DUCOS.plages.filter((p) => p.jourSemaine !== 6),
    };
    expect(joursTravailles(kone)).toEqual([1, 2, 3, 4, 5]);
    expect(joursTravailles(kone)).not.toEqual(joursTravailles(DUCOS));
  });
});

describe("la grille de créneaux", () => {
  it("commence à l'ouverture et s'arrête avant la fermeture", () => {
    const creneaux = creneauxDuJour(DUCOS, 1);
    expect(creneaux[0]).toBe(450);
    expect(enHeure(creneaux[0] ?? 0)).toBe("07:30");
    // 7 h 30 → 17 h 00, soit 570 minutes ; 19 créneaux de 30 minutes.
    expect(creneaux).toHaveLength(19);
    const dernier = creneaux[creneaux.length - 1] ?? 0;
    expect(dernier + DUCOS.pasCreneauMinutes).toBeLessThanOrEqual(1020);
    expect(enHeure(dernier)).toBe("16:30");
  });

  it("NE DÉBORDE PAS quand le pas ne divise pas la plage", () => {
    // 570 minutes avec un pas de 45 : 12 créneaux pleins, et 30 minutes de
    // reste. Le treizième déborderait de 15 minutes, et il n'est pas proposé.
    const pas45: Parametrage = { ...DUCOS, pasCreneauMinutes: 45 };
    const creneaux = creneauxDuJour(pas45, 1);
    expect(creneaux).toHaveLength(12);
    const dernier = creneaux[creneaux.length - 1] ?? 0;
    expect(dernier + 45).toBeLessThanOrEqual(1020);
    expect(dernier + 45 + 45).toBeGreaterThan(1020);
  });

  it("un jour fermé ne propose AUCUN créneau", () => {
    expect(creneauxDuJour(DUCOS, 7)).toEqual([]);
  });

  it("le pas change réellement la grille — le témoin de non-vacuité", () => {
    // Sans lui, une grille toujours vide passerait tous les cas ci-dessus qui
    // portent sur des longueurs, et « le pas est réglable » serait une phrase.
    const pas15 = creneauxDuJour({ ...DUCOS, pasCreneauMinutes: 15 }, 1);
    const pas60 = creneauxDuJour({ ...DUCOS, pasCreneauMinutes: 60 }, 1);
    expect(pas15.length).toBeGreaterThan(pas60.length);
    expect(pas60.length).toBeGreaterThan(0);
  });

  it("deux plages dans la même journée se cumulent sans doublon", () => {
    // Le matin et l'après-midi, séparés par la pause : c'est la forme réelle
    // d'un calendrier d'agence, et les deux plages doivent produire deux blocs
    // de créneaux, pas un seul continu.
    const coupe: Parametrage = {
      ...DUCOS,
      plages: [
        { jourSemaine: 1, debutMinutes: 450, finMinutes: 690 },
        { jourSemaine: 1, debutMinutes: 780, finMinutes: 1020 },
      ],
    };
    const creneaux = creneauxDuJour(coupe, 1);
    expect(creneaux).toHaveLength(8 + 8);
    expect(creneaux).not.toContain(690);
    expect(creneaux).toContain(780);
    expect(new Set(creneaux).size).toBe(creneaux.length);
  });
});

describe("le pas de créneau se règle, et il est borné", () => {
  it("accepte une valeur ordinaire", () => {
    expect(schemaPasCreneau.safeParse(30).success).toBe(true);
    expect(schemaPasCreneau.safeParse(15).success).toBe(true);
  });

  it("refuse zéro, le négatif, le fractionnaire et l'excessif", () => {
    expect(schemaPasCreneau.safeParse(0).success).toBe(false);
    expect(schemaPasCreneau.safeParse(-15).success).toBe(false);
    expect(schemaPasCreneau.safeParse(12.5).success).toBe(false);
    expect(schemaPasCreneau.safeParse(481).success).toBe(false);
  });
});

describe("la lecture d'une heure", () => {
  it("rend HH:MM, avec ses zéros", () => {
    expect(enHeure(0)).toBe("00:00");
    expect(enHeure(450)).toBe("07:30");
    expect(enHeure(1020)).toBe("17:00");
    expect(enHeure(1439)).toBe("23:59");
  });
});

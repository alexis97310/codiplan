import { describe, expect, it } from "vitest";

import { montant } from "@/lib/money";
import {
  type LigneTemps,
  auQuartDHeureSuperieur,
  valoriser,
} from "@/lib/tarification/valorisation";

/**
 * RG-TAR-05, amendée par D57 — l'arrondi au quart d'heure supérieur.
 *
 * **L'exemple chiffré de D57 fait partie de la décision**, et il est rejoué ici
 * tel quel : cinq passages de cinq minutes font 1 h 15, jamais 30 minutes. Un
 * facteur deux et demi sur une tournée de dépannages courts.
 */

const XPF = "XPF";
/** 10 000 XPF de l'heure — le franc Pacifique n'a pas de décimale (I3). */
const TAUX = BigInt(10_000);

function ligne(surcharge: Partial<LigneTemps> = {}): LigneTemps {
  return {
    technicienId: "t1",
    type: "intervention",
    dureeMinutes: 60,
    facturable: true,
    ...surcharge,
  };
}

describe("l'arrondi au quart d'heure supérieur (RG-TAR-05)", () => {
  it("arrondit vers le HAUT, jamais au plus proche", () => {
    // La confusion coûterait un quart d'heure par intervention courte :
    // « au plus proche » ferait tomber 7 minutes à zéro.
    expect(auQuartDHeureSuperieur(1)).toBe(15);
    expect(auQuartDHeureSuperieur(7)).toBe(15);
    expect(auQuartDHeureSuperieur(15)).toBe(15);
    expect(auQuartDHeureSuperieur(16)).toBe(30);
    expect(auQuartDHeureSuperieur(60)).toBe(60);
    expect(auQuartDHeureSuperieur(61)).toBe(75);
  });

  it("zéro minute ne devient pas un quart d'heure", () => {
    expect(auQuartDHeureSuperieur(0)).toBe(0);
    expect(auQuartDHeureSuperieur(-5)).toBe(0);
  });

  it("D11 — le temps est cumulé PAR TECHNICIEN avant d'être arrondi", () => {
    // Trois tâches de dix minutes font une demi-heure, pas trois quarts
    // d'heure : les lignes ne s'arrondissent jamais une à une.
    const trois = valoriser(
      [
        ligne({ dureeMinutes: 10 }),
        ligne({ dureeMinutes: 10 }),
        ligne({ dureeMinutes: 10 }),
      ],
      TAUX,
      [],
      XPF,
    );

    expect(trois.mainDOeuvre).toHaveLength(1);
    expect(trois.mainDOeuvre[0]?.minutesReelles).toBe(30);
    expect(trois.mainDOeuvre[0]?.minutesFacturees).toBe(30);
    expect(trois.totalHt).toEqual(montant(5_000, XPF));
  });

  it("D57 — l'arrondi ne se mutualise PAS entre interventions", () => {
    // L'exemple de la décision, rejoué : cinq interventions distinctes de cinq
    // minutes, chacune valorisée pour elle-même.
    const cinq = Array.from({ length: 5 }, () =>
      valoriser([ligne({ dureeMinutes: 5 })], TAUX, [], XPF),
    );

    const minutes = cinq.reduce(
      (somme, une) => somme + (une.mainDOeuvre[0]?.minutesFacturees ?? 0),
      0,
    );
    expect(minutes).toBe(75);

    // Et la contre-mesure : les mêmes cinq passages dans UNE intervention
    // feraient 30 minutes. C'est le témoin qui rend la décision visible — sans
    // lui, « 75 » ne se distingue pas d'un résultat obtenu par hasard.
    const groupees = valoriser(
      Array.from({ length: 5 }, () => ligne({ dureeMinutes: 5 })),
      TAUX,
      [],
      XPF,
    );
    expect(groupees.mainDOeuvre[0]?.minutesFacturees).toBe(30);
  });

  it("chaque technicien est cumulé et arrondi SÉPARÉMENT", () => {
    const deux = valoriser(
      [
        ligne({ technicienId: "t1", dureeMinutes: 20 }),
        ligne({ technicienId: "t2", dureeMinutes: 20 }),
      ],
      TAUX,
      [],
      XPF,
    );

    expect(deux.mainDOeuvre).toHaveLength(2);
    expect(deux.mainDOeuvre.map((l) => l.minutesFacturees)).toEqual([30, 30]);
    // 60 minutes facturées au total, et non 40 arrondies à 45.
    expect(deux.totalHt).toEqual(montant(10_000, XPF));
  });
});

describe("le trajet n'est jamais du temps facturé (D74)", () => {
  it("compte dans le temps RÉEL et pour rien dans le facturé", () => {
    const avecTrajet = valoriser(
      [
        ligne({ type: "trajet", dureeMinutes: 25, facturable: false }),
        ligne({ dureeMinutes: 60 }),
      ],
      TAUX,
      [],
      XPF,
    );

    expect(avecTrajet.minutesReellesTotales).toBe(85);
    expect(avecTrajet.minutesTrajet).toBe(25);
    expect(avecTrajet.mainDOeuvre[0]?.minutesFacturees).toBe(60);
    expect(avecTrajet.totalHt).toEqual(montant(10_000, XPF));
  });

  it("un trajet marqué facturable ne l'est pas non plus", () => {
    // La colonne `facturable` dit ce qui se facture ; le TYPE « trajet » est
    // plus fort qu'elle ici, parce que D74 est une décision de rang 1 et non
    // une donnée de ligne. Ce que la colonne gouverne est le reste.
    const force = valoriser(
      [ligne({ type: "trajet", dureeMinutes: 30, facturable: true })],
      TAUX,
      [],
      XPF,
    );

    expect(force.minutesTrajet).toBe(30);
    expect(force.mainDOeuvre).toHaveLength(0);
    expect(force.totalHt).toEqual(montant(0, XPF));
  });

  it("l'attente et la pause non facturables sortent du temps facturé", () => {
    const mixte = valoriser(
      [
        ligne({ type: "attente", dureeMinutes: 45, facturable: false }),
        ligne({ type: "pause", dureeMinutes: 30, facturable: false }),
        ligne({ dureeMinutes: 60 }),
      ],
      TAUX,
      [],
      XPF,
    );

    expect(mixte.minutesNonFacturables).toBe(75);
    expect(mixte.mainDOeuvre[0]?.minutesFacturees).toBe(60);
  });
});

describe("les forfaits s'AJOUTENT toujours aux heures (D77)", () => {
  it("le total hors taxes est la somme des deux", () => {
    // D77 : un forfait s'ajoute toujours, il n'absorbe jamais d'heures.
    const avecForfait = valoriser(
      [ligne({ dureeMinutes: 60 })],
      TAUX,
      [
        {
          code: "DEP",
          libelle: "Déplacement",
          montant: montant(8_000, XPF),
        },
      ],
      XPF,
    );

    expect(avecForfait.totalMainDOeuvre).toEqual(montant(10_000, XPF));
    expect(avecForfait.totalForfaits).toEqual(montant(8_000, XPF));
    expect(avecForfait.totalHt).toEqual(montant(18_000, XPF));
  });

  it("un forfait seul, sans heure pointée, se valorise quand même", () => {
    const seul = valoriser(
      [],
      TAUX,
      [
        {
          code: "MES",
          libelle: "Mise en service",
          montant: montant(45_000, XPF),
        },
      ],
      XPF,
    );

    expect(seul.mainDOeuvre).toEqual([]);
    expect(seul.totalHt).toEqual(montant(45_000, XPF));
  });
});

describe("le taux HISTORISÉ, et son absence (RG-TAR-04)", () => {
  it("un taux absent ne fait pas échouer : il vaut zéro, et cela se voit", () => {
    // Une intervention non encore qualifiée n'a pas de taux figé. Rendre zéro
    // plutôt que lever laisse l'écran afficher le temps passé — ce qui est la
    // question qu'on lui pose — sans inventer un montant.
    const sansTaux = valoriser([ligne({ dureeMinutes: 90 })], null, [], XPF);

    expect(sansTaux.mainDOeuvre[0]?.minutesFacturees).toBe(90);
    expect(sansTaux.totalHt).toEqual(montant(0, XPF));
  });

  it("le montant est un calcul ENTIER, jamais un flottant", () => {
    // 7 minutes → 15 minutes ; 15 × 10 000 / 60 = 2 500, exactement.
    const court = valoriser([ligne({ dureeMinutes: 7 })], TAUX, [], XPF);
    expect(court.totalHt).toEqual(montant(2_500, XPF));

    // Un taux qui ne tombe pas juste : 15 × 3 333 / 60 = 833,25 → 833.
    const bancal = valoriser(
      [ligne({ dureeMinutes: 7 })],
      BigInt(3_333),
      [],
      XPF,
    );
    expect(bancal.totalHt).toEqual(montant(833, XPF));
  });
});

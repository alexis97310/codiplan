import { describe, expect, it } from "vitest";

import {
  anneeDeDepartFeries,
  anneesFeries,
  feriesDuTerritoire,
  ANNEES_AU_DELA,
  SOCIETES,
} from "@/prisma/seed-data";
import {
  anneeCourante,
  cleJour,
  comparerJours,
  ecartsHorizon,
  horizonSuffisant,
  jourDansNMois,
  lireCleJour,
  maintenant,
  MOIS_D_AVANCE_EXIGES,
  type EtatHorizon,
} from "@/lib/calendar";

/**
 * L'horizon des jours fériés (ticket L0-08 ; D46, complément 3).
 *
 * **Le défaut visé n'est pas une absence, c'est une péremption.** Une table de
 * fériés alimentée aujourd'hui cessera de connaître les fériés dans deux ans
 * sans jamais être vide : elle sera périmée, le planning proposera des créneaux
 * un 1ᵉʳ mai, et aucun décompte ne le signalera. C'est ce qu'un horizon
 * GLISSANT et un contrôle daté empêchent — le principe des gardiens du lot 0
 * appliqué au temps.
 *
 * Deux choses sont éprouvées ici : la règle de comparaison (`ecartsHorizon`),
 * et le fait que le SEED lui-même tient l'exigence — sans quoi la porte
 * `verify:full` échouerait dès la première exécution.
 */

const REFERENCE: EtatHorizon = {
  territoire: "NC",
  aujourdhui: lireCleJour("2026-08-21"),
  dernier: lireCleJour("2028-12-25"),
  agences: 3,
};

describe("arithmétique des mois", () => {
  it("avance de douze mois en conservant le quantième", () => {
    expect(cleJour(jourDansNMois(lireCleJour("2026-08-21"), 12))).toBe(
      "2027-08-21",
    );
  });

  it("franchit l'année", () => {
    expect(cleJour(jourDansNMois(lireCleJour("2026-11-30"), 3))).toBe(
      "2027-02-28",
    );
  });

  /**
   * Le 31 janvier plus un mois : `Date` déborderait sur le 3 mars, ce qui
   * rendrait l'exigence plus stricte un mois sur douze sans que personne
   * comprenne pourquoi.
   */
  it("ramène le quantième au dernier jour du mois d'arrivée", () => {
    expect(cleJour(jourDansNMois(lireCleJour("2027-01-31"), 1))).toBe(
      "2027-02-28",
    );
    expect(cleJour(jourDansNMois(lireCleJour("2028-01-31"), 1))).toBe(
      "2028-02-29",
    );
  });
});

describe("la règle : douze mois d'avance, territoire par territoire", () => {
  it("accepte un horizon confortable", () => {
    expect(horizonSuffisant(REFERENCE)).toBe(true);
    expect(ecartsHorizon([REFERENCE])).toEqual([]);
  });

  it("refuse une table PÉRIMÉE, et nomme le territoire et la dernière date", () => {
    const perime: EtatHorizon = {
      ...REFERENCE,
      dernier: lireCleJour("2027-01-01"),
    };

    const ecarts = ecartsHorizon([perime]);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("NC");
    expect(ecarts[0]).toContain("2027-01-01");
    expect(ecarts[0]).toContain("2027-08-21");
    expect(ecarts[0]).toContain("PÉRIMÉE");
  });

  it("refuse un territoire sans aucun férié", () => {
    const ecarts = ecartsHorizon([{ ...REFERENCE, dernier: null }]);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("AUCUN jour férié");
  });

  /**
   * Zéro territoire est un échec, pas un succès. Une base vide produit le même
   * silence qu'une base à jour — c'est la doctrine du lot 0, celle qui fait
   * qu'un inventaire vide ne prouve rien.
   */
  it("refuse de conclure sur zéro territoire", () => {
    const ecarts = ecartsHorizon([]);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("n'a rien prouvé");
  });

  it("la borne est exacte : un jour de moins échoue, le jour même passe", () => {
    const exige = jourDansNMois(REFERENCE.aujourdhui, MOIS_D_AVANCE_EXIGES);

    expect(horizonSuffisant({ ...REFERENCE, dernier: exige })).toBe(true);
    expect(
      horizonSuffisant({
        ...REFERENCE,
        dernier: lireCleJour("2027-08-20"),
      }),
    ).toBe(false);
  });

  /**
   * **Le scénario « agence sans territoire » a quitté ce fichier, et c'est un
   * renforcement** (D48). Il éprouvait un rapport nocturne qui NOMMAIT une
   * agence sans territoire ; `agence.territoire` est NOT NULL depuis L0-09a, et
   * la garantie est devenue une contrainte de base qui l'EMPÊCHE d'exister.
   * Elle s'éprouve donc là où elle vit : `tests/isolation/territoire-chaine.test.ts`,
   * qui prouve le refus contre un vrai PostgreSQL — et l'éprouve en retirant
   * réellement la contrainte.
   */
});

describe("le seed tient l'exigence — horizon GLISSANT, jamais figé", () => {
  it("part de l'année en cours, dans le fuseau de la société", () => {
    for (const societe of SOCIETES) {
      expect(anneeDeDepartFeries(societe)).toBe(
        anneeCourante(societe.fuseau_horaire),
      );
    }
  });

  it("couvre l'année en cours et les deux suivantes", () => {
    expect(anneesFeries(2026)).toEqual([2026, 2027, 2028]);
    expect(anneesFeries(2030)).toHaveLength(ANNEES_AU_DELA + 1);
  });

  /**
   * **Le scénario qui se périmerait si l'horizon cessait de glisser.** Il lit
   * la date du jour : une liste d'années écrite à la main le ferait tomber le
   * 1ᵉʳ janvier de l'année où elle deviendrait fausse — ce qui est exactement
   * ce qu'on veut, et exactement ce qu'aucun test ordinaire ne fait.
   */
  it("chaque territoire du jeu garde douze mois d'avance, aujourd'hui", () => {
    for (const societe of SOCIETES) {
      const anneeDeDepart = anneeDeDepartFeries(societe);
      const aujourdhui = maintenant(societe.fuseau_horaire).local;
      const exige = jourDansNMois(aujourdhui, MOIS_D_AVANCE_EXIGES);

      for (const territoire of new Set(
        societe.agences.map((agence) => agence.territoire),
      )) {
        const dates = anneesFeries(anneeDeDepart)
          .flatMap((annee) => feriesDuTerritoire(territoire, annee))
          .map((ferie) => ferie.date)
          .sort();
        const dernier = dates.at(-1) ?? "";

        expect(dates.length).toBeGreaterThan(20);
        expect(
          comparerJours(lireCleJour(dernier), exige) >= 0,
          `territoire ${territoire} : dernier férié ${dernier}, exigé ${cleJour(exige)}`,
        ).toBe(true);
      }
    }
  });

  it("l'horizon d'une année de départ figée deviendrait insuffisant — c'est le défaut évité", () => {
    // Démonstration à l'envers : une liste figée à 2020 ne tient plus
    // l'exigence. C'est ce que le seed produirait s'il portait des années
    // écrites à la main, et c'est ce que le complément 3 de D46 prévient.
    const fige = anneesFeries(2020)
      .flatMap((annee) => feriesDuTerritoire("NC", annee))
      .map((ferie) => ferie.date)
      .sort();

    expect(
      horizonSuffisant({
        ...REFERENCE,
        dernier: lireCleJour(fige.at(-1) ?? ""),
      }),
    ).toBe(false);
  });
});

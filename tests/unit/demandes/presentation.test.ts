import { describe, expect, it } from "vitest";

import {
  receptionPremiereLigne,
  receptionSecondeLigne,
  surtitreFiche,
} from "../../../app/(back-office)/demandes/presentation";

/**
 * QE-9, D176 (9ED-TP-UX3-D2-DEMANDES) — LA RÉCEPTION D'UNE DEMANDE, SUR DEUX
 * NIVEAUX, ET LE SURTITRE DE LA FICHE.
 *
 * `receptionPremiereLigne`/`receptionSecondeLigne` ne lisent JAMAIS l'heure
 * (L0-08) : `aujourdhuiLocal` est un paramètre, comme pour `ancienneteEnJours`
 * — un calcul pur, jamais recalculé par la date de l'exécution.
 */
const FUSEAU = "Pacific/Noumea";
/** 25/09/2026, pour que « aujourd'hui » et « il y a N jours » se distinguent. */
const AUJOURDHUI = { annee: 2026, mois: 9, jour: 25 };

describe("receptionPremiereLigne", () => {
  it("« Aujourd'hui HH:MM » quand la demande est déposée le jour même", () => {
    // 25/09/2026 à 04:40 UTC = 25/09/2026 à 15:40 à Nouméa (UTC+11).
    const deposeLe = new Date("2026-09-25T04:40:00.000Z");
    expect(receptionPremiereLigne(deposeLe, FUSEAU, AUJOURDHUI)).toBe(
      "Aujourd’hui 15:40",
    );
  });

  it("« JJ/MM HH:MM » quand la demande est déposée un autre jour", () => {
    const deposeLe = new Date("2026-09-22T04:40:00.000Z");
    expect(receptionPremiereLigne(deposeLe, FUSEAU, AUJOURDHUI)).toBe(
      "22/09 15:40",
    );
  });
});

describe("receptionSecondeLigne", () => {
  it("`null` quand la demande est déposée aujourd'hui", () => {
    const deposeLe = new Date("2026-09-25T04:40:00.000Z");
    expect(receptionSecondeLigne(deposeLe, FUSEAU, AUJOURDHUI)).toBeNull();
  });

  it("« il y a N jour(s) » autrement, au singulier et au pluriel", () => {
    const hier = new Date("2026-09-24T04:40:00.000Z");
    expect(receptionSecondeLigne(hier, FUSEAU, AUJOURDHUI)).toBe(
      "il y a 1 jour",
    );
    const avantHier = new Date("2026-09-22T04:40:00.000Z");
    expect(receptionSecondeLigne(avantHier, FUSEAU, AUJOURDHUI)).toBe(
      "il y a 3 jours",
    );
  });
});

describe("surtitreFiche", () => {
  it("« Demande · Numéro provisoire » quand le numéro n'est pas encore attribué", () => {
    expect(surtitreFiche(null)).toBe("Demande · Numéro provisoire");
  });

  it("« Demande · DEM-00029 » une fois le numéro attribué", () => {
    expect(surtitreFiche(29)).toBe("Demande · DEM-00029");
  });
});

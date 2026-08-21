import { describe, expect, it } from "vitest";

import {
  avertissementSiteFerme,
  conflitPose,
  departCompteurAccuse,
  echeanceSla,
  joursOuvresAgence,
  lireCleJour,
  minutesHorsOuvertureTechnicien,
  versInstant,
  versLocal,
  type Calendrier,
} from "@/lib/calendar";

import { calendrierDeDemonstration } from "./calendriers-de-demonstration";

/**
 * Un calendrier de référence PAR USAGE (arbitrage D13).
 *
 * D13 ne dit pas « le calendrier », il dit **lequel**. Le scénario qui suit est
 * celui qui rend la distinction indispensable : une intervention posée à KONÉ,
 * un samedi, par un technicien de DUCOS.
 *
 *   — le SLA court sur le calendrier de l'agence de l'INTERVENTION — Koné, qui
 *     est fermée : le compteur ne démarre que le lundi ;
 *   — la majoration se calcule sur celui de l'agence du TECHNICIEN — Ducos, qui
 *     ouvre le samedi matin : l'intervention n'est PAS hors ouverture.
 *
 * Deux réponses opposées sur le même créneau. Une fonction unique prenant « le
 * calendrier » aurait laissé le choix à l'appelant, et le premier appelant
 * pressé aurait passé celui qu'il avait sous la main.
 */

const DUCOS = calendrierDeDemonstration("CODIMA-NC", "DUCOS");
const KONE = calendrierDeDemonstration("CODIMA-NC", "KONE");

const SAMEDI_22 = "2026-08-22";
const DIMANCHE_23 = "2026-08-23";
const LUNDI_24 = "2026-08-24";

function instantLocal(
  calendrier: Calendrier,
  jour: string,
  heures: number,
  minutes = 0,
): Date {
  return versInstant(
    { ...lireCleJour(jour), heures, minutes, secondes: 0 },
    calendrier.fuseau,
  );
}

function lectureLocale(calendrier: Calendrier, instant: Date): string {
  const local = versLocal(instant, calendrier.fuseau);
  const deuxChiffres = (valeur: number): string =>
    String(valeur).padStart(2, "0");
  return (
    `${local.annee}-${deuxChiffres(local.mois)}-${deuxChiffres(local.jour)} ` +
    `${deuxChiffres(local.heures)}:${deuxChiffres(local.minutes)}`
  );
}

// Le créneau du scénario : samedi 22 août 2026, 8 h – 10 h, heure de Nouméa.
const CRENEAU = {
  debut: instantLocal(DUCOS, SAMEDI_22, 8),
  fin: instantLocal(DUCOS, SAMEDI_22, 10),
};

describe("le même créneau, deux calendriers, deux réponses (D13)", () => {
  it("le SLA suit l'agence de l'INTERVENTION — Koné, fermée le samedi", () => {
    const echeance = echeanceSla(KONE, CRENEAU.debut, 2 * 60);
    expect(lectureLocale(KONE, echeance)).toBe(`${LUNDI_24} 09:30`);
  });

  it("la majoration suit l'agence du TECHNICIEN — Ducos, ouverte le samedi", () => {
    expect(
      minutesHorsOuvertureTechnicien(DUCOS, CRENEAU.debut, CRENEAU.fin),
    ).toBe(0);
  });

  it("et l'inverse serait faux : Koné compterait deux heures majorées", () => {
    // Ce n'est pas une variante acceptable, c'est le défaut que D13 prévient.
    expect(
      minutesHorsOuvertureTechnicien(KONE, CRENEAU.debut, CRENEAU.fin),
    ).toBe(2 * 60);
  });
});

describe("accusé de réception — en heures ouvrées de l'agence (D13)", () => {
  /**
   * « Une demande déposée sur le portail un dimanche à 22 h déclenche son
   * compteur à l'ouverture du lundi. » La réponse inverse générerait des
   * alertes toutes les nuits.
   */
  it("un dépôt le dimanche à 22 h démarre son compteur au lundi matin", () => {
    const depot = instantLocal(KONE, DIMANCHE_23, 22);
    expect(lectureLocale(KONE, departCompteurAccuse(KONE, depot))).toBe(
      `${LUNDI_24} 07:30`,
    );
  });

  it("un dépôt en pleine ouverture démarre son compteur immédiatement", () => {
    const depot = instantLocal(KONE, LUNDI_24, 9);
    expect(departCompteurAccuse(KONE, depot)).toEqual(depot);
  });
});

describe("conflit à la pose — signalé, jamais bloquant (RG-PLA-03)", () => {
  it("rend un signal chiffré quand le créneau sort du calendrier du technicien", () => {
    expect(conflitPose(KONE, CRENEAU.debut, CRENEAU.fin)).toEqual({
      minutes_hors_calendrier: 2 * 60,
    });
  });

  it("rend `null` quand le créneau est entièrement couvert", () => {
    expect(conflitPose(DUCOS, CRENEAU.debut, CRENEAU.fin)).toBeNull();
  });
});

describe("site fermé — avertissement, jamais blocage (D13)", () => {
  it("chiffre le débordement sans rien refuser", () => {
    // Les horaires du site sont reçus sous la même forme qu'un calendrier ; la
    // table `site` du lot 1 les portera. Ce module ne fait que les lire.
    const horairesSite = KONE;
    expect(
      avertissementSiteFerme(horairesSite, CRENEAU.debut, CRENEAU.fin),
    ).toEqual({ minutes_hors_horaires: 2 * 60 });
  });
});

describe("jours ouvrés des indicateurs — par agence (D13)", () => {
  it("diffère d'une agence à l'autre au sein d'une même société", () => {
    const du = lireCleJour("2026-08-17");
    const au = lireCleJour(DIMANCHE_23);
    expect(joursOuvresAgence(DUCOS, du, au)).toBe(6);
    expect(joursOuvresAgence(KONE, du, au)).toBe(5);
  });
});

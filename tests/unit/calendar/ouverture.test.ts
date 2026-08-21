import { describe, expect, it } from "vitest";

import {
  echeanceEnMinutesOuvrees,
  estJourOuvre,
  estOuvert,
  joursOuvres,
  lireCleJour,
  minutesHorsOuverture,
  minutesOuvrees,
  prochainCreneauOuvert,
  versInstant,
  versLocal,
  type Calendrier,
} from "@/lib/calendar";

import { calendrierDeDemonstration } from "./calendriers-de-demonstration";

/**
 * Jours et heures ouvrés (ticket L0-08 point 5 ; invariant I7 ; RG-PLA-01,
 * RG-PLA-02).
 *
 * Les trois critères d'acceptation du ticket L0-08 sont éprouvés ici, sur les
 * calendriers du JEU DE DÉMONSTRATION et non sur des horaires fabriqués :
 *
 *   1. le samedi est ouvré pour Ducos et non pour Koné ;
 *   2. un férié marqué travaillé compte comme ouvré ;
 *   3. un délai SLA de 4 h ouvrées démarré vendredi 16 h échoit lundi.
 *
 * Le troisième mérite une précision que le ticket laisse implicite : il n'est
 * vrai que sur un calendrier fermé le samedi. Sur celui de Ducos, le même délai
 * échoit le SAMEDI — et c'est très exactement ce que I7 défend en refusant
 * « tout calendrier global codé en dur ». Les deux sont donc éprouvés.
 */

const DUCOS = calendrierDeDemonstration("CODIMA-NC", "DUCOS");
const KONE = calendrierDeDemonstration("CODIMA-NC", "KONE");
const SIEGE = calendrierDeDemonstration("CODIMA-EU", "SIEGE");

/** Un instant, désigné par l'heure LOCALE du calendrier qui le lit. */
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

/** Rend `AAAA-MM-JJ HH:MM` dans le fuseau du calendrier — lisible à l'échec. */
function lectureLocale(calendrier: Calendrier, instant: Date): string {
  const local = versLocal(instant, calendrier.fuseau);
  const deuxChiffres = (valeur: number): string =>
    String(valeur).padStart(2, "0");
  return (
    `${local.annee}-${deuxChiffres(local.mois)}-${deuxChiffres(local.jour)} ` +
    `${deuxChiffres(local.heures)}:${deuxChiffres(local.minutes)}`
  );
}

// Semaine ordinaire d'août 2026 : le lundi 17 au dimanche 23, aucun férié.
const LUNDI_17 = "2026-08-17";
const VENDREDI_21 = "2026-08-21";
const SAMEDI_22 = "2026-08-22";
const DIMANCHE_23 = "2026-08-23";
const LUNDI_24 = "2026-08-24";

describe("critère 1 — le samedi est ouvré pour Ducos, pas pour Koné", () => {
  it("Ducos ouvre le samedi matin", () => {
    expect(estJourOuvre(DUCOS, lireCleJour(SAMEDI_22))).toBe(true);
    expect(estOuvert(DUCOS, instantLocal(DUCOS, SAMEDI_22, 9))).toBe(true);
  });

  it("Koné n'ouvre pas le samedi", () => {
    expect(estJourOuvre(KONE, lireCleJour(SAMEDI_22))).toBe(false);
    expect(estOuvert(KONE, instantLocal(KONE, SAMEDI_22, 9))).toBe(false);
  });

  it("ni l'un ni l'autre n'ouvre le dimanche", () => {
    expect(estJourOuvre(DUCOS, lireCleJour(DIMANCHE_23))).toBe(false);
    expect(estJourOuvre(KONE, lireCleJour(DIMANCHE_23))).toBe(false);
  });

  it("la semaine du 17 au 23 août compte six jours ouvrés à Ducos, cinq à Koné", () => {
    const du = lireCleJour(LUNDI_17);
    const au = lireCleJour(DIMANCHE_23);
    expect(joursOuvres(DUCOS, du, au)).toBe(6);
    expect(joursOuvres(KONE, du, au)).toBe(5);
  });
});

describe("critère 2 — un férié travaillé compte comme ouvré (RG-PLA-02)", () => {
  // Lundi de Pentecôte 2026 : le 25 mai. Le calendrier du siège le porte comme
  // TRAVAILLÉ (journée de solidarité) ; l'Ascension, le 14 mai, reste chômée.
  const PENTECOTE = "2026-05-25";
  const ASCENSION = "2026-05-14";

  it("le férié travaillé est un jour ouvré ordinaire", () => {
    expect(estJourOuvre(SIEGE, lireCleJour(PENTECOTE))).toBe(true);
    expect(estOuvert(SIEGE, instantLocal(SIEGE, PENTECOTE, 10))).toBe(true);
  });

  it("le férié chômé ne l'est pas, alors que le calendrier ouvre ce jour-là", () => {
    // Le 14 mai 2026 est un jeudi : sans le férié, le siège serait ouvert.
    expect(estJourOuvre(SIEGE, lireCleJour(ASCENSION))).toBe(false);
    expect(estOuvert(SIEGE, instantLocal(SIEGE, ASCENSION, 10))).toBe(false);
  });

  it("un férié chômé retire ses heures du décompte ouvré", () => {
    // Le siège ouvre 9 h – 12 h 30 et 14 h – 18 h, soit 7 h 30 par jour.
    const jeudiOrdinaire = minutesOuvrees(
      SIEGE,
      instantLocal(SIEGE, "2026-05-07", 0),
      instantLocal(SIEGE, "2026-05-08", 0),
    );
    const jeudiAscension = minutesOuvrees(
      SIEGE,
      instantLocal(SIEGE, ASCENSION, 0),
      instantLocal(SIEGE, "2026-05-15", 0),
    );

    expect(jeudiOrdinaire).toBe(7 * 60 + 30);
    expect(jeudiAscension).toBe(0);
  });
});

describe("critère 3 — 4 h ouvrées démarrées vendredi 16 h", () => {
  /**
   * Koné ferme à 17 h et n'ouvre pas le samedi : il reste une heure le
   * vendredi, les trois autres tombent le lundi matin, à l'ouverture de
   * 7 h 30. L'échéance est donc lundi 10 h 30.
   */
  it("échoit le LUNDI sur un calendrier fermé le samedi (Koné)", () => {
    const echeance = echeanceEnMinutesOuvrees(
      KONE,
      instantLocal(KONE, VENDREDI_21, 16),
      4 * 60,
    );
    expect(lectureLocale(KONE, echeance)).toBe(`${LUNDI_24} 10:30`);
  });

  /**
   * Sur le calendrier de Ducos, le samedi matin absorbe les trois heures
   * restantes : l'échéance tombe le SAMEDI. C'est le même délai, la même
   * société, et deux réponses — « aucun calendrier global codé en dur » (I7).
   */
  it("échoit le SAMEDI sur le calendrier de Ducos", () => {
    const echeance = echeanceEnMinutesOuvrees(
      DUCOS,
      instantLocal(DUCOS, VENDREDI_21, 16),
      4 * 60,
    );
    expect(lectureLocale(DUCOS, echeance)).toBe(`${SAMEDI_22} 10:30`);
  });

  it("un délai démarré hors ouverture court à partir de l'ouverture suivante", () => {
    // Dimanche 22 h : le compteur ne démarre qu'au lundi 7 h 30 (D13).
    const echeance = echeanceEnMinutesOuvrees(
      KONE,
      instantLocal(KONE, DIMANCHE_23, 22),
      30,
    );
    expect(lectureLocale(KONE, echeance)).toBe(`${LUNDI_24} 08:00`);
  });
});

describe("prochain créneau ouvert", () => {
  it("rend l'instant lui-même quand le calendrier est déjà ouvert", () => {
    const instant = instantLocal(KONE, VENDREDI_21, 14);
    expect(prochainCreneauOuvert(KONE, instant)).toEqual(instant);
  });

  it("saute la coupure de midi", () => {
    const midi = instantLocal(KONE, VENDREDI_21, 12);
    expect(lectureLocale(KONE, prochainCreneauOuvert(KONE, midi))).toBe(
      `${VENDREDI_21} 13:00`,
    );
  });

  it("saute le week-end à Koné et s'arrête au samedi à Ducos", () => {
    const vendrediSoir = instantLocal(KONE, VENDREDI_21, 18);
    expect(lectureLocale(KONE, prochainCreneauOuvert(KONE, vendrediSoir))).toBe(
      `${LUNDI_24} 07:30`,
    );
    expect(
      lectureLocale(DUCOS, prochainCreneauOuvert(DUCOS, vendrediSoir)),
    ).toBe(`${SAMEDI_22} 07:30`);
  });
});

describe("minutes ouvrées et hors ouverture", () => {
  it("une journée ordinaire à Koné compte 8 h ouvrées", () => {
    // 7 h 30 – 11 h 30 puis 13 h – 17 h : la coupure de midi ne compte pas.
    expect(
      minutesOuvrees(
        KONE,
        instantLocal(KONE, VENDREDI_21, 0),
        instantLocal(KONE, SAMEDI_22, 0),
      ),
    ).toBe(8 * 60);
  });

  it("le complément est exactement le hors-ouverture (assiette de D12)", () => {
    const debut = instantLocal(KONE, VENDREDI_21, 6);
    const fin = instantLocal(KONE, VENDREDI_21, 20);
    const total = (fin.getTime() - debut.getTime()) / 60_000;

    expect(
      minutesOuvrees(KONE, debut, fin) + minutesHorsOuverture(KONE, debut, fin),
    ).toBe(total);
  });

  it("une intervention entièrement nocturne est entièrement hors ouverture", () => {
    const debut = instantLocal(KONE, VENDREDI_21, 22);
    const fin = instantLocal(KONE, SAMEDI_22, 2);
    expect(minutesOuvrees(KONE, debut, fin)).toBe(0);
    expect(minutesHorsOuverture(KONE, debut, fin)).toBe(4 * 60);
  });

  it("un intervalle vide ou inversé rend zéro, jamais un nombre négatif", () => {
    const instant = instantLocal(KONE, VENDREDI_21, 10);
    expect(minutesOuvrees(KONE, instant, instant)).toBe(0);
    expect(
      minutesOuvrees(KONE, instant, instantLocal(KONE, VENDREDI_21, 9)),
    ).toBe(0);
  });
});

describe("un calendrier sans aucune plage refuse plutôt que de boucler", () => {
  const ferme: Calendrier = { ...KONE, code: "FERME", plages: [] };

  it("le prochain créneau ouvert lève un refus explicite", () => {
    expect(() =>
      prochainCreneauOuvert(ferme, instantLocal(KONE, LUNDI_17, 8)),
    ).toThrow(/paramétrage incomplet/);
  });

  it("l'échéance ouvrée lève le même refus", () => {
    expect(() =>
      echeanceEnMinutesOuvrees(ferme, instantLocal(KONE, LUNDI_17, 8), 60),
    ).toThrow(/paramétrage incomplet/);
  });

  it("le décompte des minutes ouvrées refuse plutôt que de tronquer", () => {
    // Un décompte tronqué à l'horizon serait faux ET silencieux — le pire des
    // deux (CLAUDE.md §7 : ne pas réduire le périmètre en silence).
    expect(() =>
      minutesOuvrees(
        KONE,
        instantLocal(KONE, LUNDI_17, 8),
        instantLocal(KONE, "2030-01-01", 8),
      ),
    ).toThrow(/horizon/);
  });
});

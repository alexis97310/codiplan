import { describe, expect, it } from "vitest";

import {
  cleJour,
  echeanceEnMinutesOuvrees,
  estJourOuvre,
  estOuvert,
  jourSuivant,
  joursOuvres,
  lireCleJour,
  minutesHorsOuverture,
  minutesOuvrees,
  plagesDuJour,
  prochainCreneauOuvert,
  versInstant,
  versLocal,
  type Calendrier,
} from "@/lib/calendar";

import {
  calendrierDeDemonstration,
  ferieDeDemonstration,
  premiereAnneeDeLHorizon,
} from "./calendriers-de-demonstration";

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

// Semaine ordinaire d'août 2026 : le lundi 17 au dimanche 23. Les dates sont
// FIXES à dessein — les jours de semaine le sont aussi, et c'est d'eux que
// dépendent les critères 1 et 3. Aucun férié néo-calédonien ne tombe cette
// semaine-là ; le scénario « la semaine choisie est bien ordinaire » le
// vérifie plutôt que de le supposer, faute de quoi l'horizon glissant pourrait
// un jour faire dire autre chose à ces dates sans que personne le voie.
const LUNDI_17 = "2026-08-17";
const VENDREDI_21 = "2026-08-21";
const SAMEDI_22 = "2026-08-22";
const DIMANCHE_23 = "2026-08-23";
const LUNDI_24 = "2026-08-24";

describe("la semaine de référence est bien ordinaire", () => {
  it("aucun jour particulier ne tombe du 17 au 24 août", () => {
    // Les critères 1 et 3 reposent sur des jours de semaine, pas sur des
    // fériés. Si l'un d'eux le devenait — ou si l'horizon glissant venait à
    // couvrir cette semaine autrement —, les scénarios suivants changeraient
    // de sens en silence. On le constate ici, une fois.
    for (const calendrier of [DUCOS, KONE]) {
      for (const jour of [
        LUNDI_17,
        VENDREDI_21,
        SAMEDI_22,
        DIMANCHE_23,
        LUNDI_24,
      ]) {
        expect(
          calendrier.jours_particuliers.some(
            (particulier) => particulier.date === jour,
          ),
          `${calendrier.code} : ${jour} est devenu un jour particulier`,
        ).toBe(false);
      }
    }
  });
});

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
  // Les dates sont DÉRIVÉES de l'horizon glissant, jamais écrites : le lundi de
  // Pentecôte tombe le 25 mai en 2026 et le 17 mai en 2027, et un scénario qui
  // le figerait cesserait de porter sur les données du seed dès l'an prochain
  // (D46, complément 3). L'agence SIEGE travaille ce férié — journée de
  // solidarité ; l'Ascension, elle, reste chômée.
  const ANNEE = premiereAnneeDeLHorizon("CODIMA-EU");
  const PENTECOTE = ferieDeDemonstration(
    "CODIMA-EU",
    "SIEGE",
    "Lundi de Pentecôte",
    ANNEE,
  );
  const ASCENSION = ferieDeDemonstration(
    "CODIMA-EU",
    "SIEGE",
    "Ascension",
    ANNEE,
  );

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
    // L'Ascension tombe toujours un jeudi ; le jeudi précédent est ordinaire.
    const jour = lireCleJour(ASCENSION);
    const jeudiPrecedent = cleJour(jourSuivant(jour, -7));
    const lendemain = cleJour(jourSuivant(jour, 1));

    const jeudiOrdinaire = minutesOuvrees(
      SIEGE,
      instantLocal(SIEGE, jeudiPrecedent, 0),
      instantLocal(SIEGE, cleJour(jourSuivant(jour, -6)), 0),
    );
    const jeudiAscension = minutesOuvrees(
      SIEGE,
      instantLocal(SIEGE, ASCENSION, 0),
      instantLocal(SIEGE, lendemain, 0),
    );

    expect(jeudiOrdinaire).toBe(7 * 60 + 30);
    expect(jeudiAscension).toBe(0);
  });
});

describe("le PONT — l'écart local sans fait public (D46, complément 2)", () => {
  /**
   * Dolbeau et Ducos partagent le calendrier `DEMO-NOUMEA` : mêmes horaires,
   * même territoire, même fuseau. Seule Dolbeau porte le pont de la veille de
   * Noël. C'est la démonstration, en données, que l'écart local appartient à
   * l'AGENCE et non au calendrier — et c'est pourquoi `calendrier_ferie` porte
   * `agence_id`.
   */
  const DOLBEAU = calendrierDeDemonstration("CODIMA-NC", "DOLBEAU");
  const PONT = `${premiereAnneeDeLHorizon("CODIMA-NC")}-12-24`;

  it("Dolbeau chôme le pont, Ducos travaille — mêmes horaires, même calendrier", () => {
    const jour = lireCleJour(PONT);

    // Le 24 décembre n'est férié nulle part : sans l'écart local, la journée
    // suivrait simplement son jour de semaine.
    expect(
      DUCOS.jours_particuliers.some((particulier) => particulier.date === PONT),
    ).toBe(false);

    expect(estJourOuvre(DOLBEAU, jour)).toBe(
      // Le pont ne retire quelque chose que si le jour était ouvré : un
      // 24 décembre tombant un dimanche ne change rien, et le dire ainsi
      // garde le scénario juste quelle que soit l'année.
      false,
    );
    expect(estJourOuvre(DUCOS, jour)).toBe(
      plagesDuJour(DUCOS, jour).length > 0,
    );
  });

  it("le pont porte son motif, et son origine est l'agence", () => {
    const particulier = DOLBEAU.jours_particuliers.find(
      (candidat) => candidat.date === PONT,
    );

    expect(particulier).toEqual({
      date: PONT,
      libelle: "Pont de démonstration — veille de Noël",
      ouvre: false,
      origine: "agence",
    });
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

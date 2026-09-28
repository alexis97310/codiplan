import { describe, expect, it } from "vitest";

import { appliquerEcarts, type Calendrier } from "@/lib/calendar/calendrier";
import { cleJour, jourSuivant, type JourLocal } from "@/lib/calendar/fuseau";
import { estJourOuvre, plagesDuJour } from "@/lib/calendar/ouverture";
import {
  construireGrille,
  type AgenceDeGrille,
} from "@/lib/interventions/grille";
import {
  construireJournee,
  type AgenceDeJournee,
} from "@/lib/interventions/journee";

/**
 * PG-A1-FERIES-GRILLE (28/09/2026) — LA GRILLE ET LA VUE JOUR SUIVENT LE
 * CALENDRIER COMPLET, PAS LE SEUL JOUR DE SEMAINE.
 *
 * ## Le défaut mesuré
 *
 * En production le jeudi 24/09/2026, un jour férié chômé (« Fête de la
 * citoyenneté ») se lisait OUVERT sur la grille Semaine — « ouverte » ne
 * regardait que `jourSemaineIso(jour)`, jamais les fériés, les ponts ou les
 * exceptions du calendrier de l'agence (I7).
 *
 * ## Ce que ce fichier exige
 *
 * Sur UNE ANNÉE ENTIÈRE d'un calendrier qui porte les quatre cas — un jour
 * ordinaire, un férié CHÔMÉ, un férié TRAVAILLÉ (RG-PLA-02) et un PONT —,
 * « ouvert » à la grille Semaine ⇔ `estJourOuvre(calendrier, jour)`, et la
 * vue Jour ne montre aucun créneau libre un jour chômé, ni sur les plages
 * d'un jour ouvert par exception celles de son seul jour de semaine.
 */

const ANNEE = 2026;
const PREMIER_JOUR: JourLocal = { annee: ANNEE, mois: 1, jour: 1 };
const NB_JOURS = 365;

/** Mardi ordinaire — le territoire le déclare férié, aucun écart : chômé. */
const FERIE_CHOME = "2026-07-14";
/** Vendredi ordinaire — férié déclaré, écart de l'agence : travaillé (RG-PLA-02). */
const FERIE_TRAVAILLE = "2026-05-01";
/** Lundi ordinaire — aucun férié, écart de l'agence : pont, donc chômé. */
const PONT = "2026-05-11";
/** Un autre vendredi, sans aucun écart — le témoin de « mêmes plages ». */
const VENDREDI_ORDINAIRE: JourLocal = { annee: 2026, mois: 5, jour: 8 };

const CALENDRIER: Calendrier = {
  code: "test-feries",
  fuseau: "Pacific/Noumea",
  territoire: "NC",
  plages: [1, 2, 3, 4, 5, 6].map((jour_semaine) => ({
    jour_semaine,
    debut_minutes: 450,
    fin_minutes: 1020,
  })),
  jours_particuliers: appliquerEcarts(
    [
      { date: FERIE_CHOME, libelle: "Férié chômé de test" },
      { date: FERIE_TRAVAILLE, libelle: "Férié travaillé de test" },
    ],
    [
      { date: FERIE_TRAVAILLE, travaille: true, motif: null },
      { date: PONT, travaille: false, motif: "Pont de test" },
    ],
  ),
};

const AGENCE_GRILLE: AgenceDeGrille = {
  id: "ag-test",
  libelle: "Agence de test",
  calendrier: CALENDRIER,
};

const AGENCE_JOURNEE: AgenceDeJournee = {
  id: "ag-test",
  libelle: "Agence de test",
  calendrier: CALENDRIER,
  pasCreneauMinutes: 30,
};

function joursDeLAnnee(): readonly JourLocal[] {
  const jours: JourLocal[] = [];
  let jour = PREMIER_JOUR;
  for (let i = 0; i < NB_JOURS; i += 1) {
    jours.push(jour);
    jour = jourSuivant(jour);
  }
  return jours;
}

describe("LA GRILLE — « ouvert » n'est jamais que estJourOuvre(calendrier, jour)", () => {
  it("sur les 365 jours de l'année, la grille et le calendrier disent LA MÊME CHOSE", () => {
    const jours = joursDeLAnnee();
    const grille = construireGrille([], jours, [AGENCE_GRILLE], () => null, [
      { id: "t1", agenceIds: [AGENCE_GRILLE.id] },
    ]);
    const ligne = grille[0];
    for (const [i, jour] of jours.entries()) {
      expect(
        ligne.cases[i].ouverte,
        `${cleJour(jour)} : la grille et estJourOuvre divergent`,
      ).toBe(estJourOuvre(CALENDRIER, jour));
    }
  });

  it("LE FÉRIÉ CHÔMÉ est fermé, alors que son jour de semaine (mardi) est ordinairement travaillé", () => {
    const jours = [{ annee: 2026, mois: 7, jour: 14 } as JourLocal];
    const grille = construireGrille([], jours, [AGENCE_GRILLE], () => null, [
      { id: "t1", agenceIds: [AGENCE_GRILLE.id] },
    ]);
    expect(grille[0].cases[0].ouverte).toBe(false);
  });

  it("LE FÉRIÉ TRAVAILLÉ reste ouvert (RG-PLA-02)", () => {
    const jours = [{ annee: 2026, mois: 5, jour: 1 } as JourLocal];
    const grille = construireGrille([], jours, [AGENCE_GRILLE], () => null, [
      { id: "t1", agenceIds: [AGENCE_GRILLE.id] },
    ]);
    expect(grille[0].cases[0].ouverte).toBe(true);
  });

  it("LE PONT est fermé, alors que son jour de semaine (lundi) est ordinairement travaillé", () => {
    const jours = [{ annee: 2026, mois: 5, jour: 11 } as JourLocal];
    const grille = construireGrille([], jours, [AGENCE_GRILLE], () => null, [
      { id: "t1", agenceIds: [AGENCE_GRILLE.id] },
    ]);
    expect(grille[0].cases[0].ouverte).toBe(false);
  });
});

const minutesDe = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();

describe("LA VUE JOUR — les plages du jour, jamais celles du seul jour de semaine", () => {
  it("UN FÉRIÉ CHÔMÉ n'a AUCUN créneau libre", () => {
    const jourFerie: JourLocal = { annee: 2026, mois: 7, jour: 14 };
    const journee = construireJournee(
      [],
      jourFerie,
      [AGENCE_JOURNEE],
      minutesDe,
      [{ id: "t1", agenceIds: [AGENCE_JOURNEE.id] }],
    );
    expect(journee.creneauxLibres).toBe(0);
    expect(journee.axe).toEqual([]);
  });

  it("UN PONT n'a AUCUN créneau libre", () => {
    const jourPont: JourLocal = { annee: 2026, mois: 5, jour: 11 };
    const journee = construireJournee(
      [],
      jourPont,
      [AGENCE_JOURNEE],
      minutesDe,
      [{ id: "t1", agenceIds: [AGENCE_JOURNEE.id] }],
    );
    expect(journee.creneauxLibres).toBe(0);
    expect(journee.axe).toEqual([]);
  });

  it("LES PLAGES D'UN FÉRIÉ TRAVAILLÉ sont celles de plagesDuJour — donc celles de son jour de semaine", () => {
    const jourFerieTravaille: JourLocal = { annee: 2026, mois: 5, jour: 1 };
    const journeeFerie = construireJournee(
      [],
      jourFerieTravaille,
      [AGENCE_JOURNEE],
      minutesDe,
      [{ id: "t1", agenceIds: [AGENCE_JOURNEE.id] }],
    );
    const journeeOrdinaire = construireJournee(
      [],
      VENDREDI_ORDINAIRE,
      [AGENCE_JOURNEE],
      minutesDe,
      [{ id: "t1", agenceIds: [AGENCE_JOURNEE.id] }],
    );
    // Le témoin direct : les plages effectives sont celles que `plagesDuJour`
    // rend, jamais une heure inventée pour l'occasion.
    expect(
      plagesDuJour(CALENDRIER, jourFerieTravaille).map((p) => [
        p.debut_minutes,
        p.fin_minutes,
      ]),
    ).toEqual(
      plagesDuJour(CALENDRIER, VENDREDI_ORDINAIRE).map((p) => [
        p.debut_minutes,
        p.fin_minutes,
      ]),
    );
    // Et l'axe de la journée en tire les mêmes bornes qu'un vendredi ordinaire.
    expect(journeeFerie.axe).toEqual(journeeOrdinaire.axe);
    expect(journeeFerie.creneauxLibres).toBeGreaterThan(0);
    expect(journeeFerie.creneauxLibres).toBe(journeeOrdinaire.creneauxLibres);
  });
});

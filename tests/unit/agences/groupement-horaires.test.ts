import { describe, expect, it } from "vitest";

import {
  grouperJoursParHoraire,
  type GroupeHoraire,
} from "@/app/(back-office)/parametres/agences/composants";
import type { Parametrage } from "@/lib/calendar/parametrage";

/**
 * PA-31 (QT-21, D167, 05/10/2026, TP-NAV1) — LA COLONNE « HORAIRES » NE
 * MONTRAIT QUE LES PLAGES DU PREMIER JOUR TRAVAILLÉ.
 *
 * Mesuré à l'audit du 28/09/2026 : les jours étaient listés en entier
 * (« lundi, mardi, … , samedi »), mais les plages et les créneaux affichés
 * n'étaient ceux QUE du premier jour — un samedi à horaires différents
 * (lundi–samedi, QG-7) n'apparaissait jamais, et la ligne se lisait comme
 * « toute la semaine aux mêmes heures ». `grouperJoursParHoraire` est
 * extraite de `LigneAgence` (même raison que `trierReglagesAgences`, D-13)
 * pour être éprouvée SANS base ni navigateur.
 */
describe("grouperJoursParHoraire (PA-31)", () => {
  const parametrage = (plages: Parametrage["plages"]): Parametrage => ({
    calendrierId: "cal-1",
    code: "CAL",
    libelle: "Calendrier",
    pasCreneauMinutes: 30,
    plages,
  });

  const jours = (groupe: GroupeHoraire) => groupe.jours;

  it("un seul groupe quand tous les jours travaillés portent les mêmes plages", () => {
    const p = parametrage([
      { jourSemaine: 1, debutMinutes: 480, finMinutes: 720 },
      { jourSemaine: 2, debutMinutes: 480, finMinutes: 720 },
      { jourSemaine: 3, debutMinutes: 480, finMinutes: 720 },
    ]);

    const groupes = grouperJoursParHoraire(p, [1, 2, 3]);

    expect(groupes).toHaveLength(1);
    expect(jours(groupes[0]!)).toEqual([1, 2, 3]);
    expect(groupes[0]!.premierJour).toBe(1);
  });

  it("DEUX groupes quand le samedi porte des horaires différents du reste de la semaine (QG-7)", () => {
    const p = parametrage([
      { jourSemaine: 1, debutMinutes: 420, finMinutes: 1020 }, // 07:00–17:00
      { jourSemaine: 2, debutMinutes: 420, finMinutes: 1020 },
      { jourSemaine: 3, debutMinutes: 420, finMinutes: 1020 },
      { jourSemaine: 4, debutMinutes: 420, finMinutes: 1020 },
      { jourSemaine: 5, debutMinutes: 420, finMinutes: 1020 },
      { jourSemaine: 6, debutMinutes: 480, finMinutes: 720 }, // 08:00–12:00
    ]);

    const groupes = grouperJoursParHoraire(p, [1, 2, 3, 4, 5, 6]);

    expect(groupes).toHaveLength(2);
    expect(jours(groupes[0]!)).toEqual([1, 2, 3, 4, 5]);
    expect(jours(groupes[1]!)).toEqual([6]);
    // LE DÉFAUT MESURÉ, EXACTEMENT : le samedi doit être son propre groupe,
    // avec ses propres plages — jamais absorbé par le premier jour.
    expect(groupes[1]!.premierJour).toBe(6);
  });

  it("un jour sans plage (coupure de midi deux fois) n'est jamais fusionné avec un jour continu identique en apparence", () => {
    const p = parametrage([
      { jourSemaine: 1, debutMinutes: 480, finMinutes: 690 },
      { jourSemaine: 1, debutMinutes: 750, finMinutes: 1020 },
      { jourSemaine: 2, debutMinutes: 480, finMinutes: 1020 },
    ]);

    const groupes = grouperJoursParHoraire(p, [1, 2]);

    expect(groupes).toHaveLength(2);
    expect(jours(groupes[0]!)).toEqual([1]);
    expect(jours(groupes[1]!)).toEqual([2]);
  });

  it("aucun jour travaillé ne rend aucun groupe", () => {
    expect(grouperJoursParHoraire(parametrage([]), [])).toEqual([]);
  });
});

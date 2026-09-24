import { describe, expect, it } from "vitest";

import type { JourLocal } from "@/lib/calendar/fuseau";
import {
  construireJournee,
  type AgenceDeJournee,
  type Occupante,
} from "@/lib/interventions/journee";

/**
 * 75-PLANNING-5 — CE QUE LES VISITES SANS HEURE PÈSENT SUR LA JOURNÉE (SAV-06).
 *
 * *Mesuré sur `main` 87d49b1 le 25/09/2026 : une journée où un technicien
 * porte une visite sans heure de trois heures affichait « 16 créneaux
 * libres » — le même compte qu'une journée entièrement vide, parce que
 * `sansHeure` ne retirait aucun créneau de l'axe.* `aCaler` mesure ce poids
 * SÉPARÉMENT de `creneauxLibres`, qui reste inchangé : on n'invente pas où
 * caser une visite sans heure.
 */

const LUNDI: JourLocal = { annee: 2026, mois: 8, jour: 17 };

const NOUMEA: AgenceDeJournee = {
  id: "ag-ducos",
  libelle: "Ducos",
  plages: [1, 2, 3, 4, 5, 6].flatMap((jourSemaine) => [
    { jourSemaine, debutMinutes: 450, finMinutes: 690 },
    { jourSemaine, debutMinutes: 780, finMinutes: 1020 },
  ]),
  pasCreneauMinutes: 30,
  calendrierConnu: true,
};

function instant(jour: JourLocal, minutes: number): Date {
  return new Date(
    Date.UTC(jour.annee, jour.mois - 1, jour.jour, 0, minutes, 0),
  );
}
const minutesDe = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();

function pose(p: Partial<Occupante> & { id: string }): Occupante {
  return {
    technicien_id: "t1",
    agence_id: NOUMEA.id,
    creneau_debut: null,
    creneau_fin: null,
    duree_estimee_min: null,
    ...p,
  };
}

describe("aCaler — ce que les visites sans heure pèsent", () => {
  it("0 visite sans heure : aCaler à zéro, creneauxLibres inchangé", () => {
    // Un créneau posé (`creneau_debut` non nul) de durée nulle : la colonne
    // existe, mais rien n'occupe l'axe — même compte de trous que les deux
    // scénarios suivants (16, voir plus bas), pour une comparaison directe.
    const j = construireJournee(
      [
        pose({
          id: "posee",
          creneau_debut: instant(LUNDI, 450),
          creneau_fin: instant(LUNDI, 450),
        }),
      ],
      LUNDI,
      [NOUMEA],
      minutesDe,
    );
    expect(j.aCaler).toEqual({ nombre: 0, minutesConnues: 0, sansDuree: 0 });
    expect(j.colonnes[0].aCaler).toEqual({
      nombre: 0,
      minutesConnues: 0,
      sansDuree: 0,
    });
    expect(j.creneauxLibres).toBe(16);
  });

  it("2 visites sans heure (120 min + 90 min) : { 2, 210, 0 }, creneauxLibres inchangé", () => {
    const j = construireJournee(
      [
        pose({ id: "a", duree_estimee_min: 120 }),
        pose({ id: "b", duree_estimee_min: 90 }),
      ],
      LUNDI,
      [NOUMEA],
      minutesDe,
    );
    expect(j.aCaler).toEqual({ nombre: 2, minutesConnues: 210, sansDuree: 0 });
    expect(j.colonnes[0].aCaler).toEqual({
      nombre: 2,
      minutesConnues: 210,
      sansDuree: 0,
    });
    // Aucune des deux n'occupe une cellule (pas d'heure saisie) : les 16
    // créneaux libres de NOUMEA un lundi (19 dans l'axe, moins les 3 de la
    // pause 10:30–13:00, `hors_ouverture`) restent 16 — `aCaler` n'en retire
    // aucun.
    expect(j.creneauxLibres).toBe(16);
  });

  it("1 visite sans durée : sansDuree = 1, minutesConnues n'y ajoute rien", () => {
    const j = construireJournee(
      [pose({ id: "a", duree_estimee_min: null })],
      LUNDI,
      [NOUMEA],
      minutesDe,
    );
    expect(j.aCaler).toEqual({ nombre: 1, minutesConnues: 0, sansDuree: 1 });
    expect(j.colonnes[0].aCaler).toEqual({
      nombre: 1,
      minutesConnues: 0,
      sansDuree: 1,
    });
    expect(j.creneauxLibres).toBe(16);
  });
});

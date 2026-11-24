import { describe, expect, it } from "vitest";

import type { JourLocal } from "@/lib/calendar/fuseau";
import { repartirJourneeTechnicien } from "@/lib/interventions/journee-technicien";

/**
 * « MA JOURNÉE » RÉPARTIE PAR JOUR CIVIL (9F2-TERRAIN-JOURS-MAQUETTE, décision
 * n° 92 d'Alexis, D210).
 *
 * `repartirJourneeTechnicien` ne lit ni la base ni l'horloge : le filtrage
 * (transmis, jamais planifiée ni annulée ; en retard = affectée seulement)
 * est déjà fait par l'appelant (`listerPlanning`, `interventionsEnRetard`)
 * avant d'arriver ici — voir les épreuves de bout en bout pour cette
 * partie-là (§9, 01/09 : une seule lecture du critère).
 *
 * Elle lit le statut, la priorité et le créneau de chaque ligne pour les
 * trier (9L41-MA-JOURNEE-TRI-A-FAIRE) — voir `tests/unit/terrain/
 * tri-journee.test.ts` pour la règle elle-même ; ce fichier ne teste que la
 * répartition par jour civil, avec des lignes toutes à `p3`/`affectee` par
 * défaut sauf où le tri est précisément ce qui est vérifié.
 */

const AUJOURDHUI: JourLocal = { annee: 2026, mois: 9, jour: 28 };

type Ligne = {
  readonly id: string;
  readonly date_planifiee: Date | null;
  readonly statut: string;
  readonly priorite: string;
  readonly creneau_debut: Date | null;
};

function ligne(
  id: string,
  jour: JourLocal | null,
  options?: {
    readonly statut?: string;
    readonly priorite?: string;
    readonly creneau_debut?: Date | null;
  },
): Ligne {
  return {
    id,
    date_planifiee:
      jour === null
        ? null
        : new Date(Date.UTC(jour.annee, jour.mois - 1, jour.jour)),
    statut: options?.statut ?? "affectee",
    priorite: options?.priorite ?? "p3",
    creneau_debut: options?.creneau_debut ?? null,
  };
}

function jourSuivant(jour: JourLocal, pas: number): JourLocal {
  const date = new Date(Date.UTC(jour.annee, jour.mois - 1, jour.jour + pas));
  return {
    annee: date.getUTCFullYear(),
    mois: date.getUTCMonth() + 1,
    jour: date.getUTCDate(),
  };
}

describe("repartirJourneeTechnicien — les bornes J, J+1, J+2, J+7, J+8 exclu", () => {
  it("une ligne datée d'aujourd'hui va dans « aujourd'hui »", () => {
    const resultat = repartirJourneeTechnicien(
      [ligne("j0", AUJOURDHUI)],
      [],
      AUJOURDHUI,
    );
    expect(resultat.aujourdHui.map((l) => l.id)).toEqual(["j0"]);
    expect(resultat.demain).toEqual([]);
    expect(resultat.suite.nombre).toBe(0);
  });

  it("une ligne datée de demain (J+1) va dans « demain », pas dans la suite", () => {
    const resultat = repartirJourneeTechnicien(
      [ligne("j1", jourSuivant(AUJOURDHUI, 1))],
      [],
      AUJOURDHUI,
    );
    expect(resultat.demain.map((l) => l.id)).toEqual(["j1"]);
    expect(resultat.suite.nombre).toBe(0);
  });

  it("une ligne datée de J+2 — le premier jour de « la suite »", () => {
    const resultat = repartirJourneeTechnicien(
      [ligne("j2", jourSuivant(AUJOURDHUI, 2))],
      [],
      AUJOURDHUI,
    );
    expect(resultat.demain).toEqual([]);
    expect(resultat.suite.nombre).toBe(1);
    expect(resultat.suite.dates).toEqual([jourSuivant(AUJOURDHUI, 2)]);
  });

  it("une ligne datée de J+7 — le dernier jour de « la suite »", () => {
    const resultat = repartirJourneeTechnicien(
      [ligne("j7", jourSuivant(AUJOURDHUI, 7))],
      [],
      AUJOURDHUI,
    );
    expect(resultat.suite.nombre).toBe(1);
    expect(resultat.suite.dates).toEqual([jourSuivant(AUJOURDHUI, 7)]);
  });

  it("une ligne datée de J+8 n'apparaît dans AUCUNE section — la borne est EXCLUSIVE, posée par l'appelant", () => {
    const resultat = repartirJourneeTechnicien(
      [ligne("j8", jourSuivant(AUJOURDHUI, 8))],
      [],
      AUJOURDHUI,
    );
    expect(resultat.aujourdHui).toEqual([]);
    expect(resultat.demain).toEqual([]);
    expect(resultat.suite.nombre).toBe(0);
    expect(resultat.sansDate).toEqual([]);
  });

  it("une ligne sans date rejoint « sans date », jamais une autre section", () => {
    const resultat = repartirJourneeTechnicien(
      [ligne("sd", null)],
      [],
      AUJOURDHUI,
    );
    expect(resultat.sansDate.map((l) => l.id)).toEqual(["sd"]);
    expect(resultat.aujourdHui).toEqual([]);
  });

  it("« les jours suivants » ne compte qu'une fois par JOUR CIVIL distinct, triés", () => {
    const resultat = repartirJourneeTechnicien(
      [
        ligne("a", jourSuivant(AUJOURDHUI, 5)),
        ligne("b", jourSuivant(AUJOURDHUI, 3)),
        ligne("c", jourSuivant(AUJOURDHUI, 3)),
      ],
      [],
      AUJOURDHUI,
    );
    expect(resultat.suite.nombre).toBe(3);
    expect(resultat.suite.dates).toEqual([
      jourSuivant(AUJOURDHUI, 3),
      jourSuivant(AUJOURDHUI, 5),
    ]);
  });

  it("« aujourd'hui » est triée par priorité puis par créneau (9L41-MA-JOURNEE-TRI-A-FAIRE)", () => {
    const resultat = repartirJourneeTechnicien(
      [
        ligne("tard_p3", AUJOURDHUI, {
          priorite: "p3",
          creneau_debut: new Date("2026-09-28T08:00:00Z"),
        }),
        ligne("tot_p1", AUJOURDHUI, {
          priorite: "p1",
          creneau_debut: new Date("2026-09-28T10:00:00Z"),
        }),
        ligne("tot_p3", AUJOURDHUI, {
          priorite: "p3",
          creneau_debut: new Date("2026-09-28T07:00:00Z"),
        }),
      ],
      [],
      AUJOURDHUI,
    );
    expect(resultat.aujourdHui.map((l) => l.id)).toEqual([
      "tot_p1",
      "tot_p3",
      "tard_p3",
    ]);
  });

  it("« aujourd'hui » : une ligne EN_COURS ou SUSPENDUE passe en tête, quelle que soit sa priorité", () => {
    const resultat = repartirJourneeTechnicien(
      [
        ligne("p1_affectee", AUJOURDHUI, { priorite: "p1" }),
        ligne("p4_suspendue", AUJOURDHUI, {
          priorite: "p4",
          statut: "suspendue",
        }),
        ligne("p3_en_cours", AUJOURDHUI, {
          priorite: "p3",
          statut: "en_cours",
        }),
      ],
      [],
      AUJOURDHUI,
    );
    expect(resultat.aujourdHui.map((l) => l.id)).toEqual([
      "p3_en_cours",
      "p4_suspendue",
      "p1_affectee",
    ]);
  });

  it("« en retard » passe tel quel, trié par date croissante — jamais refiltré ici", () => {
    const resultat = repartirJourneeTechnicien(
      [],
      [
        ligne("tard2", jourSuivant(AUJOURDHUI, -2)),
        ligne("tard1", jourSuivant(AUJOURDHUI, -5)),
      ],
      AUJOURDHUI,
    );
    expect(resultat.enRetard.map((l) => l.id)).toEqual(["tard1", "tard2"]);
  });
});

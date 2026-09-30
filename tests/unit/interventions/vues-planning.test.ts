import { describe, expect, it } from "vitest";

import type { JourLocal } from "@/lib/calendar/fuseau";
import { joursDeLaSemaine } from "@/lib/calendar/semaine";
import {
  joursDeLaVue,
  lignesAffichees,
  moisDecale,
  vueDepuisParametre,
  type Datable,
} from "@/lib/interventions/affichage";

/**
 * 9CI-PG-G12-DEUX-SEMAINES-MOIS, PARTIE 1 (PG-D2-DEUX-SEMAINES).
 *
 * Les quatre vues du planning se lisent depuis TROIS fonctions PURES, dans
 * `lib/interventions/affichage.ts` : `vueDepuisParametre` (quelle vue une URL
 * demande), `joursDeLaVue` (quels jours elle montre), `lignesAffichees`
 * (quelles lignes, inchangé pour « jour »/« semaine », étendu aux deux
 * nouvelles vues qui se lisent comme la Semaine).
 *
 * Ce fichier ne teste QUE « jour », « semaine » et « deux_semaines » — « mois »
 * arrive avec la partie 2 (PG-D3-MOIS-CHARGE), qui ajoute ses propres cas
 * ci-dessous plutôt que d'ouvrir un second fichier (§9, 01/09).
 */

describe('joursDeLaVue("mois") — PARTIE 2 (PG-D3-MOIS-CHARGE)', () => {
  it("rend TOUS les jours du mois, dimanches compris — 28 à 31 colonnes (spécification §3.8)", () => {
    expect(
      joursDeLaVue("mois", { annee: 2027, mois: 2, jour: 1 }),
    ).toHaveLength(28);
    expect(
      joursDeLaVue("mois", { annee: 2028, mois: 2, jour: 15 }),
    ).toHaveLength(29);
    expect(
      joursDeLaVue("mois", { annee: 2026, mois: 4, jour: 1 }),
    ).toHaveLength(30);
    expect(
      joursDeLaVue("mois", { annee: 2026, mois: 10, jour: 31 }),
    ).toHaveLength(31);
  });

  it("le premier et le dernier jour rendus sont le 1er et le dernier jour du mois", () => {
    const jours = joursDeLaVue("mois", { annee: 2026, mois: 10, jour: 17 });
    expect(jours[0]).toEqual({ annee: 2026, mois: 10, jour: 1 });
    expect(jours[jours.length - 1]).toEqual({
      annee: 2026,
      mois: 10,
      jour: 31,
    });
  });
});

describe("moisDecale — le déplacement d'un mois (PARTIE 2)", () => {
  it("le mois suivant, y compris un décalage d'année", () => {
    expect(moisDecale({ annee: 2027, mois: 1, jour: 31 }, 1)).toEqual({
      annee: 2027,
      mois: 2,
      jour: 1,
    });
    expect(moisDecale({ annee: 2026, mois: 12, jour: 15 }, 1)).toEqual({
      annee: 2027,
      mois: 1,
      jour: 1,
    });
  });

  it("le mois précédent, y compris un décalage d'année", () => {
    expect(moisDecale({ annee: 2027, mois: 1, jour: 15 }, -1)).toEqual({
      annee: 2026,
      mois: 12,
      jour: 1,
    });
  });

  it("rend toujours le 1er du mois, quel que soit le jour de départ", () => {
    expect(moisDecale({ annee: 2026, mois: 10, jour: 17 }, 0)).toEqual({
      annee: 2026,
      mois: 10,
      jour: 1,
    });
  });
});

const LUNDI: JourLocal = { annee: 2026, mois: 10, jour: 5 };

describe("vueDepuisParametre — une liste FERMÉE (L1-02f)", () => {
  it("reconnaît les quatre vues", () => {
    expect(vueDepuisParametre("jour")).toBe("jour");
    expect(vueDepuisParametre("semaine")).toBe("semaine");
    expect(vueDepuisParametre("deux_semaines")).toBe("deux_semaines");
    expect(vueDepuisParametre("mois")).toBe("mois");
  });

  it("toute autre valeur retombe sur « semaine »", () => {
    expect(vueDepuisParametre(undefined)).toBe("semaine");
    expect(vueDepuisParametre(["jour"])).toBe("semaine");
    expect(vueDepuisParametre("Mois")).toBe("semaine");
    expect(vueDepuisParametre("2s")).toBe("semaine");
  });
});

describe("joursDeLaVue — combien de jours, et lesquels", () => {
  it("« jour » ne rend QUE le jour demandé", () => {
    expect(joursDeLaVue("jour", LUNDI)).toEqual([LUNDI]);
  });

  it("« semaine » rend exactement ce que rendait déjà `joursDeLaSemaine(...).slice(0, 6)`", () => {
    expect(joursDeLaVue("semaine", LUNDI)).toEqual(
      joursDeLaSemaine(LUNDI).slice(0, 6),
    );
  });

  it("« semaine », cas ajouté : un passage d'année se comporte pareil", () => {
    const finDecembre: JourLocal = { annee: 2026, mois: 12, jour: 30 };
    expect(joursDeLaVue("semaine", finDecembre)).toEqual(
      joursDeLaSemaine(finDecembre).slice(0, 6),
    );
  });

  it("« deux_semaines » rend 12 jours, du lundi de la semaine au samedi de la suivante, sans les deux dimanches", () => {
    const jours = joursDeLaVue("deux_semaines", LUNDI);
    expect(jours).toHaveLength(12);
    const premiereSemaine = joursDeLaSemaine(LUNDI).slice(0, 6);
    const semaineSuivante = joursDeLaSemaine({
      annee: 2026,
      mois: 10,
      jour: 12,
    }).slice(0, 6);
    expect(jours).toEqual([...premiereSemaine, ...semaineSuivante]);
    // Aucun dimanche : sept jours ISO, deux sont exclus.
    expect(jours.some((j) => j.jour === 11)).toBe(false); // dimanche 11/10
    expect(jours.some((j) => j.jour === 18)).toBe(false); // dimanche 18/10
  });

  it("« deux_semaines » rend le même résultat quel que soit le jour ISO de départ", () => {
    // La Semaine part toujours du lundi qui contient `jour` ; « deux_semaines »
    // doit tenir la même invariance, sans quoi un lien forgé sur un jeudi
    // afficherait une fenêtre décalée.
    const jeudi: JourLocal = { annee: 2026, mois: 10, jour: 8 };
    expect(joursDeLaVue("deux_semaines", jeudi)).toEqual(
      joursDeLaVue("deux_semaines", LUNDI),
    );
  });
});

describe("lignesAffichees — les deux vues neuves se lisent comme la Semaine", () => {
  function ligne(date: string | null): Datable & { readonly nom: string } {
    return {
      date_planifiee: date === null ? null : new Date(`${date}T00:00:00.000Z`),
      nom: date ?? "en attente",
    };
  }

  const LIGNES = [
    ligne("2026-10-05"),
    ligne("2026-10-06"),
    ligne("2026-10-15"),
    ligne(null),
    ligne(null),
  ];

  it("« deux_semaines » garde toutes les posées, et AUCUNE de la file", () => {
    const vues = lignesAffichees(LIGNES, "deux_semaines", LUNDI);
    expect(vues).toHaveLength(3);
    expect(vues.every((l) => l.date_planifiee !== null)).toBe(true);
  });

  it("même partition que la Semaine", () => {
    expect(lignesAffichees(LIGNES, "deux_semaines", LUNDI)).toEqual(
      lignesAffichees(LIGNES, "semaine", LUNDI),
    );
  });
});

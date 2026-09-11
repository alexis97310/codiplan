import { describe, expect, it } from "vitest";

import type { Parametrage } from "@/lib/calendar/parametrage";
import { instantAMinutes, type JourLocal } from "@/lib/calendar/fuseau";
import {
  verdictChevauchement,
  verdictOuverture,
  type PoseDemandee,
  type Posee,
} from "@/lib/interventions/pose";

/*
 * R2-19 — LES CONTRÔLES À LA POSE.
 *
 * Deux règles tranchées par l'exploitation le 11/09/2026 :
 *   — un dépôt hors du calendrier de l'agence VISÉE est refusé ; l'union
 *     affichée en vue semaine est un repère, jamais un droit de poser ;
 *   — un dépôt qui chevauche une autre intervention du même technicien est
 *     refusé. Pour un exploitant, un chevauchement est une ERREUR.
 *
 * Ce module ne lit rien : les scénarios lui passent ce que le dépôt lui passe.
 * Que la BASE refuse aussi est éprouvé ailleurs — c'est le dépôt cloisonné qui
 * l'applique, et `tests/e2e/glisser-deposer.spec.ts` le traverse par l'écran.
 */

const FUSEAU = "Pacific/Noumea";

/** Lundi 14 septembre 2026 — un lundi réel, vérifié par `jourSemaineIso`. */
const LUNDI: JourLocal = { annee: 2026, mois: 9, jour: 14 };
const jour = (rang: number): JourLocal => ({ ...LUNDI, jour: 14 + rang });

/** Koné : du lundi au vendredi, 07:30–11:30 et 13:00–17:00. */
const KONE: Parametrage = {
  calendrierId: "cal-kone",
  code: "DEMO-KONE",
  libelle: "Koné",
  pasCreneauMinutes: 30,
  plages: [1, 2, 3, 4, 5].flatMap((jourSemaine) => [
    { jourSemaine, debutMinutes: 450, finMinutes: 690 },
    { jourSemaine, debutMinutes: 780, finMinutes: 1020 },
  ]),
};

const sansCreneau = (rang: number, technicienId = "t1"): PoseDemandee => ({
  datePlanifiee: jour(rang),
  creneauDebut: null,
  creneauFin: null,
  technicienId,
});

const avecCreneau = (
  rang: number,
  debutMinutes: number,
  dureeMin: number,
  technicienId = "t1",
): PoseDemandee => ({
  datePlanifiee: jour(rang),
  creneauDebut: instantAMinutes(jour(rang), debutMinutes, FUSEAU),
  creneauFin: instantAMinutes(jour(rang), debutMinutes + dureeMin, FUSEAU),
  technicienId,
});

describe("le calendrier de l'agence visée décide (R2-19)", () => {
  it("accepte un jour ouvert", () => {
    // Le cas qui doit rester VERT pour sa propre raison : sans lui, un verdict
    // qui refuserait toujours passerait tous les refus ci-dessous.
    expect(verdictOuverture(KONE, sansCreneau(1), FUSEAU).refuse).toBe(false);
  });

  it("REFUSE le samedi, que Koné ne travaille pas", () => {
    const verdict = verdictOuverture(KONE, sansCreneau(5), FUSEAU);
    expect(verdict).toEqual({
      refuse: true,
      cle: "intervention.refus.jour_ferme",
    });
  });

  it("REFUSE une agence sans calendrier — « inconnu » n'est pas « ouvert »", () => {
    // I7 : aucun calendrier global codé en dur. Poser sans horaire connu
    // promettrait un rendez-vous que personne ne peut tenir.
    expect(verdictOuverture(null, sansCreneau(1), FUSEAU)).toEqual({
      refuse: true,
      cle: "intervention.refus.agence_sans_calendrier",
    });
  });

  it("accepte une heure dans une plage, refuse une heure hors des plages", () => {
    expect(verdictOuverture(KONE, avecCreneau(1, 480, 60), FUSEAU).refuse).toBe(
      false,
    );
    // 12:00 : entre les deux plages, l'agence est fermée.
    expect(verdictOuverture(KONE, avecCreneau(1, 720, 60), FUSEAU)).toEqual({
      refuse: true,
      cle: "intervention.refus.hors_ouverture",
    });
  });

  it("laisse passer le RETRAIT du planning — on ne pose rien", () => {
    // Rendre une intervention à la file d'attente n'est pas une pose : aucun
    // calendrier n'a son mot à dire, pas même une agence qui n'en a pas.
    const retrait: PoseDemandee = {
      datePlanifiee: null,
      creneauDebut: null,
      creneauFin: null,
      technicienId: null,
    };
    expect(verdictOuverture(null, retrait, FUSEAU).refuse).toBe(false);
  });
});

describe("un chevauchement est une erreur, pas un avertissement (R2-19)", () => {
  const voisine = (
    id: string,
    debutMinutes: number,
    dureeMin: number,
    statut = "planifiee",
    technicienId: string | null = "t1",
  ): Posee => ({
    id,
    technicien_id: technicienId,
    creneau_debut: instantAMinutes(jour(1), debutMinutes, FUSEAU),
    creneau_fin: instantAMinutes(jour(1), debutMinutes + dureeMin, FUSEAU),
    statut,
  });

  it("REFUSE un créneau qui recouvre celui d'une autre", () => {
    const verdict = verdictChevauchement(
      [voisine("autre", 480, 120)],
      "celle-ci",
      avecCreneau(1, 540, 60),
    );
    expect(verdict).toEqual({
      refuse: true,
      cle: "intervention.refus.chevauchement",
    });
  });

  it("accepte deux créneaux qui se TOUCHENT sans se recouvrir", () => {
    // 08:00–10:00 puis 10:00–11:00 s'enchaînent. Refuser cela rendrait une
    // journée impossible à remplir.
    expect(
      verdictChevauchement(
        [voisine("autre", 480, 120)],
        "celle-ci",
        avecCreneau(1, 600, 60),
      ).refuse,
    ).toBe(false);
  });

  it("ne se chevauche pas ELLE-MÊME", () => {
    // Le cas qui rendrait tout déplacement impossible si on l'oubliait.
    expect(
      verdictChevauchement(
        [voisine("celle-ci", 480, 120)],
        "celle-ci",
        avecCreneau(1, 480, 120),
      ).refuse,
    ).toBe(false);
  });

  it("ignore une intervention ANNULÉE — elle n'occupe plus rien", () => {
    expect(
      verdictChevauchement(
        [voisine("autre", 480, 120, "annulee")],
        "celle-ci",
        avecCreneau(1, 540, 60),
      ).refuse,
    ).toBe(false);
  });

  it("compte une intervention CLÔTURÉE — elle a eu lieu", () => {
    // La symétrie du cas précédent, et c'est elle qu'on oublie : une journée de
    // 26 heures s'écrit en posant par-dessus ce qui a été fait.
    expect(
      verdictChevauchement(
        [voisine("autre", 480, 120, "cloturee")],
        "celle-ci",
        avecCreneau(1, 540, 60),
      ).refuse,
    ).toBe(true);
  });

  it("ignore une intervention d'UN AUTRE technicien", () => {
    expect(
      verdictChevauchement(
        [voisine("autre", 480, 120, "planifiee", "t2")],
        "celle-ci",
        avecCreneau(1, 540, 60),
      ).refuse,
    ).toBe(false);
  });

  it("ne calcule rien sans heure — deux dates nues ne sont pas un conflit", () => {
    expect(
      verdictChevauchement(
        [voisine("autre", 480, 120)],
        "celle-ci",
        sansCreneau(1),
      ).refuse,
    ).toBe(false);
  });
});

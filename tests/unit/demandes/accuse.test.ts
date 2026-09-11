import { describe, expect, it } from "vitest";

import { lireCleJour, versInstant, type Calendrier } from "@/lib/calendar";
import {
  departDuCompteur,
  etatAccuse,
  MINUTES_ACCUSE_RECEPTION,
} from "@/lib/demandes/accuse";

import { calendrierDeDemonstration } from "../calendar/calendriers-de-demonstration";

/**
 * L'ACCUSÉ DE RÉCEPTION SE MESURE EN HEURES OUVRÉES DE L'AGENCE (D13, L2-06).
 *
 * > *« Une demande déposée sur le portail un dimanche à 22 h déclenche son
 * > compteur à l'ouverture du lundi. L'audit avait raison de poser la question
 * > — la réponse inverse aurait généré des alertes toutes les nuits. »*
 *
 * C'est l'exemple de D13 lui-même qui sert de scénario : il est le seul où la
 * réponse naïve — compter depuis le dépôt — et la réponse juste diffèrent, et
 * l'écart se compte en heures, pas en minutes.
 */

const KONE = calendrierDeDemonstration("CODIMA-NC", "KONE");
const DUCOS = calendrierDeDemonstration("CODIMA-NC", "DUCOS");

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

describe("le départ du compteur (D13)", () => {
  it("la demande du dimanche 22 h déclenche son compteur à l'ouverture du lundi", () => {
    const depot = instantLocal(KONE, DIMANCHE_23, 22);
    const depart = departDuCompteur(KONE, depot);

    // Koné ouvre du lundi au vendredi. Le témoin est l'ÉCART : sans lui, un
    // départ égal au dépôt passerait pour une réponse.
    expect(depart.getTime()).toBeGreaterThan(depot.getTime());
    expect(depart).toEqual(instantLocal(KONE, LUNDI_24, 7, 30));
  });

  it("la demande déposée EN PLEINE OUVERTURE démarre son compteur tout de suite", () => {
    // Le cas qui doit rester vert POUR SA PROPRE RAISON (§9, 11/09) : sans lui,
    // une fonction qui repousserait TOUJOURS au lendemain passerait le premier
    // scénario.
    const depot = instantLocal(KONE, LUNDI_24, 9);
    expect(departDuCompteur(KONE, depot)).toEqual(depot);
  });

  it("le SAMEDI sépare les deux agences — le calendrier lu n'est pas décoratif", () => {
    // Ducos ouvre le samedi matin, Koné non. Le même dépôt donne deux départs
    // différents : c'est ce qui prouve que la fonction lit le calendrier reçu
    // et non une règle écrite en dur.
    const depot = instantLocal(DUCOS, SAMEDI_22, 8);
    expect(departDuCompteur(DUCOS, depot)).toEqual(depot);
    expect(departDuCompteur(KONE, depot)).not.toEqual(depot);
  });
});

describe("l'état de l'accusé — TROIS états, jamais un booléen", () => {
  const depart = instantLocal(KONE, LUNDI_24, 7, 30);

  it("répondu dans le standard", () => {
    const etat = etatAccuse(KONE, {
      compteurDepart: depart,
      accuseLe: instantLocal(KONE, LUNDI_24, 7, 50),
      maintenant: instantLocal(KONE, LUNDI_24, 12),
    });
    expect(etat).toEqual({
      etat: "repondu",
      minutesOuvrees: 20,
      dansLeStandard: true,
    });
  });

  it("répondu HORS standard — et le décompte est en minutes OUVRÉES", () => {
    // La réponse arrive le lendemain 8 h. En minutes d'horloge, c'est plus de
    // 24 heures ; en minutes ouvrées de Koné, c'est la fin du lundi plus une
    // demi-heure du mardi. Les deux nombres sont très différents, et c'est le
    // second qui décide.
    const etat = etatAccuse(KONE, {
      compteurDepart: depart,
      accuseLe: instantLocal(KONE, "2026-08-25", 8),
      maintenant: instantLocal(KONE, "2026-08-25", 12),
    });
    expect(etat.etat).toBe("repondu");
    expect(etat.minutesOuvrees).toBeGreaterThan(MINUTES_ACCUSE_RECEPTION);
    expect(etat).toMatchObject({ dansLeStandard: false });
  });

  it("SANS RÉPONSE et encore dans les temps n'est NI tenu NI manqué", () => {
    // C'est la troisième réponse, celle qu'un booléen écrase. Une demande
    // déposée il y a dix minutes et sans accusé n'est pas « hors standard » :
    // elle est en cours (doctrine §3 — une absence d'information ne s'affiche
    // jamais comme une réponse négative).
    const etat = etatAccuse(KONE, {
      compteurDepart: depart,
      accuseLe: null,
      maintenant: instantLocal(KONE, LUNDI_24, 7, 40),
    });
    expect(etat).toEqual({
      etat: "sans_reponse",
      minutesOuvrees: 10,
      depasse: false,
    });
  });

  it("SANS RÉPONSE et déjà dépassé se dit, et reste « sans réponse »", () => {
    const etat = etatAccuse(KONE, {
      compteurDepart: depart,
      accuseLe: null,
      maintenant: instantLocal(KONE, LUNDI_24, 9),
    });
    expect(etat).toEqual({
      etat: "sans_reponse",
      minutesOuvrees: 90,
      depasse: true,
    });
  });

  it("la nuit ne consomme rien : le compteur dort avec l'agence", () => {
    // Sans cette mesure, une demande déposée un vendredi soir serait déclarée
    // « dépassée » le samedi matin, et l'alerte du chapitre 16.1 sonnerait
    // toutes les nuits — c'est l'alerte que D13 dit avoir voulu éviter.
    const etat = etatAccuse(KONE, {
      compteurDepart: depart,
      accuseLe: null,
      maintenant: instantLocal(KONE, LUNDI_24, 7, 35),
    });
    expect(etat.minutesOuvrees).toBe(5);

    const apresLaFermeture = etatAccuse(KONE, {
      compteurDepart: instantLocal(KONE, LUNDI_24, 16, 55),
      accuseLe: null,
      maintenant: instantLocal(KONE, "2026-08-25", 7, 35),
    });
    // 5 minutes le lundi avant la fermeture, 5 minutes le mardi après
    // l'ouverture. La nuit, qui dure quinze heures d'horloge, ne compte pas.
    expect(apresLaFermeture.minutesOuvrees).toBe(10);
  });
});

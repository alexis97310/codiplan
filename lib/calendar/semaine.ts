import { cleJour, jourSuivant, type JourLocal } from "./fuseau";

/**
 * Semaines ISO 8601 (ticket L0-08, point 5).
 *
 * **La semaine commence le lundi**, et la semaine n°1 d'une année est celle qui
 * contient son premier jeudi. Ces deux règles vont ensemble : la seconde est ce
 * qui rend la première cohérente au passage d'une année à l'autre — le
 * 1ᵉʳ janvier 2027 est un vendredi, il appartient donc à la semaine 53 de 2026,
 * et un indicateur hebdomadaire qui l'attribuerait à 2027 compterait une semaine
 * de deux jours.
 *
 * Tout se calcule sur des JOURS LOCAUX, jamais sur des instants : « la semaine
 * du 17 août » n'a pas de fuseau, c'est la lecture d'un calendrier mural. Le
 * passage de l'instant au jour local est déjà fait, et il a nommé son fuseau.
 */

/** Lundi. Les jours ISO vont de 1 (lundi) à 7 (dimanche). */
export const LUNDI = 1;

/** Samedi — Ducos ouvre, Koné non (RG-PLA-01). */
export const SAMEDI = 6;

/** Dimanche, dernier jour de la semaine ISO. */
export const DIMANCHE = 7;

/** Schéma de contrôle d'un jour de semaine ISO. */
export function estJourSemaineIso(valeur: number): boolean {
  return Number.isInteger(valeur) && valeur >= LUNDI && valeur <= DIMANCHE;
}

/**
 * Jour de la semaine ISO d'un jour local : 1 pour lundi, 7 pour dimanche.
 *
 * Passe par une date UTC, jamais par `getDay()` : cet accesseur lirait le
 * fuseau de l'appareil, et le planning d'un technicien en déplacement
 * changerait de jour au passage de la ligne de changement de date.
 */
export function jourSemaineIso(jour: JourLocal): number {
  const date = new Date(0);
  date.setUTCFullYear(jour.annee, jour.mois - 1, jour.jour);
  const dimancheZero = date.getUTCDay();
  return dimancheZero === 0 ? DIMANCHE : dimancheZero;
}

/** Le lundi de la semaine ISO à laquelle ce jour appartient. */
export function lundiDeLaSemaine(jour: JourLocal): JourLocal {
  return jourSuivant(jour, LUNDI - jourSemaineIso(jour));
}

/** Nombre de jours entre deux jours locaux — `b - a`, en jours entiers. */
export function ecartEnJours(a: JourLocal, b: JourLocal): number {
  const depart = new Date(0);
  depart.setUTCFullYear(a.annee, a.mois - 1, a.jour);
  const arrivee = new Date(0);
  arrivee.setUTCFullYear(b.annee, b.mois - 1, b.jour);
  return Math.round(
    (arrivee.getTime() - depart.getTime()) / (24 * 60 * 60 * 1000),
  );
}

/**
 * Numéro et année ISO d'un jour local.
 *
 * L'année ISO n'est pas toujours l'année civile : les derniers jours de
 * décembre peuvent appartenir à la semaine 1 de l'année suivante, et les
 * premiers jours de janvier à la semaine 52 ou 53 de la précédente. C'est
 * exactement pourquoi le couple est rendu ensemble — rendre le seul numéro
 * inviterait à le recoller à la mauvaise année.
 */
export function semaineIso(jour: JourLocal): {
  annee: number;
  semaine: number;
} {
  // Le jeudi de la semaine porte l'année ISO, par construction de la norme.
  const jeudi = jourSuivant(lundiDeLaSemaine(jour), 3);
  const premierJanvier: JourLocal = { annee: jeudi.annee, mois: 1, jour: 1 };
  const semaine = Math.floor(ecartEnJours(premierJanvier, jeudi) / 7) + 1;
  return { annee: jeudi.annee, semaine };
}

/** Les sept jours de la semaine ISO contenant ce jour, du lundi au dimanche. */
export function joursDeLaSemaine(jour: JourLocal): JourLocal[] {
  const lundi = lundiDeLaSemaine(jour);
  return Array.from({ length: 7 }, (_, index) => jourSuivant(lundi, index));
}

/** Deux jours locaux désignent-ils le même jour ? */
export function memeJour(a: JourLocal, b: JourLocal): boolean {
  return cleJour(a) === cleJour(b);
}

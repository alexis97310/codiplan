import {
  cleJour,
  comparerJours,
  jourSuivant,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import { memeJour } from "@/lib/calendar/semaine";

import { jourCivilDeDatePlanifiee } from "./retard";

/** La ligne minimale dont la répartition a besoin. */
type LigneDatee = {
  readonly date_planifiee: Date | null;
};

export type RepartitionJournee<T> = {
  readonly enRetard: readonly T[];
  readonly aujourdHui: readonly T[];
  readonly demain: readonly T[];
  readonly suite: {
    readonly nombre: number;
    readonly dates: readonly JourLocal[];
  };
  readonly sansDate: readonly T[];
};

/**
 * LA JOURNÉE DU TECHNICIEN, RÉPARTIE PAR JOUR CIVIL (9F2-TERRAIN-JOURS-
 * MAQUETTE, décision d'Alexis n° 92 du 13/10/2026 ; D210).
 *
 * `lignes` porte tout ce qui est visible et daté d'AUJOURD'HUI à J+7 (la borne
 * est posée par l'appelant, via `listerPlanning`), ou sans date. `retard`
 * porte SÉPARÉMENT les lignes en retard — l'appelant les a déjà lues par
 * `interventionsEnRetard` : cette fonction ne les filtre pas une seconde
 * fois, elle les trie seulement par date (§9, 01/09 : une seule lecture du
 * critère « en retard »).
 *
 * **« Les jours suivants » ne porte que des DATES, jamais des lignes** — la
 * carte n'affiche qu'un compte et des jours distincts triés, sans lien : la
 * page Profil n'affiche aucune intervention, et un lien qui n'y menait à rien
 * serait une impasse (écart nommé à la maquette, voir `docs/arbitrages.md`).
 */
export function repartirJourneeTechnicien<T extends LigneDatee>(
  lignes: readonly T[],
  retard: readonly T[],
  aujourdHui: JourLocal,
): RepartitionJournee<T> {
  const demainJour = jourSuivant(aujourdHui);
  const suiteDebut = jourSuivant(aujourdHui, 2);
  const suiteFin = jourSuivant(aujourdHui, 7);

  const aujourdHuiLignes: T[] = [];
  const demainLignes: T[] = [];
  const suiteLignes: T[] = [];
  const sansDateLignes: T[] = [];

  for (const ligne of lignes) {
    if (ligne.date_planifiee === null) {
      sansDateLignes.push(ligne);
      continue;
    }
    const jourCivil = jourCivilDeDatePlanifiee(ligne.date_planifiee);
    if (memeJour(jourCivil, aujourdHui)) {
      aujourdHuiLignes.push(ligne);
    } else if (memeJour(jourCivil, demainJour)) {
      demainLignes.push(ligne);
    } else if (
      comparerJours(jourCivil, suiteDebut) >= 0 &&
      comparerJours(jourCivil, suiteFin) <= 0
    ) {
      suiteLignes.push(ligne);
    }
  }

  const datesSuite: JourLocal[] = [];
  const clesVues = new Set<string>();
  for (const ligne of suiteLignes) {
    // `date_planifiee` n'est jamais nul ici : `suiteLignes` ne reçoit que des
    // lignes passées par la branche `jourCivilDeDatePlanifiee` ci-dessus.
    const jourCivil = jourCivilDeDatePlanifiee(ligne.date_planifiee as Date);
    const cle = cleJour(jourCivil);
    if (!clesVues.has(cle)) {
      clesVues.add(cle);
      datesSuite.push(jourCivil);
    }
  }
  datesSuite.sort(comparerJours);

  const enRetardTriee = [...retard].sort(
    (a, b) =>
      (a.date_planifiee?.getTime() ?? 0) - (b.date_planifiee?.getTime() ?? 0),
  );

  return {
    enRetard: enRetardTriee,
    aujourdHui: aujourdHuiLignes,
    demain: demainLignes,
    suite: { nombre: suiteLignes.length, dates: datesSuite },
    sansDate: sansDateLignes,
  };
}

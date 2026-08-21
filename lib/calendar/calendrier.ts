import { z } from "zod";

import {
  cleJour,
  lireCleJour,
  lireFuseau,
  MINUTES_PAR_JOUR,
  type Fuseau,
  type JourLocal,
} from "./fuseau";
import { estJourSemaineIso } from "./semaine";

/**
 * Le calendrier d'ouverture d'une AGENCE, tel que le module le manipule
 * (ticket L0-08, invariant I7, arbitrages D5 et D13).
 *
 * **Agence, jamais site.** Une agence est un établissement CODIMA — Ducos,
 * Koné, Dolbeau ; un site est un lieu d'intervention chez un client. Le
 * cahier des charges v1.2 confondait les deux (RG-PLA-01 dit encore « site ») ;
 * D5 tranche et impose le vocabulaire. Les horaires d'un SITE client existent
 * eux aussi, mais ils ne servent qu'à un avertissement (D13), jamais à un
 * blocage — voir `usages.ts`.
 *
 * **Aucun calendrier global codé en dur** (I7) : ce type ne porte aucune valeur
 * par défaut. Un calendrier vide est un calendrier fermé toute la semaine, ce
 * qui se voit immédiatement, plutôt qu'un calendrier « du lundi au vendredi »
 * qui aurait l'air juste à Koné et faux à Ducos.
 */

/**
 * Une plage d'ouverture hebdomadaire — la forme d'une ligne de
 * `calendrier_plage`. C'est une récurrence : la règle est locale, le fuseau
 * vient du calendrier, et rien n'est figé en UTC (point 3 du ticket).
 *
 * Plusieurs plages par jour sont admises : la coupure de midi en est une, et
 * une agence qui ferme entre 11 h 30 et 13 h 30 n'est pas ouverte à midi.
 */
export type PlageOuverture = {
  /** Jour ISO — 1 lundi, 7 dimanche. */
  jour_semaine: number;
  /** Ouverture, en minutes locales depuis minuit. */
  debut_minutes: number;
  /** Fermeture, en minutes locales depuis minuit. Strictement après le début. */
  fin_minutes: number;
};

/**
 * Un jour férié tel qu'il s'applique à UN calendrier : la date et le libellé
 * viennent du référentiel territorial `jour_ferie` (D46), le booléen
 * `travaille` de la surcharge par agence `calendrier_ferie` (D13, RG-PLA-02).
 *
 * `travaille` vaut `true` quand l'agence travaille ce jour-là : le férié cesse
 * alors de retrancher quoi que ce soit, et les plages d'ouverture du jour
 * s'appliquent normalement. Un férié n'est pas systématiquement chômé.
 */
export type FerieApplique = {
  /** Date locale `AAAA-MM-JJ` — un férié est un jour, pas un instant. */
  date: string;
  libelle: string;
  travaille: boolean;
};

/** Un calendrier résolu : de quoi répondre à « quand », et rien de plus. */
export type Calendrier = {
  /** Code du calendrier — sert aux messages d'erreur, jamais à une règle. */
  code: string;
  /** Fuseau de l'agence, hérité de la société si elle ne le surcharge pas (D5). */
  fuseau: Fuseau;
  /** Territoire dont les fériés s'appliquent — clé de `jour_ferie` (D46). */
  territoire: string;
  plages: readonly PlageOuverture[];
  feries: readonly FerieApplique[];
};

const schemaPlage = z
  .object({
    jour_semaine: z.number().refine(estJourSemaineIso, {
      message: "jour de semaine ISO attendu — 1 pour lundi, 7 pour dimanche",
    }),
    debut_minutes: z.number().int().min(0).max(MINUTES_PAR_JOUR),
    fin_minutes: z.number().int().min(0).max(MINUTES_PAR_JOUR),
  })
  .refine((plage) => plage.fin_minutes > plage.debut_minutes, {
    message: "une plage d'ouverture se ferme après s'être ouverte",
  });

const schemaFerie = z.object({
  date: z.string().refine((valeur) => {
    try {
      lireCleJour(valeur);
      return true;
    } catch {
      return false;
    }
  }, "date locale AAAA-MM-JJ attendue"),
  libelle: z.string().min(1),
  travaille: z.boolean(),
});

/** Schéma d'un calendrier (CLAUDE.md §2 — Zod sur toute entrée). */
export const schemaCalendrier = z.object({
  code: z.string().min(1),
  fuseau: z.unknown().transform((valeur) => lireFuseau(valeur)),
  territoire: z.string().min(1),
  plages: z.array(schemaPlage),
  feries: z.array(schemaFerie),
});

/**
 * Construit un calendrier depuis un enregistrement quelconque — typiquement
 * des lignes Prisma recomposées. Toute entrée non conforme échoue ici, pas
 * trois appels plus loin dans un planning faux.
 */
export function lireCalendrier(enregistrement: unknown): Calendrier {
  return schemaCalendrier.parse(enregistrement);
}

/** Plages déclarées pour ce jour de la semaine, triées par heure d'ouverture. */
export function plagesDuJourSemaine(
  calendrier: Calendrier,
  jourSemaine: number,
): PlageOuverture[] {
  return calendrier.plages
    .filter((plage) => plage.jour_semaine === jourSemaine)
    .sort((a, b) => a.debut_minutes - b.debut_minutes);
}

/** Le férié qui tombe ce jour-là, s'il y en a un. */
export function ferieDuJour(
  calendrier: Calendrier,
  jour: JourLocal,
): FerieApplique | null {
  const cle = cleJour(jour);
  return calendrier.feries.find((ferie) => ferie.date === cle) ?? null;
}

/**
 * Ce jour est-il chômé ? Un férié ne l'est que s'il n'est PAS travaillé
 * (RG-PLA-02) : « les jours fériés peuvent être travaillés — un férié n'est pas
 * systématiquement chômé ».
 */
export function estChome(calendrier: Calendrier, jour: JourLocal): boolean {
  const ferie = ferieDuJour(calendrier, jour);
  return ferie !== null && !ferie.travaille;
}

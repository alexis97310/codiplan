import { z } from "zod";

import {
  comparerJours,
  instantAMinutes,
  jourDe,
  jourSuivant,
  lireFuseau,
  versLocal,
  MINUTES_PAR_JOUR,
  type Fuseau,
  type JourLocal,
} from "./fuseau";
import { estJourSemaineIso, jourSemaineIso } from "./semaine";

/**
 * Récurrences (ticket L0-08, point 3).
 *
 * **Une récurrence ne se stocke pas en instants UTC.** « Tous les lundis à
 * 8 h » n'a pas de décalage constant : Nouméa ne change pas d'heure, Paris si.
 * Une occurrence figée en UTC au moment de la création se décalerait d'une
 * heure deux fois par an — le créneau parisien de 8 h deviendrait 7 h fin
 * octobre, et personne ne s'en apercevrait avant que le client n'ouvre sa
 * porte à la mauvaise heure.
 *
 * Ce qui est donc stocké, c'est la **règle locale et son fuseau** :
 * « lundi, 480 minutes après minuit, 240 minutes, `Europe/Paris` ». Les
 * occurrences se **déroulent à la lecture**, et le décalage est recalculé
 * pour chacune. C'est cette forme que porte `calendrier_plage` en base : une
 * plage d'ouverture EST une récurrence hebdomadaire, et le fuseau lui vient de
 * l'agence.
 *
 * Le module ne connaît que le « quand ». Ni durée facturable, ni arrondi au
 * quart d'heure : ceux-là appartiennent à la valorisation (D45, L2-09).
 */

/**
 * Règle locale hebdomadaire. Les minutes sont comptées depuis minuit local, et
 * peuvent dépasser une journée à l'arrivée : un créneau de nuit se termine le
 * lendemain, ce que `fin_minutes > MINUTES_PAR_JOUR` exprime sans ambiguïté.
 */
export type RegleHebdomadaire = {
  /** Jour ISO — 1 lundi, 7 dimanche. */
  jour_semaine: number;
  /** Début, en minutes locales depuis minuit. */
  debut_minutes: number;
  /** Durée en minutes. Strictement positive. */
  duree_minutes: number;
};

/** Une règle et le fuseau qui lui donne un sens. Les deux sont indissociables. */
export type Recurrence = {
  regle: RegleHebdomadaire;
  fuseau: Fuseau;
};

/** Un créneau déroulé : deux instants, donc deux points sur l'échelle UTC. */
export type Creneau = {
  debut: Date;
  fin: Date;
};

/** Schéma de la règle locale (CLAUDE.md §2 — Zod sur toute entrée). */
export const schemaRegleHebdomadaire = z.object({
  jour_semaine: z.number().refine(estJourSemaineIso, {
    message: "jour de semaine ISO attendu — 1 pour lundi, 7 pour dimanche",
  }),
  debut_minutes: z
    .number()
    .int()
    .min(0)
    .max(MINUTES_PAR_JOUR - 1),
  duree_minutes: z.number().int().positive().max(MINUTES_PAR_JOUR),
});

/**
 * Borne de sécurité du déroulement. Une règle hebdomadaire produit au plus une
 * occurrence par semaine ; dix ans en donnent moins de six cents. Au-delà,
 * c'est un intervalle aberrant, et une boucle silencieuse vaut moins qu'un
 * refus explicite.
 */
const OCCURRENCES_MAXIMUM = 1024;

/** Valide une règle locale et la retourne. */
export function lireRegleHebdomadaire(valeur: unknown): RegleHebdomadaire {
  return schemaRegleHebdomadaire.parse(valeur);
}

/** Valide une récurrence complète — la règle ET son fuseau. */
export function lireRecurrence(valeur: unknown): Recurrence {
  const brut = z
    .object({ regle: z.unknown(), fuseau: z.unknown() })
    .parse(valeur);
  return {
    regle: lireRegleHebdomadaire(brut.regle),
    fuseau: lireFuseau(brut.fuseau),
  };
}

/**
 * Instant de début d'une occurrence posée sur un jour local donné.
 *
 * Exportée parce que les plages d'ouverture s'en servent jour par jour : c'est
 * le geste élémentaire « cette heure locale, ce jour-là, dans ce fuseau ».
 */
export function occurrenceDuJour(
  jour: JourLocal,
  regle: RegleHebdomadaire,
  fuseau: Fuseau,
): Creneau {
  return {
    debut: instantAMinutes(jour, regle.debut_minutes, fuseau),
    fin: instantAMinutes(
      jour,
      regle.debut_minutes + regle.duree_minutes,
      fuseau,
    ),
  };
}

/**
 * Déroule les occurrences d'une récurrence sur un intervalle d'instants.
 *
 * Le parcours se fait en jours LOCAUX — jamais en ajoutant 7 × 24 h à un
 * instant. C'est toute la différence : à Paris, deux lundis consécutifs à 8 h
 * sont séparés de 167 ou 169 heures les semaines de changement d'heure, jamais
 * de 168. Un déroulement par addition d'instants produirait un créneau à 7 h ou
 * à 9 h ; celui-ci reprojette l'heure locale chaque semaine.
 *
 * Sont retenues les occurrences qui **chevauchent** l'intervalle, bornes
 * comprises à gauche et exclues à droite.
 */
export function deroulerOccurrences(
  recurrence: Recurrence,
  intervalle: Creneau,
): Creneau[] {
  const { regle, fuseau } = recurrence;

  if (intervalle.fin.getTime() < intervalle.debut.getTime()) {
    throw new Error(
      "Intervalle de déroulement inversé : la fin précède le début.",
    );
  }

  const occurrences: Creneau[] = [];
  // La veille du premier jour local : une occurrence commencée la veille peut
  // déborder sur l'intervalle (créneau de nuit).
  let jour = jourSuivant(jourDe(versLocal(intervalle.debut, fuseau)), -1);
  const dernier = jourDe(versLocal(intervalle.fin, fuseau));

  for (let garde = 0; ; garde += 1) {
    if (garde > OCCURRENCES_MAXIMUM) {
      throw new Error(
        `Déroulement interrompu au-delà de ${OCCURRENCES_MAXIMUM} jours : ` +
          "l'intervalle demandé est hors de proportion avec une récurrence " +
          "hebdomadaire.",
      );
    }

    if (jourSemaineIso(jour) === regle.jour_semaine) {
      const creneau = occurrenceDuJour(jour, regle, fuseau);
      const chevauche =
        creneau.fin.getTime() > intervalle.debut.getTime() &&
        creneau.debut.getTime() < intervalle.fin.getTime();
      if (chevauche) {
        occurrences.push(creneau);
      }
    }

    if (comparerJours(jour, dernier) >= 0) {
      break;
    }
    jour = jourSuivant(jour);
  }

  return occurrences;
}

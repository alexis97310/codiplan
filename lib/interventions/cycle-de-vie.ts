import type { StatutIntervention } from "./saisie";

/**
 * LE CYCLE DE VIE D'UNE INTERVENTION — ce qui est permis, et ce qui est REFUSÉ
 * avec sa raison écrite (lot 2, D84 ; I5 pour la préséance).
 *
 * ## Ce module ne garde rien — il EXPLIQUE
 *
 * La garantie est en base : `intervention_cycle_de_vie` refuse en PostgreSQL
 * ce que ce module refuse en TypeScript. *Une action refusée à l'écran mais
 * acceptée par la base est un trou*, et c'est le déclencheur qui ferme le trou.
 *
 * Alors pourquoi ce module ? Parce qu'un refus de base est un message technique
 * arrivé trop tard, et que **le refus doit s'afficher à la place de l'action,
 * avec sa raison** — pas après coup dans une bannière rouge. Les deux disent la
 * même chose ; celui-ci le dit AVANT, celui-là le dit QUOI QU'IL ARRIVE.
 *
 * *Deux lectures d'un même critère divergent en silence (§9, 01/09).* Ce qui
 * les confronte ici est un scénario d'isolation : pour chaque transition que ce
 * module refuse, la base est sollicitée et doit refuser aussi.
 */

/** Un refus, avec la clé de dictionnaire qui l'explique à l'écran. */
export type Refus = {
  readonly refuse: true;
  /** Clé de `lib/i18n/fr.ts` — jamais une phrase en dur (CLAUDE.md §5). */
  readonly cle: string;
};

/** Une action permise. */
export type Permis = { readonly refuse: false };

export type Verdict = Refus | Permis;

const PERMIS: Permis = { refuse: false };

/**
 * Les statuts TERMINAUX au sens de la modification : plus rien ne se change,
 * hors la seule sortie que I5 laisse ouverte.
 *
 * `cloturee` n'est pas tout à fait terminal — I5 donne à `annulee` la préséance
 * sur `cloturee`, et l'annulation d'une intervention déjà clôturée reste donc
 * possible. `annulee`, lui, l'est : rien n'a préséance sur lui.
 */
export function estFige(statut: StatutIntervention): boolean {
  return statut === "annulee" || statut === "cloturee";
}

/** Peut-on DÉPLACER cette intervention — créneau ou technicien ? */
export function peutDeplacer(statut: StatutIntervention): Verdict {
  if (statut === "annulee") {
    return { refuse: true, cle: "intervention.refus.annulee_figee" };
  }
  if (statut === "cloturee") {
    return { refuse: true, cle: "intervention.refus.cloturee_figee" };
  }
  return PERMIS;
}

/** Peut-on AFFECTER un technicien ? Mêmes bornes que le déplacement. */
export function peutAffecter(statut: StatutIntervention): Verdict {
  return peutDeplacer(statut);
}

/**
 * Peut-on CLÔTURER ? Deux conditions, et la seconde est celle qu'on oublie.
 *
 * Le temps réel est exigé ici comme il l'est en base : sous D83, clôturer sans
 * temps facturerait le plancher d'une heure sur un temps que personne n'a
 * mesuré.
 */
export function peutCloturer(
  statut: StatutIntervention,
  tempsReelMin: number | null,
): Verdict {
  if (statut === "annulee") {
    return { refuse: true, cle: "intervention.refus.annulee_figee" };
  }
  if (statut === "cloturee") {
    return { refuse: true, cle: "intervention.refus.deja_cloturee" };
  }
  if (tempsReelMin === null || tempsReelMin <= 0) {
    return { refuse: true, cle: "intervention.refus.temps_manquant" };
  }
  return PERMIS;
}

/**
 * Peut-on ANNULER ? Presque toujours — et c'est I5 qui le veut.
 *
 * `ANNULEE` a la préséance sur tout, y compris sur `CLOTUREE` : une
 * intervention clôturée par erreur doit pouvoir être annulée, sinon la
 * préséance de I5 serait vraie dans la synchronisation et fausse à l'écran.
 * Le seul refus est l'annulation de ce qui est déjà annulé.
 */
export function peutAnnuler(statut: StatutIntervention): Verdict {
  if (statut === "annulee") {
    return { refuse: true, cle: "intervention.refus.deja_annulee" };
  }
  return PERMIS;
}

/**
 * Le statut qu'une création prend, DÉDUIT du créneau et jamais saisi.
 *
 * Sans créneau, l'intervention entre dans la file d'attente — c'est la ligne
 * « À planifier / Gris / File d'attente » de l'annexe D.
 */
export function statutALaCreation(
  creneauDebut: Date | null,
): StatutIntervention {
  return creneauDebut === null ? "a_planifier" : "planifiee";
}

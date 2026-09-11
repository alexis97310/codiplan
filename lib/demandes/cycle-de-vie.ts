import type { StatutDemande } from "./saisie";

/**
 * LE CYCLE DE VIE D'UNE DEMANDE — ce qui est permis, et ce qui est REFUSÉ avec
 * sa raison écrite (lot 2, L2-06).
 *
 * ## Ce module ne garde rien — il EXPLIQUE
 *
 * La garantie est en base : le déclencheur `demande_cycle_de_vie` refuse en
 * PostgreSQL ce que ce module refuse en TypeScript. *Une action refusée à
 * l'écran mais acceptée par la base est un trou*, et c'est le déclencheur qui
 * ferme le trou. Ce module le dit AVANT, celui-là le dit QUOI QU'IL ARRIVE, et
 * un scénario d'isolation les confronte — deux lectures d'un même critère
 * divergent en silence (§9, 01/09).
 *
 * ## Les deux fins ne se ressemblent pas
 *
 * Une demande **devient une intervention** — et c'est l'intervention qui vit
 * ensuite son propre cycle, avec sa propre annulation. Ou elle est **close sans
 * suite**, et *cette information est conservée : elle mesure le service rendu à
 * distance* (chapitre 7/M3). Les deux sont terminales, pour deux raisons
 * distinctes, et aucune ne se rouvre.
 *
 * **Ce qui n'est PAS écrit ici**, et qui se voit à l'absence : rien ne fait
 * repasser une demande à `nouvelle`. *Ce qui a été qualifié l'a été* — et une
 * demande qu'on remettrait dans la file d'attente effacerait la trace du temps
 * déjà consommé sur elle.
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
 * Les statuts qui ne changent plus. `transformee` et `close_sans_suite` le
 * sont toutes deux — mais pas pour la même raison, et les messages de refus le
 * disent chacun à sa manière plutôt que de partager une phrase creuse.
 */
export function estFige(statut: StatutDemande): boolean {
  return statut === "transformee" || statut === "close_sans_suite";
}

function refusDeFige(statut: StatutDemande): Refus | null {
  if (statut === "transformee") {
    return { refuse: true, cle: "demande.refus.deja_transformee" };
  }
  if (statut === "close_sans_suite") {
    return { refuse: true, cle: "demande.refus.deja_close" };
  }
  return null;
}

/** Peut-on QUALIFIER cette demande ? */
export function peutQualifier(statut: StatutDemande): Verdict {
  const fige = refusDeFige(statut);
  if (fige !== null) {
    return fige;
  }
  if (statut === "qualifiee") {
    return { refuse: true, cle: "demande.refus.deja_qualifiee" };
  }
  return PERMIS;
}

/**
 * Peut-on TRANSFORMER cette demande en intervention ?
 *
 * Depuis `qualifiee` et depuis elle seule : *la qualification est ce qui décide
 * du type, de la durée estimée, des compétences requises, du mode de
 * valorisation et de l'affectation* (chapitre 7/M3). Transformer une demande
 * `nouvelle` créerait une intervention dont personne n'a décidé la nature.
 */
export function peutTransformer(statut: StatutDemande): Verdict {
  const fige = refusDeFige(statut);
  if (fige !== null) {
    return fige;
  }
  if (statut !== "qualifiee") {
    return { refuse: true, cle: "demande.refus.transformer_sans_qualifier" };
  }
  return PERMIS;
}

/**
 * Peut-on CLORE SANS SUITE ?
 *
 * Depuis `nouvelle` comme depuis `qualifiee` : *« Une demande peut être close
 * sans intervention — résolue par téléphone, hors périmètre, refus client »*
 * (chapitre 7/M3), et rien n'exige d'avoir qualifié pour constater qu'on a
 * résolu au téléphone. Une demande déjà **transformée** ne se clôt pas : c'est
 * l'intervention née d'elle qui s'annule, et fermer la demande par-dessus
 * laisserait deux objets dire deux choses.
 */
export function peutCloreSansSuite(statut: StatutDemande): Verdict {
  const fige = refusDeFige(statut);
  if (fige !== null) {
    return fige;
  }
  return PERMIS;
}

/**
 * Peut-on ACCUSER RÉCEPTION ?
 *
 * Tant que la demande n'est pas figée, et **une seule fois**. Le second accusé
 * n'est pas refusé par prudence : l'horodatage mesure le standard des 30
 * minutes (D13), et le réécrire transformerait un délai dépassé en délai tenu
 * — *une mesure qu'on peut repousser ne mesure plus rien.*
 */
export function peutAccuser(
  statut: StatutDemande,
  accuseLe: Date | null,
): Verdict {
  const fige = refusDeFige(statut);
  if (fige !== null) {
    return fige;
  }
  if (accuseLe !== null) {
    return { refuse: true, cle: "demande.refus.deja_accusee" };
  }
  return PERMIS;
}

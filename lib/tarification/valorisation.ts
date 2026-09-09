import { arrondirAuPlusProche, montant, type Montant } from "@/lib/money";

/**
 * VALORISATION DE LA MAIN-D'ŒUVRE — arrondi et plancher (RG-TAR-05, D83).
 *
 * ## Les deux règles, dans leur ordre
 *
 * 1. **Arrondi.** Le temps d'intervention est arrondi **au quart d'heure
 *    supérieur**.
 * 2. **Plancher.** La main-d'œuvre facturée ne peut être **inférieure à une
 *    heure** au taux en vigueur.
 *
 * **L'ordre est une décision, pas une commodité** : arrondir d'abord puis
 * plancher ensuite donne le même résultat que l'inverse sur toutes les valeurs
 * — le plancher, 60 minutes, est lui-même un multiple de 15 — mais l'écrire
 * dans cet ordre rend le calcul lisible et le rend faux à relire à l'envers si
 * un jour le plancher cesse d'être un multiple du pas.
 *
 * **Les deux s'appliquent UNE SEULE FOIS, sur l'intervention ENTIÈRE**, jamais
 * tâche par tâche. C'est D11 pour l'agrégation interne — le temps est cumulé
 * avant d'être arrondi — et D57 pour l'externe : l'arrondi est par
 * intervention, jamais sur le total d'une journée. **Une intervention étalée
 * sur deux jours reste UNE intervention** : un seul arrondi, un seul plancher.
 *
 * ## Ce à quoi le plancher ne s'applique PAS, et pourquoi
 *
 * - **Les interventions au forfait.** Le prix d'un forfait ne dépend pas de la
 *   durée ; lui appliquer un plancher horaire reviendrait à facturer une heure
 *   par-dessus un prix déjà convenu.
 * - **Le trajet.** Il n'est pas facturé à l'heure (D74, RG-PLA-05) : c'est une
 *   donnée de planification, pas une ligne de main-d'œuvre.
 * - **Le travail interne.** Il n'est facturé à personne.
 *
 * D'où la forme de ce module : il n'expose **aucune** fonction générale
 * « valoriser une intervention ». Il expose la valorisation du **temps passé**,
 * qui est le seul mode où les deux règles mordent, et l'appelant doit avoir
 * décidé du mode avant de l'appeler. *Une fonction qui aurait accepté un mode
 * en argument aurait porté la composition forfait + excédent, qui n'est pas
 * tranchée (registre).*
 */

/** Le pas d'arrondi, en minutes : le quart d'heure. */
export const PAS_ARRONDI_MINUTES = 15;

/** Le plancher de main-d'œuvre facturée, en minutes : une heure. */
export const PLANCHER_MINUTES = 60;

/** Minutes dans une heure — nommé pour que la division du taux se lise. */
const MINUTES_PAR_HEURE = 60;

/** Ce qu'une valorisation au temps passé rend, décomposé pour être affichable. */
export type ValorisationTempsPasse = {
  /** Le temps réellement saisi, en minutes, tel quel. */
  readonly minutesReelles: number;
  /** Après arrondi au quart d'heure supérieur. */
  readonly minutesArrondies: number;
  /** Après plancher — c'est ce qui est facturé. */
  readonly minutesFacturees: number;
  /** Vrai quand le plancher a relevé le temps facturé au-dessus de l'arrondi. */
  readonly plancherApplique: boolean;
  /** Le taux horaire retenu, rendu pour que l'écran n'ait pas à le redemander. */
  readonly tauxHoraire: Montant;
  /** La main-d'œuvre facturée, hors taxes. */
  readonly mainDoeuvre: Montant;
};

/** Refus de valoriser : la saisie n'est pas une durée exploitable. */
export class ErreurDureeInvalide extends Error {
  constructor(minutes: number) {
    super(
      `Durée d'intervention invalide : ${minutes}. Le temps saisi doit être ` +
        "un nombre entier de minutes, positif ou nul.",
    );
    this.name = "ErreurDureeInvalide";
  }
}

/**
 * Arrondit une durée en minutes **au quart d'heure supérieur**.
 *
 * Zéro reste zéro : une intervention sans temps saisi n'est pas une
 * intervention d'un quart d'heure, c'est une intervention dont le temps
 * manque, et c'est à l'appelant de le refuser (la clôture l'exige).
 * Un multiple de 15 ne bouge pas — `30 → 30`, jamais `30 → 45`.
 */
export function arrondirAuQuartDHeureSuperieur(minutes: number): number {
  if (!Number.isSafeInteger(minutes) || minutes < 0) {
    throw new ErreurDureeInvalide(minutes);
  }
  return Math.ceil(minutes / PAS_ARRONDI_MINUTES) * PAS_ARRONDI_MINUTES;
}

/**
 * Valorise le temps passé d'UNE intervention : arrondi, puis plancher, puis
 * taux.
 *
 * Le montant est calculé en arithmétique entière exacte — `taux × minutes / 60`
 * passe par {@link arrondirAuPlusProche}, jamais par un flottant : un taux qui
 * ne se divise pas par quatre (un quart d'heure) donnerait sinon un centime de
 * dérive, et I3 interdit qu'un montant s'en aperçoive.
 */
export function valoriserTempsPasse(
  minutesReelles: number,
  tauxHoraire: Montant,
): ValorisationTempsPasse {
  const minutesArrondies = arrondirAuQuartDHeureSuperieur(minutesReelles);
  const minutesFacturees = Math.max(minutesArrondies, PLANCHER_MINUTES);
  const valeur = arrondirAuPlusProche(
    tauxHoraire.valeur * BigInt(minutesFacturees),
    BigInt(MINUTES_PAR_HEURE),
  );
  return {
    minutesReelles,
    minutesArrondies,
    minutesFacturees,
    plancherApplique: minutesFacturees > minutesArrondies,
    tauxHoraire,
    mainDoeuvre: montant(valeur, tauxHoraire.devise),
  };
}

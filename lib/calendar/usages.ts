import { jourDe, versLocal, type JourLocal } from "./fuseau";
import type { Calendrier } from "./calendrier";
import {
  echeanceEnMinutesOuvrees,
  joursOuvres,
  minutesHorsOuverture,
  minutesOuvrees,
  prochainCreneauOuvert,
} from "./ouverture";

/**
 * Un calendrier de référence par usage (arbitrage D13, invariant I7).
 *
 * D13 ne dit pas « le calendrier » : il dit **lequel**, usage par usage.
 *
 * | Usage | Calendrier de référence |
 * |---|---|
 * | Heures ouvrées des SLA | Agence de l'**intervention** |
 * | Majoration hors ouverture | Agence du **technicien** |
 * | Détection de conflit à la pose | Calendrier de **travail du technicien** |
 * | Contrôle « site fermé » | Horaires du **site client** — avertissement seul |
 * | Jours ouvrés des indicateurs | **Agence**, agrégé par société |
 *
 * **Pourquoi des fonctions distinctes plutôt qu'un paramètre.** Les cinq usages
 * appellent tous les mêmes primitives d'ouverture ; ce qui les distingue est le
 * calendrier qu'ils reçoivent, et c'est précisément ce qu'une signature commune
 * laisserait choisir au hasard de l'appelant. Une intervention posée à Koné par
 * un technicien de Ducos un samedi n'est pas hors ouverture (Ducos ouvre le
 * samedi) mais son SLA court sur le calendrier de Koné, qui est fermé. Le nom
 * de la fonction dit lequel des deux est en jeu ; un `calendrier: Calendrier`
 * anonyme ne l'aurait pas dit.
 *
 * Les paramètres sont donc nommés d'après leur ORIGINE — `agenceIntervention`,
 * `agenceTechnicien` — et non d'après leur type. Les tables `intervention` et
 * `technicien` arrivent au lot 1 : la résolution du calendrier depuis l'une ou
 * l'autre se branchera là, sur ces signatures, sans les changer.
 */

/**
 * Échéance d'un engagement de service, en heures ouvrées de l'agence DE
 * L'INTERVENTION (D13).
 *
 * Le compteur ne court qu'aux heures d'ouverture : un engagement de 4 h ouvrées
 * pris le vendredi à 16 h à Koné, qui ferme à 17 h et n'ouvre pas le samedi,
 * échoit le lundi — pas le vendredi soir.
 */
export function echeanceSla(
  agenceIntervention: Calendrier,
  depart: Date,
  minutesOuvreesRequises: number,
): Date {
  return echeanceEnMinutesOuvrees(
    agenceIntervention,
    depart,
    minutesOuvreesRequises,
  );
}

/**
 * Instant auquel le compteur d'accusé de réception démarre (D13).
 *
 * « Une demande déposée sur le portail un dimanche à 22 h déclenche son
 * compteur à l'ouverture du lundi. » Le standard des 30 minutes se mesure donc
 * à partir de cet instant, jamais du dépôt.
 */
export function departCompteurAccuse(
  agenceIntervention: Calendrier,
  depot: Date,
): Date {
  return prochainCreneauOuvert(agenceIntervention, depot);
}

/**
 * Minutes hors ouverture d'une intervention, sur le calendrier de l'agence DU
 * TECHNICIEN (D13).
 *
 * C'est l'assiette temporelle de la majoration de D12 — et seulement elle. Le
 * taux de +50 %, l'assiette main-d'œuvre et le prorata au quart d'heure
 * appartiennent à la valorisation (D45, L2-09) : `lib/calendar` ne connaît pas
 * la facturation.
 */
export function minutesHorsOuvertureTechnicien(
  agenceTechnicien: Calendrier,
  debut: Date,
  fin: Date,
): number {
  return minutesHorsOuverture(agenceTechnicien, debut, fin);
}

/** Un conflit signalé à la pose — jamais un blocage (RG-PLA-03). */
export type ConflitCalendrier = {
  /** Minutes du créneau qui tombent hors du calendrier de travail. */
  minutes_hors_calendrier: number;
};

/**
 * Le créneau posé sort-il du calendrier de travail DU TECHNICIEN (D13) ?
 *
 * Rend `null` quand tout le créneau est couvert. Le résultat est un **signal**,
 * pas un refus : RG-PLA-03 pose que « le planificateur garde la main » — un
 * chevauchement, comme une pose hors calendrier, est signalé et reste possible.
 * Seule l'habilitation manquante bloque (RG-PLA-04), et ce n'est pas ici.
 */
export function conflitPose(
  calendrierTravailTechnicien: Calendrier,
  debut: Date,
  fin: Date,
): ConflitCalendrier | null {
  const hors = minutesHorsOuverture(calendrierTravailTechnicien, debut, fin);
  return hors > 0 ? { minutes_hors_calendrier: hors } : null;
}

/** Un avertissement « site fermé » — jamais un blocage (D13). */
export type AvertissementSiteFerme = {
  minutes_hors_horaires: number;
};

/**
 * Le créneau tombe-t-il hors des horaires du SITE CLIENT (D13) ?
 *
 * **Site, pas agence** : un site est un lieu d'intervention chez un client, une
 * agence est un établissement CODIMA. D13 est explicite — ce contrôle est un
 * **avertissement, jamais un blocage**. Un client peut parfaitement ouvrir son
 * atelier pour recevoir un technicien en dehors de ses horaires affichés, et un
 * outil qui le refuserait serait contourné dès la première urgence.
 *
 * Les horaires du site sont reçus sous la même forme qu'un calendrier
 * d'agence : la table `site` du lot 1 les portera, ce module ne les lit pas.
 */
export function avertissementSiteFerme(
  horairesSite: Calendrier,
  debut: Date,
  fin: Date,
): AvertissementSiteFerme | null {
  const hors = minutesHorsOuverture(horairesSite, debut, fin);
  return hors > 0 ? { minutes_hors_horaires: hors } : null;
}

/**
 * Jours ouvrés d'une agence entre deux jours locaux, bornes comprises (D13).
 *
 * C'est la base des comparaisons « N/N-1 à périmètre et jours ouvrés
 * constants » (chapitre 8). L'agrégation par société est l'affaire de
 * `lib/reporting` : additionner les jours ouvrés de deux agences n'a de sens
 * que là où l'on sait ce qu'on agrège.
 */
export function joursOuvresAgence(
  agence: Calendrier,
  debut: JourLocal,
  fin: JourLocal,
): number {
  return joursOuvres(agence, debut, fin);
}

/**
 * Minutes ouvrées d'un créneau sur le calendrier d'une agence.
 *
 * Exposée pour les indicateurs de charge ; les usages réglementés ci-dessus
 * disent, eux, DE QUELLE agence il s'agit.
 */
export function minutesOuvreesAgence(
  agence: Calendrier,
  debut: Date,
  fin: Date,
): number {
  return minutesOuvrees(agence, debut, fin);
}

/** Le jour local d'un instant, lu dans le fuseau du calendrier. */
export function jourLocalDe(calendrier: Calendrier, instant: Date): JourLocal {
  return jourDe(versLocal(instant, calendrier.fuseau));
}

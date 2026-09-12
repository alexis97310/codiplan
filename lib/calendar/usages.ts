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
 * ~~L'assiette temporelle de la majoration de D12.~~ **ÉCARTÉE PAR D108, le
 * 12/09/2026 — ELLE MESURE EXACTEMENT CE QUE D108 REFUSE DE COMPTER.**
 *
 * Minutes hors ouverture d'une intervention, sur le calendrier de l'agence DU
 * TECHNICIEN (D13).
 *
 * ## POURQUOI ELLE N'A AUCUN APPELANT APPLICATIF, ET CE N'EST PAS UN OUBLI
 *
 * > **LA MAJORATION PAIE LA CONTRAINTE D'UN CRÉNEAU POSÉ HORS OUVERTURE, PAS
 * > LES MINUTES EFFECTIVEMENT TRAVAILLÉES** *(D108)*.
 *
 * *Le client a fait bloquer la soirée d'un technicien ; qu'il finisse tôt ne
 * rend pas la soirée disponible.* Cette fonction prend un `debut` et une `fin`
 * — les bornes de ce qui a été FAIT — et rend des minutes. **C'est l'issue (b)
 * que D108 a écartée**, et elle l'a écartée parce qu'elle *« exigeait une
 * hypothèse invérifiable : où, dans le créneau, les minutes travaillées se
 * placent-elles ? »*
 *
 * Ce qui calcule la majoration est `lib/tarification/majoration.ts`, et il lit
 * le **CRÉNEAU**. Un appelant qui prendrait celle-ci à sa place n'obtiendrait
 * pas une variante : il obtiendrait le chiffre que D108 a refusé.
 *
 * ## ELLE N'EST PAS EFFACÉE, ET C'EST LA MÊME RÈGLE QUE PARTOUT ICI
 *
 * *Ce qui a été décidé un jour se relit, sinon on le redécide* — le traitement
 * de SheetJS au §2, de Schedule-X, de `taux_horaire_defaut`. Elle documente
 * l'issue écartée à l'endroit où quelqu'un la réinventerait, et son unique
 * scénario dit dans son titre qu'il n'éprouve qu'une fonction écartée.
 *
 * ## ET SA RÉEXPORTATION EST RETIRÉE
 *
 * `lib/calendar/index.ts` ne la republie plus : elle n'y servait qu'au
 * scénario, qui l'importe désormais depuis ce fichier. **Une fonction écartée
 * qui reste sur la façade du module est une invitation** — le prochain
 * appelant pressé la trouve par autocomplétion et ne lit pas cet en-tête.
 *
 * ## CONDITION DE RÉOUVERTURE, et c'est celle de D108
 *
 * *Le jour où `intervention` porte l'heure réelle de début ET de fin*, la
 * question du prorata se rouvre et cette fonction redevient candidate. Elle
 * n'est donc pas morte : elle est **en attente d'une donnée qui n'existe pas.**
 */
export function minutesHorsOuvertureTechnicien(
  agenceTechnicien: Calendrier,
  debut: Date,
  fin: Date,
): number {
  return minutesHorsOuverture(agenceTechnicien, debut, fin);
}

/** Le débordement mesuré sur le calendrier de travail du technicien (D13). */
export type ConflitCalendrier = {
  /** Minutes du créneau qui tombent hors du calendrier de travail. */
  minutes_hors_calendrier: number;
};

/**
 * Le créneau posé sort-il du calendrier de travail DU TECHNICIEN (D13) ?
 *
 * Rend `null` quand tout le créneau est couvert, et un débordement chiffré
 * sinon. **Cette fonction MESURE ; elle ne prononce rien.**
 *
 * ## Ce qu'elle ne dit plus, et pourquoi la phrase a été retirée
 *
 * Elle citait RG-PLA-03 — *« le planificateur garde la main »*, un
 * chevauchement « signalé et qui reste possible ». **D99 a réécrit cette règle
 * le 11/09/2026 : un chevauchement est REFUSÉ.** La citation était donc devenue
 * fausse, et elle le serait restée sans rougir : le gardien de câblage
 * confronte les arbitrages aux RÈGLES du chapitre 10, et rien ne confronte un
 * commentaire de code au texte qu'il cite (§9, 31/08 — *la moitié manquante a
 * la forme de la moitié faite*).
 *
 * ## Les trois « conflits à la pose » ne sont PAS le même objet
 *
 * | Critère | Calendrier lu | Conséquence | Où elle est prononcée |
 * |---|---|---|---|
 * | chevauchement de deux interventions | aucun | **refus** (RG-PLA-03) | `lib/interventions/pose.ts` |
 * | créneau hors ouverture de l'agence visée | agence de l'**intervention** | **refus** (RG-PLA-07) | `lib/interventions/pose.ts` |
 * | créneau hors calendrier de travail | calendrier du **technicien** | *non tranché* | ici, et nulle part ailleurs |
 *
 * **La troisième ligne est écrite plutôt que devinée.** D13 dit QUEL calendrier
 * la regarde, jamais ce qu'on en fait ; ni RG-PLA-03 ni RG-PLA-07 ne portent
 * sur ce calendrier-là. *Recopier « refusé » des deux premières lignes ferait
 * refuser une pose que personne n'a décidé de refuser.*
 *
 * ## Elle n'a AUCUN appelant, et c'est un fait du schéma
 *
 * Le calendrier de travail propre à un technicien n'a **aucune source** :
 * `technicien.calendrier_id` appartient à la table `technicien` du chapitre 11,
 * marquée `(prévu)` au CLAUDE.md §6 et qui n'existe pas. *Ce n'est donc pas une
 * interface en attente d'écran — c'est une mesure en attente de sa donnée*, et
 * la ligne « non tranché » ci-dessus se tranchera le jour où la colonne
 * arrivera, pas avant.
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

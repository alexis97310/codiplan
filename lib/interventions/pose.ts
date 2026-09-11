import { creneauxDuJour, type Parametrage } from "@/lib/calendar/parametrage";
import {
  minutesDepuisMinuit,
  versLocal,
  type Fuseau,
} from "@/lib/calendar/fuseau";
import { jourSemaineIso } from "@/lib/calendar/semaine";
import type { JourLocal } from "@/lib/calendar/fuseau";

import type { Verdict } from "./cycle-de-vie";

/**
 * LES CONTRÔLES À LA POSE — ce qu'un dépôt de planning a le droit d'écrire
 * (R2-19 ; I7 ; règles rendues par l'exploitation le 11/09/2026).
 *
 * ## Ce module DÉCIDE, il n'écrit rien
 *
 * Il reçoit des données déjà lues sous le contexte cloisonné et rend un verdict
 * avec sa clé de dictionnaire. Il n'ouvre aucune transaction, ne lit aucune
 * base, ne connaît aucune société — *aucune comparaison de société n'est écrite
 * ici, ce serait une seconde lecture d'un critère que la politique porte déjà.*
 * C'est la même coupure que `cycle-de-vie.ts`, et pour la même raison.
 *
 * ## LE CALENDRIER QUI DÉCIDE EST CELUI DE L'AGENCE VISÉE, ET D'ELLE SEULE
 *
 * La vue semaine affiche une ligne par PERSONNE, et une case y est ouverte dès
 * qu'UNE des agences de la personne ouvre (`grille.ts`). *Cette union est un
 * repère, jamais un droit de poser* : une personne qui sert Ducos et Koné voit
 * son samedi ouvert alors que Koné ferme. L'agence de l'intervention ne change
 * pas quand on la déplace — elle est déduite du site —, et c'est son calendrier
 * qui prononce.
 *
 * `grille.ts` l'avait écrit avant que ce module existe : *« le refus appartient
 * aux contrôles à la pose, qui liront le calendrier de l'agence visée, pas
 * celui de la ligne. »*
 *
 * ## UNE AGENCE SANS CALENDRIER REFUSE, ELLE N'INVENTE PAS D'HORAIRE
 *
 * I7 : *aucun calendrier global codé en dur.* Une agence dont le calendrier est
 * inconnu n'a pas d'ouverture connue — et « inconnu » n'est pas « ouvert ». La
 * grille le dit déjà d'une autre manière : elle rend `null` plutôt que `false`,
 * parce qu'une agence grisée partout se lirait comme une agence fermée. Ici la
 * question n'est plus d'afficher mais de POSER, et poser sans horaire connu
 * promettrait un rendez-vous que personne ne peut tenir.
 *
 * ## UN CHEVAUCHEMENT EST UNE ERREUR, PAS UN AVERTISSEMENT
 *
 * Décision d'exploitation du 11/09/2026, et elle tranche contre l'usage du
 * dépôt — RG-PLA-04 avertit sur une exigence non bloquante, le site fermé n'est
 * qu'un avertissement (I7). *Pour un exploitant, deux interventions au même
 * moment pour la même personne ne sont pas un signal : c'est un planning faux.*
 */

/** L'intervention telle que les contrôles à la pose la voient. */
export type Posee = {
  readonly id: string;
  readonly technicien_id: string | null;
  readonly creneau_debut: Date | null;
  readonly creneau_fin: Date | null;
  readonly statut: string;
};

/**
 * Ce qu'un dépôt demande d'écrire — le CRÉNEAU visé, jamais l'objet métier.
 *
 * *Elle s'appelait `Demande`.* Le lot 2 crée la table `demande`, qui est le
 * point d'entrée du flux — un objet sans rapport avec celui-ci —, et
 * `lib/interventions/depot.ts` importe les deux. **Deux contrats sous un même
 * nom, dans deux modules qu'un même fichier importe, ne sont confrontés par
 * rien** : ni le typage, qui juge chaque appel séparément, ni la relecture,
 * pour qui `Demande` a l'air d'être `Demande` (§9, 09/09). Le nom a donc changé
 * avant que la collision existe, plutôt qu'après.
 */
export type PoseDemandee = {
  readonly datePlanifiee: JourLocal | null;
  readonly creneauDebut: Date | null;
  readonly creneauFin: Date | null;
  readonly technicienId: string | null;
};

const PERMIS: Verdict = { refuse: false };

/**
 * LES STATUTS QUI N'OCCUPENT PLUS RIEN.
 *
 * Une intervention annulée ne tient pas de créneau — elle n'aura pas lieu. La
 * clôturée et la terminée, si : elles ont eu lieu, et poser quelqu'un par-dessus
 * écrirait une journée de 26 heures.
 */
const SANS_OCCUPATION = new Set(["annulee"]);

/**
 * Le jour visé est-il ouvert dans le calendrier de l'agence de l'intervention ?
 *
 * `parametrage` vaut `null` quand l'agence n'a pas de calendrier : c'est un
 * REFUS, jamais une permission (voir l'entête).
 */
export function verdictOuverture(
  parametrage: Parametrage | null,
  demande: PoseDemandee,
  fuseau: Fuseau,
): Verdict {
  if (demande.datePlanifiee === null && demande.creneauDebut === null) {
    // Retirer une intervention du planning la rend à la file d'attente. Aucun
    // calendrier n'a son mot à dire : on ne pose rien.
    return PERMIS;
  }
  if (parametrage === null) {
    return { refuse: true, cle: "intervention.refus.agence_sans_calendrier" };
  }
  const jour =
    demande.datePlanifiee ??
    (demande.creneauDebut === null
      ? null
      : versLocal(demande.creneauDebut, fuseau));
  if (jour === null) {
    return PERMIS;
  }
  const creneaux = creneauxDuJour(parametrage, jourSemaineIso(jour));
  if (creneaux.length === 0) {
    return { refuse: true, cle: "intervention.refus.jour_ferme" };
  }
  if (demande.creneauDebut === null) {
    // Un jour sans heure : le jour ouvre, cela suffit. C'est le dépôt de la vue
    // SEMAINE, qui n'a pas d'heure à donner.
    return PERMIS;
  }
  const debut = minutesDepuisMinuit(versLocal(demande.creneauDebut, fuseau));
  const dansUnePlage = parametrage.plages.some(
    (plage) =>
      plage.jourSemaine === jourSemaineIso(jour) &&
      debut >= plage.debutMinutes &&
      debut < plage.finMinutes,
  );
  return dansUnePlage
    ? PERMIS
    : { refuse: true, cle: "intervention.refus.hors_ouverture" };
}

/**
 * Le créneau visé chevauche-t-il une autre intervention du MÊME technicien ?
 *
 * `voisines` sont les interventions du technicien visé, déjà lues sous le
 * contexte cloisonné. L'intervention déplacée en fait éventuellement partie :
 * elle est écartée par son identifiant, sinon elle se chevaucherait elle-même.
 *
 * **Deux créneaux qui se TOUCHENT ne se chevauchent pas** : 08:00–10:00 et
 * 10:00–11:00 s'enchaînent, et refuser cela rendrait la journée impossible à
 * remplir. La comparaison est donc stricte des deux côtés.
 */
export function verdictChevauchement(
  voisines: readonly Posee[],
  interventionId: string,
  demande: PoseDemandee,
): Verdict {
  if (
    demande.creneauDebut === null ||
    demande.creneauFin === null ||
    demande.technicienId === null
  ) {
    // Sans heure, il n'y a pas de recouvrement à calculer. Deux interventions
    // le même jour sans créneau ne sont pas un conflit : c'est une journée.
    return PERMIS;
  }
  const debut = demande.creneauDebut.getTime();
  const fin = demande.creneauFin.getTime();
  const heurte = voisines.some((voisine) => {
    if (voisine.id === interventionId) {
      return false;
    }
    if (voisine.technicien_id !== demande.technicienId) {
      return false;
    }
    if (SANS_OCCUPATION.has(voisine.statut)) {
      return false;
    }
    if (voisine.creneau_debut === null || voisine.creneau_fin === null) {
      return false;
    }
    return (
      debut < voisine.creneau_fin.getTime() &&
      fin > voisine.creneau_debut.getTime()
    );
  });
  return heurte
    ? { refuse: true, cle: "intervention.refus.chevauchement" }
    : PERMIS;
}

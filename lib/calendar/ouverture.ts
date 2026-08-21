import {
  comparerJours,
  instantAMinutes,
  jourDe,
  jourSuivant,
  minutesDepuisMinuit,
  versLocal,
  type JourLocal,
} from "./fuseau";
import {
  estChome,
  plagesDuJourSemaine,
  type Calendrier,
  type PlageOuverture,
} from "./calendrier";
import type { Creneau } from "./recurrence";
import { jourSemaineIso } from "./semaine";

/**
 * Les opérations d'ouverture (ticket L0-08, point 5).
 *
 * Trois questions, et elles sont posées par le planning, les engagements de
 * service et les indicateurs : un créneau tombe-t-il dans les heures ouvrées ?
 * quel est le prochain créneau ouvert ? combien de jours ouvrés entre deux
 * dates ?
 *
 * **Tout se calcule sur des instants, jamais sur des durées locales.** Une
 * plage de 8 h à 12 h dure quatre heures les jours ordinaires et trois heures
 * le dimanche du passage à l'heure d'été en métropole. Compter `fin − début` en
 * minutes locales donnerait quatre dans les deux cas, et un engagement de
 * quatre heures ouvrées échoirait une heure trop tard. Les bornes sont donc
 * converties en instants — et le décalage est recalculé pour chacune.
 *
 * **Ce module ne connaît pas la facturation** (D45). Il ne sait ni arrondir une
 * durée au quart d'heure, ni appliquer une majoration : il dit seulement ce qui
 * est ouvert et ce qui ne l'est pas. Le taux de +50 % de D12 s'applique
 * ailleurs, à partir de ce que `minutesHorsOuverture` rend.
 */

/**
 * Horizon de recherche, en jours. Un calendrier qui n'ouvre jamais — plages
 * vides, ou tous les jours fériés chômés — ferait autrement boucler la
 * recherche du prochain créneau. Un an et demi laisse place à toute fermeture
 * annuelle imaginable, et un refus explicite vaut mieux qu'une attente muette.
 */
const HORIZON_JOURS = 550;

function refusHorizon(calendrier: Calendrier, geste: string): Error {
  return new Error(
    `Calendrier « ${calendrier.code} » : l'horizon de ${HORIZON_JOURS} jours ` +
      `a été atteint (${geste}). Soit le calendrier n'ouvre jamais — un ` +
      "paramétrage incomplet, pas un cas limite : vérifier les plages " +
      "d'ouverture de l'agence —, soit l'intervalle demandé dépasse cet " +
      "horizon. Dans les deux cas, un résultat tronqué serait faux : il n'en " +
      "est pas rendu.",
  );
}

/**
 * Les plages effectivement ouvertes ce jour-là — vide si le jour est chômé.
 *
 * `estChome` a déjà appliqué le fait public PUIS l'écart local, dans cet ordre
 * (D46, complément 2) : ici, un jour particulier ne se relit plus, il se
 * constate. Un jour férié travaillé retrouve donc les plages de son jour de
 * semaine, sans qu'aucune heure ne soit inventée pour lui.
 */
export function plagesDuJour(
  calendrier: Calendrier,
  jour: JourLocal,
): PlageOuverture[] {
  if (estChome(calendrier, jour)) {
    return [];
  }
  return plagesDuJourSemaine(calendrier, jourSemaineIso(jour));
}

/**
 * Ce jour local est-il ouvré ? C'est-à-dire : l'agence y ouvre-t-elle au moins
 * une plage, et le jour n'est-il ni un férié chômé, ni un pont (RG-PLA-01,
 * RG-PLA-02) ?
 */
export function estJourOuvre(calendrier: Calendrier, jour: JourLocal): boolean {
  return plagesDuJour(calendrier, jour).length > 0;
}

/** Les créneaux ouverts d'un jour local, en instants. */
export function creneauxDuJour(
  calendrier: Calendrier,
  jour: JourLocal,
): Creneau[] {
  return plagesDuJour(calendrier, jour).map((plage) => ({
    debut: instantAMinutes(jour, plage.debut_minutes, calendrier.fuseau),
    fin: instantAMinutes(jour, plage.fin_minutes, calendrier.fuseau),
  }));
}

/**
 * Créneaux ouverts à partir d'un instant, dans l'ordre chronologique.
 *
 * Paresseux : la recherche du prochain créneau s'arrête au premier, et le
 * calcul d'une échéance dès que la durée est consommée. Le parcours part de la
 * VEILLE du jour local de l'instant — une plage ouverte la veille peut encore
 * courir, ce qui n'arrive pas avec les horaires d'une agence mais arriverait
 * avec ceux d'un site minier.
 */
function* creneauxDepuis(
  calendrier: Calendrier,
  instant: Date,
): Generator<Creneau> {
  const depart = jourDe(versLocal(instant, calendrier.fuseau));

  for (let ecart = -1; ecart <= HORIZON_JOURS; ecart += 1) {
    for (const creneau of creneauxDuJour(
      calendrier,
      jourSuivant(depart, ecart),
    )) {
      if (creneau.fin.getTime() > instant.getTime()) {
        yield creneau;
      }
    }
  }
}

/** L'instant tombe-t-il dans une plage ouverte ? Borne de fermeture exclue. */
export function estOuvert(calendrier: Calendrier, instant: Date): boolean {
  const local = versLocal(instant, calendrier.fuseau);
  const minutes = minutesDepuisMinuit(local);

  return plagesDuJour(calendrier, local).some(
    (plage) => minutes >= plage.debut_minutes && minutes < plage.fin_minutes,
  );
}

/**
 * Prochain instant ouvert, à partir de celui-ci — l'instant lui-même si le
 * calendrier est déjà ouvert.
 *
 * C'est ce qui fait démarrer le compteur d'accusé de réception à l'ouverture
 * du lundi quand la demande est déposée le dimanche à 22 h (D13).
 */
export function prochainCreneauOuvert(
  calendrier: Calendrier,
  instant: Date,
): Date {
  for (const creneau of creneauxDepuis(calendrier, instant)) {
    if (creneau.debut.getTime() <= instant.getTime()) {
      return instant;
    }
    return creneau.debut;
  }
  throw refusHorizon(calendrier, "prochain créneau ouvert");
}

/**
 * Minutes ouvrées entre deux instants. Zéro si l'intervalle est vide ou
 * entièrement fermé ; jamais négatif.
 */
export function minutesOuvrees(
  calendrier: Calendrier,
  debut: Date,
  fin: Date,
): number {
  if (fin.getTime() <= debut.getTime()) {
    return 0;
  }

  let total = 0;
  // L'horizon de recherche est fini : un intervalle qui le dépasserait
  // produirait un décompte tronqué, c'est-à-dire faux et silencieux. On
  // distingue donc la sortie par la borne de la sortie par épuisement.
  let atteintLaBorne = false;

  for (const creneau of creneauxDepuis(calendrier, debut)) {
    if (creneau.debut.getTime() >= fin.getTime()) {
      atteintLaBorne = true;
      break;
    }
    const depart = Math.max(creneau.debut.getTime(), debut.getTime());
    const arrivee = Math.min(creneau.fin.getTime(), fin.getTime());
    if (arrivee > depart) {
      total += (arrivee - depart) / 60_000;
    }
  }

  if (!atteintLaBorne) {
    throw refusHorizon(calendrier, "décompte des minutes ouvrées");
  }
  return total;
}

/**
 * Minutes NON ouvrées entre deux instants — le complément de `minutesOuvrees`.
 *
 * C'est l'assiette de la majoration hors ouverture (D12), et rien de plus : le
 * taux, l'assiette main-d'œuvre et l'arrondi au quart d'heure appartiennent à
 * la valorisation (D45, L2-09). Le calendrier dit « combien de minutes hors
 * ouverture », jamais « combien ça coûte ».
 */
export function minutesHorsOuverture(
  calendrier: Calendrier,
  debut: Date,
  fin: Date,
): number {
  if (fin.getTime() <= debut.getTime()) {
    return 0;
  }
  const totales = (fin.getTime() - debut.getTime()) / 60_000;
  return totales - minutesOuvrees(calendrier, debut, fin);
}

/**
 * Instant auquel `minutes` minutes ouvrées se seront écoulées depuis `depart`.
 *
 * C'est le calcul des engagements de service : « P1, résolution sous 4 h
 * ouvrées » (chapitre 7). Un départ hors ouverture est reporté à l'ouverture
 * suivante — un compteur qui courrait la nuit ferait échoir l'engagement avant
 * que quiconque ait pu commencer.
 */
export function echeanceEnMinutesOuvrees(
  calendrier: Calendrier,
  depart: Date,
  minutes: number,
): Date {
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new Error(
      `Durée ouvrée invalide : ${minutes}. Attendu un nombre de minutes ` +
        "positif ou nul.",
    );
  }
  if (minutes === 0) {
    return prochainCreneauOuvert(calendrier, depart);
  }

  let restant = minutes;
  for (const creneau of creneauxDepuis(calendrier, depart)) {
    const entree = Math.max(creneau.debut.getTime(), depart.getTime());
    const disponible = (creneau.fin.getTime() - entree) / 60_000;
    if (disponible <= 0) {
      continue;
    }
    if (disponible >= restant) {
      return new Date(entree + restant * 60_000);
    }
    restant -= disponible;
  }
  throw refusHorizon(calendrier, "échéance en minutes ouvrées");
}

/**
 * Nombre de jours ouvrés entre deux jours locaux, **bornes comprises**.
 *
 * Bornes comprises parce que c'est ainsi qu'on compte un délai en jours ouvrés
 * dans un contrat : « sous 5 jours ouvrés » à partir d'un lundi ouvré inclut ce
 * lundi. L'ordre des bornes est indifférent.
 */
export function joursOuvres(
  calendrier: Calendrier,
  debut: JourLocal,
  fin: JourLocal,
): number {
  const [premier, dernier] =
    comparerJours(debut, fin) <= 0 ? [debut, fin] : [fin, debut];

  let total = 0;
  let jour = premier;
  for (let ecart = 0; comparerJours(jour, dernier) <= 0; ecart += 1) {
    if (ecart > HORIZON_JOURS * 4) {
      throw new Error(
        `Calendrier « ${calendrier.code} » : intervalle de jours ouvrés hors ` +
          "de proportion — plus de six ans séparent les deux bornes.",
      );
    }
    if (estJourOuvre(calendrier, jour)) {
      total += 1;
    }
    jour = jourSuivant(jour);
  }
  return total;
}

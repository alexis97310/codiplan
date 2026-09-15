import type { StatutIntervention } from "@prisma/client";

import { type TrajetDeLaPeriode } from "./trajet";

/**
 * STATISTIQUES PAR TECHNICIEN — le nombre, le taux d'occupation, et la barre
 * segmentée des heures.
 *
 * ## LA RÈGLE QUI GOUVERNE CE MODULE : JAMAIS LE POURCENTAGE SEUL
 *
 * *Demande d'exploitation du 10/09/2026, et elle est plus qu'une préférence
 * d'affichage.* « 82 % » ne veut rien dire sans ses deux termes : 82 % de quoi,
 * sur quelle période, et calculé comment ? Un taux d'occupation qui voyage seul
 * est **un nombre dont la signification dépend d'autre chose** — c'est très
 * exactement D56, *un nombre dont la signification dépend d'une autre colonne ne
 * voyage jamais seul* —, et il finit par être comparé entre deux agences dont
 * les calendriers n'ont rien à voir.
 *
 * **Ce module n'expose donc AUCUN pourcentage prêt à afficher.** Il rend le
 * NUMÉRATEUR et le DÉNOMINATEUR, et `tauxOccupation` ne se calcule qu'à partir
 * des deux. L'écran qui affiche le taux affiche la formule ; un gardien exige
 * que la clé du dictionnaire porte ses **trois** substitutions.
 *
 * ## Le numérateur : ce qui OCCUPE réellement le technicien
 *
 * `temps_valide_min` quand il est connu — c'est ce qui s'est passé —, sinon
 * `duree_estimee_min` — c'est ce qui est engagé. **Et quand ni l'un ni l'autre
 * n'est renseigné, l'intervention compte dans le NOMBRE et pour zéro minute
 * dans le taux.** Cet écart est rendu explicitement (`sansDuree`) plutôt que
 * dissous : sans lui, un planning entièrement saisi sans durées afficherait un
 * taux d'occupation de 0 % sur un technicien débordé, et le chiffre serait
 * juste (§9, 06/09 — un chiffre juste qui fait conclure faux).
 *
 * **L'intervention ANNULÉE ne compte que par son temps RÉEL.** I5 donne à
 * l'annulation la préséance sur tout, *mais le travail terrain n'est jamais
 * perdu* : une annulation après deux heures sur site a occupé deux heures. Une
 * annulation avant déplacement n'a rien occupé, et son estimation ne compte pas
 * — elle décrit un travail qui n'aura pas lieu.
 *
 * ## LE TRAJET ENTRE DANS LA CHARGE DEPUIS L3-05a (D107, RG-PLA-05)
 *
 * RG-PLA-05 l'exige — *« le temps de trajet est intégré au calcul de charge »*
 * — et il ne l'était pas : `minutesEngagees` ne comptait que la durée de
 * l'intervention, si bien que **la barre et le taux sous-estimaient la journée
 * réelle** de plusieurs heures par semaine et par technicien.
 *
 * **Il est un CHAMP À PART, et jamais fondu dans `minutesEngagees`.** Trois
 * raisons, et la troisième est celle qui décide. La barre est segmentée par
 * STATUT, et un trajet n'a pas de statut — l'y verser ferait une barre dont les
 * segments ne somment plus à leur propre largeur. Les deux nombres ne se
 * corrigent pas au même endroit : l'un est une durée d'intervention, l'autre un
 * paramétrage de zone. Et surtout : *un taux dont on ne peut plus retrouver les
 * termes n'est plus vérifiable* — l'écran affiche les deux, et la formule les
 * nomme tous les deux.
 *
 * **Le trajet est un ARGUMENT OBLIGATOIRE**, sans valeur par défaut : un
 * appelant qui l'oublierait ne compile pas. C'est la leçon de D70 — *une
 * garantie énoncée sur un geste est satisfaite par un geste vide.* Celui qui ne
 * compte que le temps d'intervention passe `SANS_TRAJET`, et cela se lit.
 *
 * ## Le dénominateur : les minutes OUVRABLES, jamais un forfait
 *
 * Il vient du calendrier — `minutesOuvrees` de `lib/calendar/ouverture.ts` —, et
 * il est passé en argument plutôt que calculé ici : *ce module ne décide pas
 * quand on travaille* (I7, aucun calendrier global codé en dur). **Un
 * dénominateur nul ne rend pas 0 % : il rend `null`.** Zéro pour cent se lit
 * « ce technicien n'a rien fait » ; l'absence de calendrier se lit « je ne sais
 * pas », et les deux ne se corrigent pas de la même façon.
 */

/** L'ordre du cycle de vie — c'est celui de la barre, jamais l'alphabet. */
export const ORDRE_STATUTS = [
  "a_planifier",
  "planifiee",
  "affectee",
  "en_cours",
  "suspendue",
  "terminee",
  "cloturee",
  "annulee",
] as const satisfies readonly StatutIntervention[];

/** Ce dont le calcul a besoin, et rien de plus. */
export type InterventionMesuree = {
  readonly statut: StatutIntervention;
  readonly technicien_id: string | null;
  readonly temps_valide_min: number | null;
  readonly duree_estimee_min: number | null;
};

/** Un segment de la barre : un statut, ses minutes, son nombre de lignes. */
export type SegmentHeures = {
  readonly statut: StatutIntervention;
  readonly minutes: number;
  readonly interventions: number;
};

/**
 * L'occupation d'un technicien sur une période.
 *
 * **Le pourcentage n'est PAS un champ de ce type**, et c'est délibéré : le
 * lecteur qui veut le taux passe par `tauxOccupation`, qui exige l'objet
 * entier. On ne peut donc pas transporter le taux sans ses termes.
 */
export type OccupationTechnicien = {
  readonly technicienId: string | null;
  /** Le NOMBRE d'interventions — la première des deux mesures demandées. */
  readonly interventions: number;
  /** NUMÉRATEUR : minutes réellement ou effectivement engagées. */
  readonly minutesEngagees: number;
  /** DÉNOMINATEUR : minutes ouvrables du calendrier sur la période. */
  readonly minutesOuvrables: number;
  /** Combien d'interventions ne portent NI temps réel NI estimation. */
  readonly sansDuree: number;
  /**
   * LE TRAJET de la période, lecture C (D107) — à part, jamais fondu dans
   * `minutesEngagees`. Il porte aussi ce qu'il n'a pas su compter.
   */
  readonly trajet: TrajetDeLaPeriode;
  /** La barre segmentée, dans l'ordre du cycle de vie ; les vides sont gardés. */
  readonly segments: readonly SegmentHeures[];
};

/**
 * Les minutes qu'une intervention OCCUPE — le cœur de la règle, isolé pour
 * qu'il soit éprouvable seul.
 */
export function minutesEngagees(
  intervention: InterventionMesuree,
): number | null {
  if (intervention.statut === "annulee") {
    // Une annulation ne compte que par ce qui a réellement eu lieu (I5).
    return intervention.temps_valide_min ?? null;
  }
  return (
    intervention.temps_valide_min ?? intervention.duree_estimee_min ?? null
  );
}

/**
 * L'occupation d'UN technicien, sur les interventions qu'on lui a passées.
 *
 * La sélection des interventions — période, société, technicien — appartient à
 * l'appelant : ce module ne lit ni la base ni l'horloge.
 */
export function occupationTechnicien(
  technicienId: string | null,
  interventions: readonly InterventionMesuree[],
  minutesOuvrables: number,
  trajet: TrajetDeLaPeriode,
): OccupationTechnicien {
  const parStatut = new Map<StatutIntervention, { m: number; n: number }>();
  for (const statut of ORDRE_STATUTS) {
    parStatut.set(statut, { m: 0, n: 0 });
  }

  let engagees = 0;
  let sansDuree = 0;
  for (const intervention of interventions) {
    const minutes = minutesEngagees(intervention);
    if (minutes === null) {
      sansDuree += 1;
    } else {
      engagees += minutes;
    }
    const case_ = parStatut.get(intervention.statut);
    if (case_ !== undefined) {
      case_.m += minutes ?? 0;
      case_.n += 1;
    }
  }

  return {
    technicienId,
    interventions: interventions.length,
    minutesEngagees: engagees,
    minutesOuvrables,
    sansDuree,
    trajet,
    segments: ORDRE_STATUTS.map((statut) => ({
      statut,
      minutes: parStatut.get(statut)?.m ?? 0,
      interventions: parStatut.get(statut)?.n ?? 0,
    })),
  };
}

/**
 * Le taux d'occupation, en pour cent, ARRONDI AU PLUS PROCHE.
 *
 * **Le numérateur est la CHARGE — interventions PLUS trajet** (D107, L3-05a),
 * et `minutesDeCharge` est le seul endroit où la somme s'écrit : deux additions
 * du même critère divergeraient en silence le jour où un troisième terme
 * entrerait dans la charge.
 *
 * **Il rend `null` quand le dénominateur est nul**, et l'appelant doit traiter
 * ce cas : *« pas de calendrier » n'est pas « 0 % »*. Rendre zéro accuserait un
 * technicien de n'avoir rien fait là où c'est le paramétrage qui manque.
 *
 * Il peut **dépasser 100** et ce n'est pas une erreur : un technicien qui
 * travaille hors des heures d'ouverture est sur-occupé, et c'est précisément ce
 * qu'un planificateur doit voir. Le plafonner masquerait le seul cas qui
 * demande une action.
 */
export function minutesDeCharge(occupation: OccupationTechnicien): number {
  return occupation.minutesEngagees + occupation.trajet.minutes;
}

/**
 * LE TAUX PLEIN — 100. Une CONSTANTE plutôt qu'un littéral dans l'écran, parce
 * que c'est ici que la règle est écrite : *le taux peut dépasser 100 et ce
 * n'est pas une erreur.* Le seuil au-delà duquel l'écran le DIT est le même
 * nombre, et l'écrire deux fois serait deux lectures d'un même critère (§9,
 * 01/09).
 */
export const TAUX_PLEIN = 100;

export function tauxOccupation(
  occupation: OccupationTechnicien,
): number | null {
  if (occupation.minutesOuvrables <= 0) {
    return null;
  }
  return Math.round(
    (minutesDeCharge(occupation) / occupation.minutesOuvrables) * 100,
  );
}

/**
 * LE TAUX EST-IL NON NUL MAIS INFÉRIEUR À UN POUR CENT ?
 *
 * **C'est la capture d'écran qui a posé la question**, et aucune assertion ne
 * l'aurait posée : sur le planning de démonstration, une ligne affichait
 * *« 01:35 engagées · 548:00 ouvrables · Taux d'occupation 0 % »*. Le chiffre
 * est juste — 95 minutes sur 32 880 font 0,29 %, qui s'arrondit à zéro — et il
 * contredit la ligne qui le précède. *Zéro pour cent se lit « n'a rien fait »,
 * et ce technicien a travaillé une heure trente-cinq.*
 *
 * L'écran affiche alors « moins de 1 % » plutôt que « 0 % ». On ne gagne pas en
 * précision : on cesse d'affirmer quelque chose de faux. Même famille que le
 * dénominateur nul — *deux états distincts ne se disent pas avec le même mot* —
 * et que le §9 du 06/09, un chiffre juste qui fait conclure faux.
 */
export function tauxArrondiAZeroMaisNonNul(
  occupation: OccupationTechnicien,
): boolean {
  return minutesDeCharge(occupation) > 0 && tauxOccupation(occupation) === 0;
}

/**
 * La part d'un segment dans la barre, en pour cent de la LARGEUR de la barre.
 *
 * La barre représente les minutes ENGAGÉES, jamais les minutes ouvrables : une
 * barre dont les segments ne somment pas à sa largeur se lit comme un défaut
 * d'affichage. Le taux d'occupation, lui, se lit à côté et porte sa formule.
 */
export function partDuSegment(
  segment: SegmentHeures,
  occupation: OccupationTechnicien,
): number {
  if (occupation.minutesEngagees <= 0) {
    return 0;
  }
  return (segment.minutes / occupation.minutesEngagees) * 100;
}

/**
 * ── LE TAUX COMPACT — SOUS LE NOM, DANS LA COLONNE « TECHNICIEN » (D111) ─────
 *
 * ## CE QUE D111 AUTORISE, ET CE QU'IL N'AUTORISE PAS
 *
 * **Le pourcentage seul**, sans le nom de l'agence, sans la formule, sans les
 * deux termes. *Le panneau de charge, lui, continue de les porter* — D56 y reste
 * entier, et `tests/unit/interventions/occupation-affichee.test.ts` l'exige.
 *
 * ## POURQUOI CE N'EST PAS UNE DÉROGATION À D56
 *
 * D56 interdit qu'*un nombre dont la signification dépend d'une autre colonne*
 * voyage seul. La dépendance existe bien — la maille est `(technicien, agence)`
 * — **mais elle est résolue par le SCHÉMA** : `technicien.agence_id` est une
 * colonne simple et `NOT NULL` (L3-01a), donc une personne n'a **jamais deux
 * taux**. *Un nombre dont la seule lecture possible est la bonne ne dépend de
 * rien.*
 *
 * **La condition de réouverture est donc une propriété du schéma, et un gardien
 * la tient** : `tests/unit/interventions/taux-compact.test.ts`. Le jour où une
 * ligne de technicien portera deux agences, il rougira — et cet affichage devra
 * nommer l'agence.
 *
 * ## LES TROIS ÉTATS NE SE DISENT PAS AVEC LE MÊME MOT
 *
 * `null` — **pas de calendrier**, donc pas de dénominateur : *« pas de
 * calendrier » et « n'a rien fait » ne se corrigent pas au même endroit.*
 * `infime` — non nul mais arrondi à zéro : *zéro pour cent se lit « n'a rien
 * fait », et ce technicien a travaillé.* Et le taux lui-même.
 *
 * **Ce module rend l'ÉTAT, jamais le texte** : les libellés sont au
 * dictionnaire, et la coupure de L0-11 veut qu'un module rende un code.
 */
export type TauxCompact =
  | { readonly etat: "sans_calendrier" }
  | { readonly etat: "infime" }
  | { readonly etat: "chiffre"; readonly pourcent: number };

export function tauxCompact(occupation: OccupationTechnicien): TauxCompact {
  const taux = tauxOccupation(occupation);
  if (taux === null) {
    return { etat: "sans_calendrier" };
  }
  if (tauxArrondiAZeroMaisNonNul(occupation)) {
    return { etat: "infime" };
  }
  return { etat: "chiffre", pourcent: taux };
}

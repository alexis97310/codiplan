/**
 * LE TRAJET D'UNE JOURNÉE — la LECTURE C de D107 (L3-05a, RG-PLA-05).
 *
 * ## Ce que la lecture C dit, et pourquoi elle a été choisie
 *
 * **L'ALLER vers le PREMIER site de la journée, plus le RETOUR depuis le
 * DERNIER.** Rien entre les deux.
 *
 * Trois lectures étaient possibles avec la colonne telle qu'elle est, et sur une
 * journée à trois sites elles donnent **270, 120 et 105 minutes** — plusieurs
 * heures d'écart par semaine et par technicien. *La raison décisive de C : quand
 * la journée ne porte qu'une intervention, elle donne **exactement A** — le site
 * étant à la fois premier et dernier ; et dès que la journée est groupée, elle
 * **cesse de compter un retour à l'agence qui n'a pas eu lieu**.* A supposait un
 * retour entre chaque site, faux pour un fourgon chargé d'outillage ; B —
 * `2 × max` — est une fiction géométrique qui décrit une journée qui n'a pas eu
 * lieu.
 *
 * ## LE TEMPS ENTRE DEUX SITES N'EST PAS COMPTÉ, ET CE MODULE NE L'APPROCHE PAS
 *
 * `site.temps_trajet_min` ne porte que des distances **depuis l'agence** (D56),
 * et *soustraire deux distances à un point commun n'est pas une distance*. Rien
 * ici ne l'estime, ne l'interpole, ne le majore : **l'application l'ÉCRIT** —
 * même discipline que le `NOT VALID` de D104, *ce qu'on ne sait pas, on le dit.*
 *
 * ## CE MODULE NE TRIE PAS, ET C'EST UNE DÉCISION
 *
 * Les étapes arrivent **dans l'ordre où l'écran les affiche** — celui que
 * `listerPlanning` a arrêté (date, créneau, urgence, ancienneté, `id`). Trier
 * ici serait une **seconde lecture de l'ordre**, et elle divergerait en silence
 * de la ligne du planning (§9, 01/09) : *le total compterait les extrémités
 * d'une journée que personne ne voit.*
 *
 * *Ce que cela laisse ouvert, écrit plutôt que tu* : une journée dont certaines
 * interventions n'ont pas de créneau n'a pas d'ordre pleinement déterminé par
 * l'heure. Les extrémités sont alors celles de l'ordre AFFICHÉ, et c'est le seul
 * ordre que quelqu'un puisse vérifier.
 *
 * ## UNE JOURNÉE DONT UNE EXTRÉMITÉ EST INCONNUE NE COMPTE PAS ZÉRO
 *
 * Elle se **compte à part** (`journeesSansTrajet`). Un site sans zone, ou une
 * zone qui n'admet pas d'estimation — `iles`, D107 —, rend `null` : additionner
 * zéro ferait lire « aucun trajet » là où il faut lire « je ne sais pas », et
 * c'est la faute que ce dépôt a déjà nommée sur un total de facture et sur un
 * taux d'occupation sans calendrier.
 *
 * ## AUCUNE BASE, AUCUNE HORLOGE, AUCUN PRIX
 *
 * L'appelant résout les durées (cascade de `lib/sites/trajet-zone.ts`) et donne
 * l'ordre. Et le trajet n'est **jamais** facturé au temps : RG-PLA-05 — *« elle
 * ne s'ajoute jamais aux heures facturées »* — et RG-INT-07 — *« le déplacement
 * se facture par un forfait conditionné par zone »*. Ce module alimente la
 * CHARGE, et rien d'autre.
 */

/** Une étape de la période : la journée où elle tombe, et son trajet connu. */
export type EtapeDeTournee = {
  /**
   * La clé de journée, ou `null` pour ce qui n'est pas daté — la file
   * d'attente. *Ce qui n'a pas de jour n'a pas de trajet : personne n'y est
   * allé.*
   */
  readonly jour: string | null;
  /** Le trajet ALLER depuis l'agence, en minutes, ou `null` s'il est inconnu. */
  readonly trajetMin: number | null;
};

/** Le trajet d'une période, avec ce qu'il n'a pas su compter. */
export type TrajetDeLaPeriode = {
  /** Les minutes de trajet des journées dont les deux extrémités sont connues. */
  readonly minutes: number;
  /** Combien de journées ont été comptées — le témoin de non-vacuité. */
  readonly journees: number;
  /** Combien de journées ont une extrémité de trajet INCONNUE. */
  readonly journeesSansTrajet: number;
};

/**
 * Aucun trajet connu — à passer EXPLICITEMENT par un appelant qui ne compte que
 * le temps d'intervention.
 *
 * *Il n'est pas une valeur par défaut*, et l'argument correspondant n'en a pas :
 * un appelant qui oublierait le trajet ne compile pas. C'est la leçon de D70 —
 * *une garantie énoncée sur un geste est satisfaite par un geste vide* : ici, le
 * geste est obligatoire, et l'oubli est visible à la lecture de l'appel.
 */
export const SANS_TRAJET: TrajetDeLaPeriode = {
  minutes: 0,
  journees: 0,
  journeesSansTrajet: 0,
};

/**
 * LA CLÉ DE JOURNÉE, tirée de `date_planifiee`.
 *
 * **Aucun fuseau n'est lu, et c'est voulu** : la colonne est un `DATE` en base —
 * une journée est déjà une journée, pas un instant. La rapporter à un fuseau
 * risquerait de la décaler d'un cran sous UTC+11, ce qui rangerait le trajet du
 * 1ᵉʳ au 31. Seul `lib/calendar/` lit l'heure courante (L0-08) ; ici il n'y a
 * pas d'heure du tout.
 */
export function jourDeLEtape(datePlanifiee: Date | null): string | null {
  if (datePlanifiee === null) {
    return null;
  }
  return datePlanifiee.toISOString().slice(0, 10);
}

/**
 * LE TRAJET DE LA PÉRIODE, journée par journée, selon la lecture C.
 *
 * L'ordre reçu est l'ordre affiché ; voir l'entête. Les journées sont regroupées
 * dans leur ordre d'apparition, ce qui suffit — le total ne dépend pas de
 * l'ordre des journées entre elles.
 */
export function trajetDesJournees(
  etapes: readonly EtapeDeTournee[],
): TrajetDeLaPeriode {
  const journees = new Map<string, EtapeDeTournee[]>();
  for (const etape of etapes) {
    if (etape.jour === null) {
      continue;
    }
    const existante = journees.get(etape.jour);
    if (existante === undefined) {
      journees.set(etape.jour, [etape]);
    } else {
      existante.push(etape);
    }
  }

  let minutes = 0;
  let comptees = 0;
  let sansTrajet = 0;
  for (const etapesDuJour of journees.values()) {
    const premiere = etapesDuJour[0];
    const derniere = etapesDuJour[etapesDuJour.length - 1];
    // `premiere` et `derniere` existent : une journée n'entre dans la table que
    // par une étape. L'écrire évite un `!` que le §5 refuse.
    if (premiere === undefined || derniere === undefined) {
      continue;
    }
    const aller = premiere.trajetMin;
    const retour = derniere.trajetMin;
    if (aller === null || retour === null) {
      // *Une journée dont une extrémité est inconnue ne compte pas zéro.*
      sansTrajet += 1;
      continue;
    }
    minutes += aller + retour;
    comptees += 1;
  }

  return { minutes, journees: comptees, journeesSansTrajet: sansTrajet };
}

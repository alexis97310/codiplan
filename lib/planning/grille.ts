import {
  type Calendrier,
  type JourLocal,
  MINUTES_PAR_JOUR,
  instantAMinutes,
  minutesDepuisMinuit,
  plagesDuJour,
  versLocal,
} from "@/lib/calendar";

/**
 * LA GRILLE HORAIRE DU PLANNING — géométrie pure, aucune donnée, aucun rendu
 * (ticket L2-11, D72).
 *
 * **Ce module ne lit ni la base ni l'horloge.** Il transforme un calendrier et
 * un jour en une suite de lignes, et une intervention en une position sur ces
 * lignes. Le composant ne calcule donc aucune heure, et les règles de D72 —
 * pas de 15 minutes, plage et jours travaillés PARAMÉTRABLES par agence, avec
 * exception possible par technicien — se prouvent ici, sans navigateur.
 *
 * **Le pas est une constante NOMMÉE, jamais un nombre semé dans le code.** D72
 * l'arrête à 15 minutes ; le changer un jour est une décision qui se prend à un
 * endroit.
 *
 * **Aucun horaire n'est écrit en dur** (I7). Un planning qui saurait que la
 * journée va de 7 h à 17 h serait le calendrier de Ducos gravé dans le
 * composant — exactement la faute que l'invariant nomme. Les bornes viennent
 * des plages du calendrier, et un jour sans plage n'a pas de grille : c'est un
 * jour fermé, et l'écran le dit plutôt que d'afficher une colonne vide.
 */

/** Le pas de la grille, en minutes (D72). */
export const PAS_MINUTES = 15;

/** Une ligne de la grille : un instant, et s'il porte une graduation d'heure. */
export type LigneGrille = {
  /** Minutes locales depuis minuit. */
  readonly minutes: number;
  /** `08:15`, dans le fuseau du calendrier. Rendu tel quel. */
  readonly libelle: string;
  /** Vrai au passage d'une heure pleine : c'est là que le filet se marque. */
  readonly heurePleine: boolean;
};

/** La grille d'un jour, pour un calendrier donné. */
export type Grille = {
  readonly jour: JourLocal;
  readonly fuseau: string;
  /** Première minute affichée, locale depuis minuit. */
  readonly debutMinutes: number;
  /** Dernière minute affichée, exclue. */
  readonly finMinutes: number;
  readonly lignes: readonly LigneGrille[];
  /**
   * Vrai quand le calendrier n'ouvre pas ce jour-là. La grille est alors VIDE,
   * et l'écran doit le dire — un jour fermé n'est pas un jour sans travail
   * affiché, c'est une information.
   */
  readonly ferme: boolean;
};

function deuxChiffres(valeur: number): string {
  return valeur < 10 ? `0${valeur}` : `${valeur}`;
}

/** `08:15` — l'heure locale d'une minute depuis minuit. */
export function libelleMinutes(minutes: number): string {
  const heures = Math.floor(minutes / 60) % 24;
  return `${deuxChiffres(heures)}:${deuxChiffres(minutes % 60)}`;
}

/** Arrondit vers le bas au pas de la grille. */
function auPas(minutes: number): number {
  return Math.floor(minutes / PAS_MINUTES) * PAS_MINUTES;
}

/** Arrondit vers le haut au pas de la grille. */
function auPasSuperieur(minutes: number): number {
  return Math.ceil(minutes / PAS_MINUTES) * PAS_MINUTES;
}

/**
 * La grille d'un jour.
 *
 * Les bornes sont l'UNION des plages du jour — une coupure de midi ne coupe pas
 * la grille en deux, elle reste affichée : un technicien peut intervenir sur
 * l'heure du déjeuner, et masquer la ligne rendrait le bloc invisible.
 */
export function grilleDuJour(calendrier: Calendrier, jour: JourLocal): Grille {
  const plages = plagesDuJour(calendrier, jour);

  if (plages.length === 0) {
    return {
      jour,
      fuseau: calendrier.fuseau,
      debutMinutes: 0,
      finMinutes: 0,
      lignes: [],
      ferme: true,
    };
  }

  const debut = auPas(Math.min(...plages.map((plage) => plage.debut_minutes)));
  const fin = auPasSuperieur(
    Math.min(
      MINUTES_PAR_JOUR,
      Math.max(...plages.map((plage) => plage.fin_minutes)),
    ),
  );

  const lignes: LigneGrille[] = [];
  for (let minutes = debut; minutes < fin; minutes += PAS_MINUTES) {
    lignes.push({
      minutes,
      libelle: libelleMinutes(minutes),
      heurePleine: minutes % 60 === 0,
    });
  }

  return {
    jour,
    fuseau: calendrier.fuseau,
    debutMinutes: debut,
    finMinutes: fin,
    lignes,
    ferme: false,
  };
}

/** La place d'un bloc dans la grille, en NOMBRE DE PAS depuis le haut. */
export type Position = {
  /** Rang de la première ligne occupée, 0 pour la première de la grille. */
  readonly depuis: number;
  /** Nombre de pas occupés. Toujours au moins 1 : un bloc se voit. */
  readonly pas: number;
  /**
   * Vrai si le créneau DÉBORDE de la grille — il commence avant l'ouverture ou
   * finit après la fermeture. L'écran le signale plutôt que de tronquer en
   * silence : une intervention posée hors des heures d'ouverture est une
   * information de gestion, pas un défaut d'affichage.
   */
  readonly deborde: boolean;
};

/**
 * Place un créneau — deux instants — dans la grille d'un jour.
 *
 * Rend `null` quand le créneau ne rencontre pas la grille du tout : un bloc
 * d'un autre jour n'a pas de place ici, et l'inventer serait pire que
 * l'omettre.
 */
export function positionner(
  grille: Grille,
  debut: Date,
  fin: Date,
): Position | null {
  if (grille.ferme || grille.lignes.length === 0) {
    return null;
  }

  const local = (instant: Date): number => {
    const jourLocal = versLocal(instant, grille.fuseau);
    const minutes = minutesDepuisMinuit(jourLocal);
    // Un instant d'un autre jour local se projette aux bornes, ce qui suffit à
    // le faire sortir de la grille ou à le faire déborder — jamais à le placer
    // au hasard au milieu.
    const memeJour =
      jourLocal.annee === grille.jour.annee &&
      jourLocal.mois === grille.jour.mois &&
      jourLocal.jour === grille.jour.jour;
    if (memeJour) {
      return minutes;
    }
    return instant.getTime() <
      instantAMinutes(grille.jour, grille.debutMinutes, grille.fuseau).getTime()
      ? Number.NEGATIVE_INFINITY
      : Number.POSITIVE_INFINITY;
  };

  const debutMinutes = local(debut);
  const finMinutes = local(fin);

  if (finMinutes <= grille.debutMinutes || debutMinutes >= grille.finMinutes) {
    return null;
  }

  const deborde =
    debutMinutes < grille.debutMinutes || finMinutes > grille.finMinutes;

  const borneDebut = Math.max(debutMinutes, grille.debutMinutes);
  const borneFin = Math.min(finMinutes, grille.finMinutes);

  const depuis = Math.floor(
    (auPas(borneDebut) - grille.debutMinutes) / PAS_MINUTES,
  );
  const pas = Math.max(
    1,
    Math.ceil((auPasSuperieur(borneFin) - auPas(borneDebut)) / PAS_MINUTES),
  );

  return { depuis, pas, deborde };
}

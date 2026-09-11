import type { JourLocal } from "@/lib/calendar/fuseau";
import { jourSemaineIso } from "@/lib/calendar/semaine";

/**
 * LA VUE JOUR — les heures en lignes, les personnes en colonnes (11/09/2026).
 *
 * ## Son objet, et le seul critère qui la juge
 *
 * **MONTRER LES TROUS.** *« Un créneau libre doit se distinguer au premier coup
 * d'œil d'un créneau occupé, sinon l'écran ne sert à rien »* (demande
 * d'exploitation du 11/09/2026). Ce n'est pas une préférence d'affichage :
 * c'est la définition de l'écran. Une vue jour où l'on ne voit pas où caser
 * une urgence est une vue semaine en plus large.
 *
 * C'est pourquoi ce module compte les créneaux libres et rend le compte : *ce
 * qui n'est pas mesuré n'est pas tenu*, et « on voit bien les trous » est une
 * impression, pas une observation.
 *
 * ## Trois états par cellule, et JAMAIS deux
 *
 * **OCCUPÉ** — une intervention couvre ce créneau. **LIBRE** — l'agence ouvre
 * et personne n'est posé. **HORS OUVERTURE** — l'agence de cette colonne
 * n'ouvre pas à cette heure-là.
 *
 * Le troisième n'est pas un détail de confort : sans lui, 07:00 chez une agence
 * qui ouvre à 09:00 se lirait comme un trou à remplir. *Un écran qui invente
 * des créneaux disponibles est pire qu'un écran vide* — il fait promettre un
 * rendez-vous que l'agence ne peut pas tenir, ce que `parametrage.ts` refuse
 * déjà en amont sur les grilles de créneaux.
 *
 * **Et « hors ouverture » n'emploie PAS la trame du site fermé.** *Une trame
 * veut dire une seule chose* (règle rendue le 11/09/2026) : la hachure dit
 * « ce jour n'est pas ouvert » sur la vue semaine, et rien d'autre nulle part.
 * Ici l'heure hors calendrier est un aplat creux, distinct des deux autres
 * états et distinct de la hachure.
 *
 * ## L'AXE est l'UNION, et chaque colonne grise ce qui n'est pas à elle
 *
 * Quand les colonnes relèvent d'agences aux horaires différents — mesuré au
 * semis : Nouméa 07:30–11:30 et 13:00–17:00, le siège 09:00–12:30 et
 * 14:00–18:00 —, l'axe porte l'UNION des heures, et chaque colonne grise les
 * heures hors du calendrier de sa propre agence. Un axe par colonne ferait
 * perdre la seule chose qu'une vue jour apporte : la comparaison à la même
 * hauteur.
 *
 * **Le pas est le PLUS FIN des agences présentes.** Un pas plus grossier ferait
 * tomber une ouverture au milieu d'un créneau, et la moitié d'une cellule
 * serait vraie. Le pas reste réglé par agence dans `/parametres/agences` — il
 * n'est jamais écrit ici (I7).
 */

/** Une plage d'ouverture, en minutes locales depuis minuit. */
export type PlageDeJournee = {
  readonly debutMinutes: number;
  readonly finMinutes: number;
};

/** Ce qu'une agence apporte à la vue jour : ses heures et son pas. */
export type AgenceDeJournee = {
  readonly id: string;
  readonly libelle: string;
  /** Les plages du calendrier, tous jours de semaine confondus. */
  readonly plages: readonly (PlageDeJournee & {
    readonly jourSemaine: number;
  })[];
  readonly pasCreneauMinutes: number;
  readonly calendrierConnu: boolean;
};

/** Le minimum qu'une intervention doit porter pour entrer dans la journée. */
export type Occupante = {
  readonly id: string;
  readonly technicien_id: string | null;
  readonly agence_id: string;
  readonly creneau_debut: Date | null;
  readonly creneau_fin: Date | null;
  readonly duree_estimee_min: number | null;
};

export type EtatDeCellule = "occupe" | "libre" | "hors_ouverture";

export type CelluleDeJournee<T> = {
  readonly debutMinutes: number;
  readonly etat: EtatDeCellule;
  /** L'intervention qui occupe la cellule, `null` sinon. */
  readonly occupation: T | null;
  /** Vrai sur la PREMIÈRE cellule d'une intervention — le libellé n'y paraît qu'une fois. */
  readonly debutDeBloc: boolean;
};

export type ColonneDeJournee<T> = {
  readonly technicienId: string | null;
  readonly agences: readonly AgenceDeJournee[];
  readonly cellules: readonly CelluleDeJournee<T>[];
  /** Combien de créneaux cette personne a de libres, ce jour-là. */
  readonly creneauxLibres: number;
};

export type Journee<T> = {
  readonly jour: JourLocal;
  /** Les débuts de créneau de l'axe, en minutes locales, dans l'ordre. */
  readonly axe: readonly number[];
  readonly pasMinutes: number;
  readonly colonnes: readonly ColonneDeJournee<T>[];
  /** Le total des créneaux libres — la mesure d'utilité de l'écran. */
  readonly creneauxLibres: number;
};

/**
 * Construit la journée : l'axe, les colonnes, et le compte des trous.
 *
 * `minutesDe` traduit un instant en minutes locales depuis minuit — l'appelant
 * la fournit parce que le fuseau appartient à l'agence, et que ce module n'a
 * pas à le choisir (L0-08 : la date courante ne se lit qu'avec un fuseau).
 */
export function construireJournee<T extends Occupante>(
  lignes: readonly T[],
  jour: JourLocal,
  agences: readonly AgenceDeJournee[],
  minutesDe: (instant: Date) => number,
): Journee<T> {
  const iso = jourSemaineIso(jour);
  const presentes = agencesPresentes(lignes, agences);
  const ouvertes = presentes.filter((a) => a.calendrierConnu);

  const pasMinutes = Math.min(
    ...ouvertes.map((a) => a.pasCreneauMinutes),
    Number.POSITIVE_INFINITY,
  );
  const axe = construireAxe(ouvertes, iso, pasMinutes);

  const groupes = new Map<
    string,
    { technicienId: string | null; lignes: T[] }
  >();
  for (const ligne of lignes) {
    const cle = ligne.technicien_id ?? "";
    const groupe = groupes.get(cle) ?? {
      technicienId: ligne.technicien_id,
      lignes: [],
    };
    groupe.lignes.push(ligne);
    groupes.set(cle, groupe);
  }

  const parAgence = new Map(agences.map((a) => [a.id, a]));
  const colonnes = [...groupes.values()]
    .map((groupe) => {
      const siennes = [...new Set(groupe.lignes.map((l) => l.agence_id))]
        .map((id) => parAgence.get(id))
        .filter((a): a is AgenceDeJournee => a !== undefined)
        .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));

      const cellules = axe.map((debut) =>
        cellule(debut, pasMinutes, iso, siennes, groupe.lignes, minutesDe),
      );
      return {
        technicienId: groupe.technicienId,
        agences: siennes,
        cellules,
        creneauxLibres: cellules.filter((c) => c.etat === "libre").length,
      };
    })
    .sort(comparerColonnes);

  return {
    jour,
    axe,
    pasMinutes: Number.isFinite(pasMinutes) ? pasMinutes : 0,
    colonnes,
    creneauxLibres: colonnes.reduce((n, c) => n + c.creneauxLibres, 0),
  };
}

/**
 * Les agences que la journée met en jeu — celles des interventions du jour.
 *
 * Pas toutes celles de la société : un axe étiré sur une agence dont personne
 * ne travaille ce jour-là ajouterait des heures vides à toutes les colonnes,
 * et la mesure des trous deviendrait fausse dans le sens flatteur.
 */
function agencesPresentes<T extends Occupante>(
  lignes: readonly T[],
  agences: readonly AgenceDeJournee[],
): readonly AgenceDeJournee[] {
  const vues = new Set(lignes.map((l) => l.agence_id));
  return agences.filter((a) => vues.has(a.id));
}

/** L'axe : l'union des plages, découpée au pas le plus fin. */
function construireAxe(
  agences: readonly AgenceDeJournee[],
  iso: number,
  pasMinutes: number,
): number[] {
  if (!Number.isFinite(pasMinutes) || pasMinutes <= 0) return [];
  const bornes = agences.flatMap((a) =>
    a.plages.filter((p) => p.jourSemaine === iso),
  );
  if (bornes.length === 0) return [];
  const debut = Math.min(...bornes.map((p) => p.debutMinutes));
  const fin = Math.max(...bornes.map((p) => p.finMinutes));
  const axe: number[] = [];
  for (let m = debut; m + pasMinutes <= fin; m += pasMinutes) axe.push(m);
  return axe;
}

function cellule<T extends Occupante>(
  debut: number,
  pas: number,
  iso: number,
  agences: readonly AgenceDeJournee[],
  lignes: readonly T[],
  minutesDe: (instant: Date) => number,
): CelluleDeJournee<T> {
  const occupation =
    lignes.find((l) => couvre(l, debut, pas, minutesDe)) ?? null;
  if (occupation !== undefined && occupation !== null) {
    return {
      debutMinutes: debut,
      etat: "occupe",
      occupation,
      debutDeBloc: !couvre(occupation, debut - pas, pas, minutesDe),
    };
  }
  const ouvert = agences.some(
    (a) =>
      a.calendrierConnu &&
      a.plages.some(
        (p) =>
          p.jourSemaine === iso &&
          debut >= p.debutMinutes &&
          debut + pas <= p.finMinutes,
      ),
  );
  return {
    debutMinutes: debut,
    etat: ouvert ? "libre" : "hors_ouverture",
    occupation: null,
    debutDeBloc: false,
  };
}

/**
 * Cette intervention couvre-t-elle le créneau ?
 *
 * Sans `creneau_debut`, elle ne couvre RIEN : une intervention datée sans heure
 * appartient au jour, pas à une heure. La placer arbitrairement à l'ouverture
 * lui donnerait un créneau que personne n'a saisi, et la vue jour prétendrait
 * savoir ce qu'elle ne sait pas.
 */
function couvre<T extends Occupante>(
  ligne: T,
  debut: number,
  pas: number,
  minutesDe: (instant: Date) => number,
): boolean {
  if (ligne.creneau_debut === null) return false;
  const d = minutesDe(ligne.creneau_debut);
  const f =
    ligne.creneau_fin !== null
      ? minutesDe(ligne.creneau_fin)
      : d + (ligne.duree_estimee_min ?? pas);
  return debut < f && debut + pas > d;
}

function comparerColonnes<T>(
  a: ColonneDeJournee<T>,
  b: ColonneDeJournee<T>,
): number {
  if (a.technicienId === null && b.technicienId !== null) return -1;
  if (a.technicienId !== null && b.technicienId === null) return 1;
  return (a.technicienId ?? "").localeCompare(b.technicienId ?? "");
}

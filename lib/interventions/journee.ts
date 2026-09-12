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

/** Une intervention posée dans une cellule, et sa place dans son propre bloc. */
export type BlocDeCellule<T> = {
  readonly ligne: T;
  /** Vrai sur la PREMIÈRE cellule d'une intervention — le libellé n'y paraît qu'une fois. */
  readonly debutDeBloc: boolean;
};

/**
 * POURQUOI UNE INTERVENTION N'EST PAS DESSINÉE — et jamais pourquoi elle est
 * absente : elle ne l'est plus.
 *
 * `sans_creneau` — datée, sans heure. Elle appartient au JOUR et à aucune
 * heure ; lui en donner une lui donnerait un créneau que personne n'a saisi.
 * `hors_axe` — un créneau posé avant l'ouverture ou après la fermeture des
 * agences présentes. L'axe ne va pas jusque-là, et l'étirer ferait apparaître
 * des heures libres qu'aucune agence n'ouvre.
 */
export type MotifHorsGrille = "sans_creneau" | "hors_axe";

export type LigneHorsGrille<T> = {
  readonly ligne: T;
  readonly motif: MotifHorsGrille;
};

export type CelluleDeJournee<T> = {
  readonly debutMinutes: number;
  readonly etat: EtatDeCellule;
  /**
   * TOUTES les interventions qui couvrent la cellule, jamais la première.
   *
   * Elle n'en portait qu'une — un `.find()` —, et **la seconde disparaissait
   * sans trace** : deux interventions qui se chevauchent chez la même personne
   * donnaient « 3 en vue semaine, 1 en vue jour ». Or c'est exactement le cas
   * qu'un planificateur doit voir : *un chevauchement caché fait poser une
   * troisième personne sur un créneau déjà doublé.* Le chevauchement est
   * refusé à la POSE (RG-PLA, `pose.ts`), mais la base en porte d'antérieurs,
   * et une vue qui les masque les rend indétectables.
   */
  readonly occupations: readonly BlocDeCellule<T>[];
};

export type ColonneDeJournee<T> = {
  readonly technicienId: string | null;
  readonly agences: readonly AgenceDeJournee[];
  readonly cellules: readonly CelluleDeJournee<T>[];
  /** Combien de créneaux cette personne a de libres, ce jour-là. */
  readonly creneauxLibres: number;
  /**
   * Ce que cette colonne NE PEUT PAS dessiner, et qu'elle DIT.
   *
   * *Une intervention qui ne peut pas être dessinée doit être dite, jamais
   * effacée* : sans cette liste, une ligne datée sans heure et une ligne posée
   * hors des heures d'ouverture sortaient de l'écran en silence.
   */
  readonly horsGrille: readonly LigneHorsGrille<T>[];
};

export type Journee<T> = {
  readonly jour: JourLocal;
  /** Les débuts de créneau de l'axe, en minutes locales, dans l'ordre. */
  readonly axe: readonly number[];
  readonly pasMinutes: number;
  readonly colonnes: readonly ColonneDeJournee<T>[];
  /** Le total des créneaux libres — la mesure d'utilité de l'écran. */
  readonly creneauxLibres: number;
  /** Le total des interventions non dessinables — jamais un zéro tu. */
  readonly horsGrille: number;
};

/**
 * UNE PERSONNE DU RÉFÉRENTIEL — ce qui donne à l'écran ses colonnes.
 *
 * **Les colonnes ne viennent plus des interventions**, et c'est la réparation
 * du 12/09/2026. Elles en venaient, si bien qu'*un technicien dont la journée
 * est entièrement libre n'avait aucune colonne* — c'est-à-dire, sur un écran
 * dont l'objet déclaré est de MONTRER LES TROUS, la personne qu'il fallait
 * montrer en premier. La mesure des trous était fausse dans le sens flatteur :
 * elle ne comptait que les trous des gens déjà occupés.
 */
export type TechnicienDeJournee = {
  readonly id: string;
  /** Ses agences de rattachement — elles décident du grisé hors ouverture. */
  readonly agenceIds: readonly string[];
};

/**
 * Construit la journée : l'axe, les colonnes, et le compte des trous.
 *
 * `minutesDe` traduit un instant en minutes locales depuis minuit — l'appelant
 * la fournit parce que le fuseau appartient à l'agence, et que ce module n'a
 * pas à le choisir (L0-08 : la date courante ne se lit qu'avec un fuseau).
 *
 * **Elle reçoit l'AGENCE de la ligne, et c'est une réparation du 12/09/2026.**
 * Elle ne la recevait pas, si bien que l'appelant traduisait tout au fuseau de
 * la SOCIÉTÉ — quand l'écriture, elle, emploie `fuseauDeLAgence`
 * (`lib/interventions/depot.ts`). *Deux lectures d'un même critère divergent en
 * silence* (§9, 01/09), et celle-ci divergeait dès qu'une agence porte un
 * fuseau propre : un créneau posé à 8 h se relisait à une autre heure.
 */
export function construireJournee<T extends Occupante>(
  lignes: readonly T[],
  jour: JourLocal,
  agences: readonly AgenceDeJournee[],
  minutesDe: (instant: Date, agenceId: string) => number,
  techniciens: readonly TechnicienDeJournee[] = [],
): Journee<T> {
  const iso = jourSemaineIso(jour);
  const parAgence = new Map(agences.map((a) => [a.id, a]));

  // ── LES COLONNES, ET D'OÙ ELLES VIENNENT ────────────────────────────────
  //
  // Du RÉFÉRENTIEL d'abord — c'est ce qui donne une colonne à qui n'a rien ce
  // jour-là. Puis des interventions, pour deux cas qu'un référentiel ne couvre
  // pas : la file NON AFFECTÉE (`technicien_id` nul), et la personne posée sur
  // une intervention sans être au référentiel. *Perdre une ligne pour la faire
  // rentrer dans un référentiel serait remplacer une disparition par une
  // autre.*
  const groupes = new Map<
    string,
    { technicienId: string | null; agenceIds: Set<string>; lignes: T[] }
  >();
  for (const technicien of techniciens) {
    groupes.set(technicien.id, {
      technicienId: technicien.id,
      agenceIds: new Set(technicien.agenceIds),
      lignes: [],
    });
  }
  for (const ligne of lignes) {
    const cle = ligne.technicien_id ?? "";
    const groupe = groupes.get(cle) ?? {
      technicienId: ligne.technicien_id,
      agenceIds: new Set<string>(),
      lignes: [],
    };
    groupe.agenceIds.add(ligne.agence_id);
    groupe.lignes.push(ligne);
    groupes.set(cle, groupe);
  }

  const presentes = agencesPresentes(groupes.values(), agences);
  const ouvertes = presentes.filter((a) => a.calendrierConnu);

  const pasMinutes = Math.min(
    ...ouvertes.map((a) => a.pasCreneauMinutes),
    Number.POSITIVE_INFINITY,
  );
  const axe = construireAxe(ouvertes, iso, pasMinutes);

  const colonnes: ColonneDeJournee<T>[] = [...groupes.values()]
    .map((groupe) => {
      const siennes = [...groupe.agenceIds]
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
        horsGrille: horsGrille(groupe.lignes, axe, pasMinutes, minutesDe),
      };
    })
    .sort(comparerColonnes);

  return {
    jour,
    axe,
    pasMinutes: Number.isFinite(pasMinutes) ? pasMinutes : 0,
    colonnes,
    creneauxLibres: colonnes.reduce((n, c) => n + c.creneauxLibres, 0),
    horsGrille: colonnes.reduce((n, c) => n + c.horsGrille.length, 0),
  };
}

/**
 * Les agences que la journée met en jeu — celles des colonnes affichées.
 *
 * Pas toutes celles de la société : un axe étiré sur une agence dont personne
 * ne travaille ce jour-là ajouterait des heures vides à toutes les colonnes,
 * et la mesure des trous deviendrait fausse dans le sens flatteur.
 *
 * **Elle se lit désormais sur les COLONNES et non sur les interventions** : une
 * personne libre toute la journée n'a aucune intervention, et son agence doit
 * pourtant porter l'axe — sinon la colonne qu'on vient de lui rendre n'aurait
 * aucune heure où montrer ses trous.
 */
function agencesPresentes(
  groupes: Iterable<{ readonly agenceIds: ReadonlySet<string> }>,
  agences: readonly AgenceDeJournee[],
): readonly AgenceDeJournee[] {
  const vues = new Set<string>();
  for (const groupe of groupes) for (const id of groupe.agenceIds) vues.add(id);
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

/**
 * CE QUE LA COLONNE NE PEUT PAS DESSINER, avec son motif.
 *
 * La population est l'ENSEMBLE des lignes de la colonne, et l'appartenance à
 * l'axe est une ASSERTION — jamais un critère de sélection. *Sélectionner « les
 * lignes qui ont un créneau dans l'axe » ferait sortir de la population très
 * exactement les lignes que cette fonction existe pour nommer* (§9, 31/08 : un
 * `WHERE` qui recoupe l'assertion est un trou).
 */
function horsGrille<T extends Occupante>(
  lignes: readonly T[],
  axe: readonly number[],
  pas: number,
  minutesDe: (instant: Date, agenceId: string) => number,
): readonly LigneHorsGrille<T>[] {
  const rendues: LigneHorsGrille<T>[] = [];
  for (const ligne of lignes) {
    if (ligne.creneau_debut === null) {
      rendues.push({ ligne, motif: "sans_creneau" });
      continue;
    }
    if (!axe.some((debut) => couvre(ligne, debut, pas, minutesDe))) {
      rendues.push({ ligne, motif: "hors_axe" });
    }
  }
  return rendues;
}

function cellule<T extends Occupante>(
  debut: number,
  pas: number,
  iso: number,
  agences: readonly AgenceDeJournee[],
  lignes: readonly T[],
  minutesDe: (instant: Date, agenceId: string) => number,
): CelluleDeJournee<T> {
  // `filter`, et non `find` : voir `CelluleDeJournee.occupations`. La grille
  // hebdomadaire les empile toutes depuis toujours, et c'est l'écart entre les
  // deux qui produisait « 3 en vue semaine, 1 en vue jour ».
  const occupations = lignes
    .filter((l) => couvre(l, debut, pas, minutesDe))
    .map((ligne) => ({
      ligne,
      debutDeBloc: !couvre(ligne, debut - pas, pas, minutesDe),
    }));
  if (occupations.length > 0) {
    return { debutMinutes: debut, etat: "occupe", occupations };
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
    occupations: [],
  };
}

/**
 * Cette intervention couvre-t-elle le créneau ?
 *
 * Sans `creneau_debut`, elle ne couvre RIEN : une intervention datée sans heure
 * appartient au jour, pas à une heure. La placer arbitrairement à l'ouverture
 * lui donnerait un créneau que personne n'a saisi, et la vue jour prétendrait
 * savoir ce qu'elle ne sait pas. **Elle est alors rendue par `horsGrille`, avec
 * son motif** — c'est ce qui la distingue d'une ligne effacée.
 */
function couvre<T extends Occupante>(
  ligne: T,
  debut: number,
  pas: number,
  minutesDe: (instant: Date, agenceId: string) => number,
): boolean {
  if (ligne.creneau_debut === null) return false;
  // Le fuseau est celui de l'agence DE LA LIGNE — c'est lui qui a servi à
  // l'écrire (`fuseauDeLAgence`), et le relire sous un autre décalerait le bloc.
  const d = minutesDe(ligne.creneau_debut, ligne.agence_id);
  const f =
    ligne.creneau_fin !== null
      ? minutesDe(ligne.creneau_fin, ligne.agence_id)
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

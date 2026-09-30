import { absenceCouvrant, type AbsenceDeclaree } from "@/lib/absences/periode";
import type { Calendrier } from "@/lib/calendar/calendrier";
import { instantDuJour, type JourLocal } from "@/lib/calendar/fuseau";
import { plagesDuJour } from "@/lib/calendar/ouverture";
import { comparerLignes } from "./grille";

/**
 * LA VUE JOUR — UNE FRISE HORIZONTALE, les personnes en LIGNES, les heures en
 * COLONNES (QG-3/D142, 30/09/2026 — amende l'orientation posée le 11/09/2026,
 * jamais son objet ni ses quatre états, inchangés ci-dessous).
 *
 * **Ce que « colonne » désigne dans ce module n'a pas changé de sens à cette
 * réécriture** : `ColonneDeJournee` reste la donnée d'UNE PERSONNE sur la
 * journée — neuf fichiers de tests la lisent, et la donnée elle-même ne
 * dépend pas de l'orientation à l'écran. C'est l'écran qui la dessine
 * désormais EN LIGNE, jamais ce module qui la renommerait en silence.
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
 * ## Quatre états par cellule, et JAMAIS deux
 *
 * **OCCUPÉ** — une intervention couvre ce créneau. **LIBRE** — l'agence ouvre
 * et personne n'est posé. **HORS OUVERTURE** — l'agence de cette colonne
 * n'ouvre pas à cette heure-là. **BLOQUÉ** — l'agenda de cette personne est
 * bloqué ce jour-là (RG-PLA-06 ; PLANNING-1, 22/09/2026).
 *
 * *Le quatrième état a été ajouté après mesure* : la colonne d'un technicien
 * absent dessinait seize créneaux LIBRES et les COMPTAIT parmi les trous — sur
 * l'écran dont l'objet déclaré est de montrer les trous —, et le refus
 * n'arrivait qu'au dépôt, après le geste. *« Une absence validée bloque le
 * créneau »* : un créneau bloqué n'est pas un trou, il ne se compte pas. Le
 * critère est celui du refus, `absenceCouvrant` (`lib/absences/periode.ts`),
 * et lui seul (§9, 01/09). Une cellule OCCUPÉE d'une colonne bloquée reste
 * occupée — une clôturée a eu lieu (I5) — ; toutes les autres sont BLOQUÉES,
 * l'heure d'ouverture n'ayant plus rien à dire sur un jour où la personne
 * n'est pas là.
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
 *
 * ## LA FRISE DESSINE UNE INTERVENTION UNE SEULE FOIS, EN LARGEUR
 *
 * L'ancienne vue en colonnes répétait un lien dans chaque cellule couverte
 * (une intervention de deux heures y dessinait quatre liens identiques, un
 * par créneau de 30 minutes). La frise dessine chaque intervention UNE SEULE
 * FOIS, à l'échelle de sa durée : `ColonneDeJournee.blocs`
 * (`blocsDeLaLigne`) porte, par intervention, sa position et sa largeur dans
 * l'axe — en nombre de colonnes, les colonnes de l'axe étant de largeur égale
 * — et son rang de chevauchement, pour que deux blocs qui se recouvrent dans
 * le temps ne s'effacent jamais l'un l'autre.
 */

/** Ce qu'une agence apporte à la vue jour : son calendrier et son pas. */
export type AgenceDeJournee = {
  readonly id: string;
  readonly libelle: string;
  /**
   * Le calendrier COMPLET de l'agence — fériés, ponts et exceptions compris
   * (PG-A1-FERIES-GRILLE) : les plages d'un jour précis se lisent avec
   * `plagesDuJour(calendrier, jour)`, jamais avec son seul jour de semaine.
   * `null` veut dire « inconnu », jamais « fermé ».
   */
  readonly calendrier: Calendrier | null;
  readonly pasCreneauMinutes: number;
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

export type EtatDeCellule = "occupe" | "libre" | "hors_ouverture" | "bloque";

/**
 * CE QUE LES VISITES SANS HEURE PÈSENT SUR LA JOURNÉE — et que
 * `creneauxLibres` ne dit pas (75-PLANNING-5, SAV-06).
 *
 * *Mesuré sur `main` le 25/09/2026 : une journée où un technicien porte une
 * visite sans heure de trois heures affichait « 16 créneaux libres » — le
 * même compte qu'une journée réellement vide, parce que `sansHeure` ne
 * retire aucun créneau de l'axe.* Le chef d'atelier lisait « libre » et
 * ajoutait du travail sur une journée déjà engagée.
 *
 * `creneauxLibres` reste inchangé à dessein : on n'invente pas où caser une
 * visite sans heure. `aCaler` est une mesure SÉPARÉE, à lire À CÔTÉ du
 * compte de trous, jamais à sa place.
 *
 * `sansDuree` compte les visites dont `duree_estimee_min` est nul — elles
 * n'ajoutent RIEN à `minutesConnues` : un zéro écrit se lirait comme une
 * mesure, et il n'y en a pas à faire.
 */
export type ACaler = {
  readonly nombre: number;
  readonly minutesConnues: number;
  readonly sansDuree: number;
};

/** Une intervention posée dans une cellule, et sa place dans son propre bloc. */
export type BlocDeCellule<T> = {
  readonly ligne: T;
  /** Vrai sur la PREMIÈRE cellule d'une intervention — le libellé n'y paraît qu'une fois. */
  readonly debutDeBloc: boolean;
};

/**
 * POURQUOI UNE INTERVENTION N'EST PAS DESSINÉE DANS L'AXE — et jamais pourquoi
 * elle est absente : elle ne l'est plus.
 *
 * `hors_axe` — un créneau posé avant l'ouverture ou après la fermeture des
 * agences présentes. L'axe ne va pas jusque-là, et l'étirer ferait apparaître
 * des heures libres qu'aucune agence n'ouvre.
 *
 * **`sans_creneau` a quitté cette liste (AFFICHAGE-MATERIEL-1, 23/09/2026)** :
 * une intervention datée sans heure appartient au JOUR de son technicien, et
 * elle se dessine désormais DANS sa colonne — `ColonneDeJournee.sansHeure`,
 * une ligne « Heure à fixer » (libellé de la décision d'Alexis du
 * 30/09/2026, point 3 ; D147 — « Journée — heure non fixée » avant elle)
 * posée en tête de grille — jamais plus SEULEMENT sous elle. *Mesuré le
 * 23/09/2026 en production : quatre
 * interventions du jour, reléguées sous la grille, se lisaient comme
 * absentes.*
 */
export type MotifHorsGrille = "hors_axe";

export type LigneHorsGrille<T> = {
  readonly ligne: T;
  readonly motif: MotifHorsGrille;
};

/**
 * UN BLOC PLACÉ SUR LA FRISE (QG-3/D142) — ce que `blocsDeLaLigne` rend pour
 * UNE intervention, jamais pour une cellule : la frise dessine chaque
 * intervention UNE SEULE FOIS, en largeur, plutôt que de répéter un lien dans
 * chaque case qu'elle couvre (l'ancienne vue en colonnes, remplacée par
 * QG-3).
 */
export type BlocDeLigne<T> = {
  readonly ligne: T;
  /** Début RÉEL, en minutes locales — non borné à l'axe (voir `couvre`/`finDe`). */
  readonly debutMinutes: number;
  /** Fin RÉELLE, même règle que `couvre` — non bornée à l'axe. */
  readonly finMinutes: number;
  /**
   * INDEX, DANS L'AXE, DE LA PREMIÈRE COLONNE COUVERTE — BORNÉ au premier pas
   * de l'axe : un début antérieur à l'ouverture ne peut pas se dessiner avant
   * la première colonne.
   */
  readonly colonneDebut: number;
  /**
   * NOMBRE DE COLONNES COUVERTES, AU MOINS 1 — BORNÉ au dernier pas + un pas :
   * les colonnes de l'axe sont de largeur égale, donc ce compte équivaut à une
   * fraction de la largeur totale, et se consomme directement par le CSS de
   * la frise (`calc(n * 100%)`) sans recalcul.
   */
  readonly nombreDeColonnes: number;
  /**
   * RANG DE CHEVAUCHEMENT — deux blocs qui se chevauchent dans le temps n'ont
   * JAMAIS le même rang, et aucun des deux ne cache l'autre (voir le docblock
   * de `CelluleDeJournee.occupations`, le même principe que la frise hérite).
   * Affecté par un algorithme glouton classique (intervalles triés par début,
   * premier rang libre).
   */
  readonly rang: number;
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
  /**
   * L'agenda de cette personne est-il BLOQUÉ ce jour-là (RG-PLA-06) ? Décidé
   * par `absenceCouvrant`, jamais ici. `false` pour la file d'attente, et
   * `false` quand aucun blocage n'est fourni — le défaut affirme le moins.
   */
  readonly bloquee: boolean;
  readonly cellules: readonly CelluleDeJournee<T>[];
  /** Combien de créneaux cette personne a de libres, ce jour-là. */
  readonly creneauxLibres: number;
  /**
   * LES INTERVENTIONS DE CETTE PERSONNE, CE JOUR-LÀ, SANS HEURE SAISIE.
   *
   * Elles appartiennent au JOUR, à aucun créneau : l'axe ne peut pas les
   * dessiner sans inventer une heure que personne n'a saisie. **Elles restent
   * pourtant DANS la colonne** — une ligne « Heure à fixer » (D147) en tête
   * de grille, jamais reléguée hors d'elle (AFFICHAGE-MATERIEL-1).
   */
  readonly sansHeure: readonly T[];
  /** Ce que `sansHeure` pèse sur cette colonne — voir `ACaler` ci-dessus. */
  readonly aCaler: ACaler;
  /**
   * Ce que cette colonne NE PEUT PAS dessiner DANS L'AXE, et qu'elle DIT.
   *
   * *Une intervention qui ne peut pas être dessinée doit être dite, jamais
   * effacée* : sans cette liste, une ligne posée hors des heures d'ouverture
   * sortait de l'écran en silence. La ligne SANS HEURE n'y entre plus depuis
   * AFFICHAGE-MATERIEL-1 — voir `sansHeure` ci-dessus.
   */
  readonly horsGrille: readonly LigneHorsGrille<T>[];
  /**
   * LA GÉOMÉTRIE DE LA FRISE (QG-3/D142, 30/09/2026) — une entrée par
   * intervention de cette ligne, jamais une par cellule couverte : voir
   * `blocsDeLaLigne`.
   */
  readonly blocs: readonly BlocDeLigne<T>[];
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
  /** Ce que `sansHeure` pèse sur la journée entière — somme des colonnes. */
  readonly aCaler: ACaler;
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
  absences: readonly AbsenceDeclaree[] = [],
  // L'ORDRE UNIQUE DES TECHNICIENS (PG-A2-ORDRE-TECHNICIENS, 28/09/2026) :
  // même comparateur que la grille Semaine (`comparerLignes`), jamais une
  // seconde règle de tri qui diverge en silence (§9, 01/09) — voir son
  // docblock dans `grille.ts`.
  libelleDe: (technicienId: string) => string | null = () => null,
): Journee<T> {
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
  const ouvertes = presentes.filter((a) => a.calendrier !== null);

  const pasMinutes = Math.min(
    ...ouvertes.map((a) => a.pasCreneauMinutes),
    Number.POSITIVE_INFINITY,
  );
  const axe = construireAxe(ouvertes, jour, pasMinutes);

  const colonnes: ColonneDeJournee<T>[] = [...groupes.values()]
    .map((groupe) => {
      const siennes = [...groupe.agenceIds]
        .map((id) => parAgence.get(id))
        .filter((a): a is AgenceDeJournee => a !== undefined)
        .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));

      // `instantDuJour` rend minuit UTC, la forme même de `date_planifiee`
      // (`@db.Date`) que `absenceCouvrant` compare au jour civil des bornes.
      const bloquee =
        groupe.technicienId !== null &&
        absenceCouvrant(absences, groupe.technicienId, instantDuJour(jour)) !==
          null;
      const cellules = axe.map((debut) =>
        cellule(
          debut,
          pasMinutes,
          jour,
          siennes,
          groupe.lignes,
          minutesDe,
          bloquee,
        ),
      );
      const sansHeure = groupe.lignes.filter((l) => l.creneau_debut === null);
      return {
        technicienId: groupe.technicienId,
        agences: siennes,
        bloquee,
        cellules,
        creneauxLibres: cellules.filter((c) => c.etat === "libre").length,
        sansHeure,
        aCaler: aCalerDe(sansHeure),
        horsGrille: horsGrille(groupe.lignes, axe, pasMinutes, minutesDe),
        blocs: blocsDeLaLigne({ cellules }, axe, pasMinutes, minutesDe),
      };
    })
    .sort((a, b) => comparerLignes(a, b, libelleDe));

  return {
    jour,
    axe,
    pasMinutes: Number.isFinite(pasMinutes) ? pasMinutes : 0,
    colonnes,
    creneauxLibres: colonnes.reduce((n, c) => n + c.creneauxLibres, 0),
    horsGrille: colonnes.reduce((n, c) => n + c.horsGrille.length, 0),
    aCaler: {
      nombre: colonnes.reduce((n, c) => n + c.aCaler.nombre, 0),
      minutesConnues: colonnes.reduce((n, c) => n + c.aCaler.minutesConnues, 0),
      sansDuree: colonnes.reduce((n, c) => n + c.aCaler.sansDuree, 0),
    },
  };
}

/** Ce que les visites sans heure d'une colonne pèsent — voir `ACaler`. */
function aCalerDe<T extends Occupante>(sansHeure: readonly T[]): ACaler {
  let minutesConnues = 0;
  let sansDuree = 0;
  for (const ligne of sansHeure) {
    if (ligne.duree_estimee_min === null) {
      sansDuree += 1;
    } else {
      minutesConnues += ligne.duree_estimee_min;
    }
  }
  return { nombre: sansHeure.length, minutesConnues, sansDuree };
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

/**
 * L'axe : l'union des plages DE CE JOUR PRÉCIS, découpée au pas le plus fin.
 *
 * **Les plages viennent de `plagesDuJour`, importée, jamais recopiée**
 * (PG-A1-FERIES-GRILLE, CA-1) : un férié chômé n'a AUCUNE plage, et un férié
 * travaillé retrouve celles de son jour de semaine — c'est `plagesDuJour` qui
 * tranche, jamais un jour de semaine relu ici.
 */
function construireAxe(
  agences: readonly AgenceDeJournee[],
  jour: JourLocal,
  pasMinutes: number,
): number[] {
  if (!Number.isFinite(pasMinutes) || pasMinutes <= 0) return [];
  const bornes = agences.flatMap((a) =>
    a.calendrier === null ? [] : plagesDuJour(a.calendrier, jour),
  );
  if (bornes.length === 0) return [];
  const debut = Math.min(...bornes.map((p) => p.debut_minutes));
  const fin = Math.max(...bornes.map((p) => p.fin_minutes));
  const axe: number[] = [];
  for (let m = debut; m + pasMinutes <= fin; m += pasMinutes) axe.push(m);
  return axe;
}

/**
 * CE QUE LA COLONNE NE PEUT PAS DESSINER DANS L'AXE, avec son motif.
 *
 * La population est l'ENSEMBLE des lignes AVEC un créneau — celles sans
 * créneau sont retenues par `sansHeure`, jamais par cette fonction depuis
 * AFFICHAGE-MATERIEL-1 — et l'appartenance à l'axe est une ASSERTION, jamais
 * un critère de sélection. *Sélectionner « les lignes qui ont un créneau dans
 * l'axe » ferait sortir de la population très exactement les lignes que
 * cette fonction existe pour nommer* (§9, 31/08 : un `WHERE` qui recoupe
 * l'assertion est un trou).
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
  jour: JourLocal,
  agences: readonly AgenceDeJournee[],
  lignes: readonly T[],
  minutesDe: (instant: Date, agenceId: string) => number,
  bloquee: boolean,
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
  // BLOQUÉ prime sur libre ET sur hors ouverture : sur un jour où la personne
  // n'est pas là, l'heure d'ouverture ne dit plus rien — voir l'entête.
  if (bloquee) {
    return { debutMinutes: debut, etat: "bloque", occupations: [] };
  }
  const ouvert = agences.some(
    (a) =>
      a.calendrier !== null &&
      plagesDuJour(a.calendrier, jour).some(
        (p) => debut >= p.debut_minutes && debut + pas <= p.fin_minutes,
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
  const f = finDe(ligne, d, pas, minutesDe);
  return debut < f && debut + pas > d;
}

/**
 * LA FIN D'UNE OCCUPATION, EN MINUTES LOCALES — partagée par `couvre` et
 * `blocsDeLaLigne` (QG-3/D142) : une fin qui se recalculerait à deux endroits
 * divergerait en silence dès que l'un des deux oublie le repli sur la durée
 * estimée (§9, 01/09).
 */
function finDe<T extends Occupante>(
  ligne: T,
  debutMinutes: number,
  pas: number,
  minutesDe: (instant: Date, agenceId: string) => number,
): number {
  return ligne.creneau_fin !== null
    ? minutesDe(ligne.creneau_fin, ligne.agence_id)
    : debutMinutes + (ligne.duree_estimee_min ?? pas);
}

/**
 * LA GÉOMÉTRIE DE LA FRISE (QG-3/D142, 30/09/2026) — une entrée PAR
 * INTERVENTION de la ligne, jamais par cellule couverte : voir `BlocDeLigne`.
 *
 * La population vient des cellules déjà construites (`debutDeBloc` marque la
 * PREMIÈRE cellule couverte par chaque intervention) plutôt que d'une seconde
 * lecture des lignes brutes — deux lectures d'un même critère divergeraient en
 * silence (§9, 01/09), et `debutDeBloc` porte déjà la règle exacte
 * (`couvre`) qui décide si une intervention entre dans l'axe.
 *
 * **Le rang de chevauchement** est affecté par un algorithme glouton
 * classique (intervalles triés par début, premier rang dont le dernier bloc
 * affecté se termine avant que celui-ci ne commence) : deux blocs qui se
 * chevauchent dans le temps n'ont jamais le même rang, et aucun des deux ne
 * cache l'autre.
 */
export function blocsDeLaLigne<T extends Occupante>(
  colonne: { readonly cellules: readonly CelluleDeJournee<T>[] },
  axe: readonly number[],
  pas: number,
  minutesDe: (instant: Date, agenceId: string) => number,
): readonly BlocDeLigne<T>[] {
  if (axe.length === 0) return [];
  const axeDebut = axe[0];
  const axeFin = axe[axe.length - 1] + pas;

  const lignes: T[] = [];
  const vues = new Set<string>();
  for (const cellule of colonne.cellules) {
    for (const occupation of cellule.occupations) {
      if (occupation.debutDeBloc && !vues.has(occupation.ligne.id)) {
        vues.add(occupation.ligne.id);
        lignes.push(occupation.ligne);
      }
    }
  }

  const bruts = lignes
    .map((ligne) => {
      // `creneau_debut` est forcément connu ici : `debutDeBloc` ne peut être
      // vrai que si `couvre` a répondu vrai au moins une fois, et `couvre`
      // rend toujours faux sans `creneau_debut` (voir plus haut).
      const debutMinutes = minutesDe(ligne.creneau_debut!, ligne.agence_id);
      const finMinutes = finDe(ligne, debutMinutes, pas, minutesDe);
      return {
        ligne,
        debutMinutes,
        finMinutes,
        debutBorne: Math.max(debutMinutes, axeDebut),
        finBorne: Math.min(finMinutes, axeFin),
      };
    })
    .sort((a, b) => a.debutBorne - b.debutBorne);

  const finParRang: number[] = [];
  return bruts.map((bloc) => {
    let rang = finParRang.findIndex((fin) => fin <= bloc.debutBorne);
    if (rang === -1) {
      rang = finParRang.length;
    }
    finParRang[rang] = bloc.finBorne;
    return {
      ligne: bloc.ligne,
      debutMinutes: bloc.debutMinutes,
      finMinutes: bloc.finMinutes,
      colonneDebut: Math.round((bloc.debutBorne - axeDebut) / pas),
      nombreDeColonnes: Math.max(
        1,
        Math.round((bloc.finBorne - bloc.debutBorne) / pas),
      ),
      rang,
    };
  });
}

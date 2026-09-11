import { cleJour, type JourLocal } from "@/lib/calendar/fuseau";
import { jourSemaineIso } from "@/lib/calendar/semaine";

/**
 * LA GRILLE DU PLANNING — techniciens en lignes, jours en colonnes (D95).
 *
 * ## Ce que ce module fait, et pourquoi il n'est pas dans l'écran
 *
 * Il RANGE des interventions déjà lues dans des cases. Il n'ouvre aucune
 * transaction, ne lit aucune base, ne connaît aucun contexte de société : tout
 * ce qu'il reçoit a été lu sous le cloisonnement par l'appelant. *Aucune
 * comparaison de société n'est donc écrite ici — ce serait une seconde lecture
 * d'un critère que la politique porte déjà (§9, 01/09).*
 *
 * Il est séparé de l'écran pour qu'on puisse l'éprouver sans rendre du JSX : la
 * question « cette intervention tombe-t-elle dans la bonne case ? » est une
 * question de calcul, et elle a des cas limites — une intervention sans
 * technicien, une sans date, une hors de la semaine affichée.
 *
 * ## LA MAILLE EST LE COUPLE (technicien, agence), et ce n'est pas un détail
 *
 * C'est la même maille que `occupation.ts`, et pour la même raison : I7 veut
 * qu'un calendrier appartienne à une AGENCE — *Ducos ouvre du lundi au samedi,
 * Koné du lundi au vendredi* —, si bien qu'un technicien qui intervient pour
 * deux agences n'a pas un calendrier mais deux. Une ligne par technicien seul
 * aurait à choisir lequel griser le samedi, et le choix aurait basculé d'une
 * semaine à l'autre.
 *
 * *La maquette dit la même chose sans la nommer : son en-tête de ligne porte
 * « D. Guérin » ET « Ducos » sur deux lignes.*
 *
 * ## CE QUE CE MODULE NE SAIT PAS FAIRE, et qui est une DONNÉE MANQUANTE
 *
 * **Il ne sait pas nommer un technicien.** La maquette écrit « D. Guérin
 * · Ducos · Compresseurs, ponts » ; le dépôt n'a ni la table `technicien` du
 * chapitre 11 — marquée `(prévu)` au CLAUDE.md §6 — ni aucune colonne portant
 * une spécialité. `intervention.technicien_id` est un identifiant d'utilisateur,
 * et `utilisateur` porte la forme de politique « désignation » : il ne se lit
 * qu'en NOMMANT sa ligne, une par une.
 *
 * Ce module rend donc l'identifiant, et l'écran l'abrège — exactement ce que
 * `statistiques.tsx` fait déjà. *Inventer un libellé serait inventer une
 * donnée* (§8). Le ticket qui le répare est inscrit au backlog.
 */

/** Le minimum qu'une intervention doit porter pour entrer dans la grille. */
export type Posable = {
  readonly id: string;
  readonly technicien_id: string | null;
  readonly agence_id: string;
  readonly date_planifiee: Date | null;
};

/** Ce qu'une agence apporte à la grille : son nom, et ses jours d'ouverture. */
export type AgenceDeGrille = {
  readonly id: string;
  readonly libelle: string;
  /**
   * Jours ISO ouverts (1 = lundi). **Vide veut dire « inconnu », jamais
   * « fermé »** : une agence sans calendrier n'a pas d'ouverture CONNUE, et
   * grisée partout elle se lirait comme une agence fermée toute la semaine.
   * C'est la même distinction que `tauxOccupation`, qui rend `null` plutôt que
   * 0 % quand le dénominateur manque.
   */
  readonly joursOuverts: readonly number[];
  readonly calendrierConnu: boolean;
};

export type CaseDeGrille<T extends Posable> = {
  readonly jour: JourLocal;
  /** L'agence ouvre-t-elle ce jour-là ? `null` quand nul ne le sait. */
  readonly ouverte: boolean | null;
  readonly lignes: readonly T[];
};

export type LigneDeGrille<T extends Posable> = {
  readonly technicienId: string | null;
  readonly agenceId: string;
  readonly agenceLibelle: string;
  readonly cases: readonly CaseDeGrille<T>[];
  /** Nombre d'interventions posées sur la semaine, toutes cases confondues. */
  readonly total: number;
};

/**
 * Range les interventions d'une semaine en lignes et en cases.
 *
 * **L'ordre des lignes est stable et il est décidé ici** : les interventions
 * non affectées d'abord — *c'est la file qu'on regarde en premier quand on
 * ouvre un planning* —, puis les couples triés par agence puis par technicien.
 * Un ordre laissé au hasard de la lecture ferait sauter les lignes d'une
 * semaine à l'autre, et le glisser-déposer du lot 3 deviendrait périlleux.
 *
 * **Une intervention sans date n'entre PAS dans la grille.** Elle n'appartient
 * à aucun jour, et la maquette lui donne sa place : la colonne latérale « À
 * planifier ». La ranger dans une case au prétexte qu'il faut bien la ranger
 * quelque part lui donnerait une date que personne n'a saisie.
 */
export function construireGrille<T extends Posable>(
  lignes: readonly T[],
  jours: readonly JourLocal[],
  agences: readonly AgenceDeGrille[],
): readonly LigneDeGrille<T>[] {
  const clesDesJours = new Set(jours.map(cleJour));
  const parAgence = new Map(agences.map((a) => [a.id, a]));

  const groupes = new Map<
    string,
    { ligne: LigneDeGrille<T>; par: Map<string, T[]> }
  >();
  const cleDe = (l: Posable) => `${l.technicien_id ?? ""}|${l.agence_id}`;

  for (const ligne of lignes) {
    if (ligne.date_planifiee === null) continue;
    const jour = jourDeLInstant(ligne.date_planifiee);
    if (!clesDesJours.has(cleJour(jour))) continue;

    const cle = cleDe(ligne);
    let groupe = groupes.get(cle);
    if (groupe === undefined) {
      groupe = { ligne: enveloppe(ligne, parAgence), par: new Map() };
      groupes.set(cle, groupe);
    }
    const caseDuJour = groupe.par.get(cleJour(jour)) ?? [];
    caseDuJour.push(ligne);
    groupe.par.set(cleJour(jour), caseDuJour);
  }

  const resultat: LigneDeGrille<T>[] = [...groupes.values()].map(
    ({ ligne, par }) => {
      const agence = parAgence.get(ligne.agenceId);
      const cases = jours.map((jour) => ({
        jour,
        ouverte:
          agence === undefined || !agence.calendrierConnu
            ? null
            : agence.joursOuverts.includes(jourSemaineIso(jour)),
        lignes: (par.get(cleJour(jour)) ?? []) as readonly T[],
      }));
      return {
        ...ligne,
        cases,
        total: cases.reduce((n, c) => n + c.lignes.length, 0),
      };
    },
  );

  return resultat.sort(comparerLignes);
}

/** Le jour LOCAL d'une date planifiée. */
function jourDeLInstant(instant: Date): JourLocal {
  // `date_planifiee` est un JOUR, pas un instant : la base la porte en `@db.Date`
  // et Prisma la rend à minuit UTC. La lire dans un fuseau la décalerait d'un
  // cran — c'est exactement le défaut que `lib/excel/controle.ts` évite à
  // l'import, et pour la même raison : UTC+11 range un 1er au 31.
  return {
    annee: instant.getUTCFullYear(),
    mois: instant.getUTCMonth() + 1,
    jour: instant.getUTCDate(),
  };
}

function enveloppe<T extends Posable>(
  ligne: T,
  parAgence: ReadonlyMap<string, AgenceDeGrille>,
): LigneDeGrille<T> {
  return {
    technicienId: ligne.technicien_id,
    agenceId: ligne.agence_id,
    agenceLibelle: parAgence.get(ligne.agence_id)?.libelle ?? ligne.agence_id,
    cases: [],
    total: 0,
  };
}

function comparerLignes<T extends Posable>(
  a: LigneDeGrille<T>,
  b: LigneDeGrille<T>,
): number {
  if (a.technicienId === null && b.technicienId !== null) return -1;
  if (a.technicienId !== null && b.technicienId === null) return 1;
  const parLibelle = a.agenceLibelle.localeCompare(b.agenceLibelle, "fr");
  if (parLibelle !== 0) return parLibelle;
  return (a.technicienId ?? "").localeCompare(b.technicienId ?? "");
}

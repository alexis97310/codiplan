import { cleJour, type JourLocal } from "@/lib/calendar/fuseau";
import { jourSemaineIso } from "@/lib/calendar/semaine";

/**
 * LA GRILLE DU PLANNING — une ligne par PERSONNE, les jours en colonnes
 * (D95 ; maille revue le 11/09/2026).
 *
 * ## Ce que ce module fait, et pourquoi il n'est pas dans l'écran
 *
 * Il RANGE des interventions déjà lues dans des cases. Il n'ouvre aucune
 * transaction, ne lit aucune base, ne connaît aucun contexte de société : tout
 * ce qu'il reçoit a été lu sous le cloisonnement par l'appelant. *Aucune
 * comparaison de société n'est donc écrite ici — ce serait une seconde lecture
 * d'un critère que la politique porte déjà (§9, 01/09).*
 *
 * ## LA MAILLE EST LA PERSONNE, et ce n'est plus le couple (technicien, agence)
 *
 * **Elle l'a été, et c'était défendable.** I7 veut qu'un calendrier appartienne
 * à une AGENCE — *Ducos ouvre du lundi au samedi, Koné du lundi au vendredi* —,
 * si bien qu'un technicien servant deux agences n'avait pas UN samedi mais
 * deux. Une ligne par couple évitait de choisir.
 *
 * **Elle coûtait la lisibilité de l'écran, qui est son objet.** Un planificateur
 * cherche « où en est Guérin cette semaine » ; deux lignes portant le même nom
 * lui font additionner de tête, et le glisser-déposer du lot 3 aurait eu deux
 * cibles pour une personne.
 *
 * **La règle rendue par l'exploitation le 11/09/2026, et pourquoi elle ne
 * contredit PAS I7.** *Un jour est OUVERT pour une personne s'il est ouvert
 * dans au moins une de ses agences ; il n'est hachuré que s'il est fermé dans
 * TOUTES.* I7 désigne lui-même, pour cet usage précis, le calendrier de
 * référence : *« conflit à la pose → calendrier de travail du technicien »*.
 * La grille hebdomadaire est l'écran de la pose. Le calendrier de travail d'une
 * personne vit dans `technicien_calendrier` — clé `(societe_id,
 * utilisateur_id)`, donc **un calendrier par personne, pas par agence** —, et
 * `occupation.ts` écrit déjà que *« le jour où il sera consulté, c'est lui qui
 * fera foi et l'agence deviendra le repli »*. **Mesuré le 11/09/2026 :
 * `technicien_calendrier` porte ZÉRO ligne.** L'union des agences est donc le
 * repli, exactement à la place que le dépôt lui avait réservée — et le jour où
 * une personne aura son calendrier, c'est lui qui décidera.
 *
 * **Ce que l'union cache, et qui est écrit plutôt que tu.** Une personne qui
 * sert Ducos et Koné voit son samedi OUVERT, alors que Koné ferme. La case
 * n'est donc pas un droit de poser : c'est un repère. Le bloc, lui, **nomme
 * son agence** — c'est là que se lit ce qui décide. Le refus, lui, appartient
 * aux contrôles à la pose (L3-02), qui n'existent pas encore et qui liront le
 * calendrier de l'agence visée, pas celui de la ligne.
 *
 * ## CE QUE CE MODULE NE FABRIQUE PAS
 *
 * **Le nom d'une personne.** Il reçoit un libellé ou rien. Le lire est une
 * lecture cloisonnée, elle appartient à l'appelant — et elle est possible
 * depuis L1-02c sans élargir quoi que ce soit (mesuré le 11/09/2026 : sous
 * contexte société, un utilisateur interne lit les 4 identités de sa société
 * d'un seul tenant ; un compte portail, 0).
 *
 * ## LA LIGNE VIENT DÉSORMAIS AUSSI DU RÉFÉRENTIEL (N-06, 17/09/2026)
 *
 * Elle ne venait que des interventions : un technicien sans aucune ligne
 * posée cette semaine n'avait AUCUNE ligne dans la grille — précisément la
 * personne qu'on cherche en ouvrant un planning. La vue jour avait déjà réglé
 * ce défaut le 12/09 pour ses colonnes (`construireJournee`,
 * `TechnicienDeJournee`) ; la vue semaine ne l'avait pas suivi, si bien que
 * les deux vues ne montraient pas la même équipe sur la même semaine.
 *
 * Le référentiel est donc SEMÉ en premier, avec ses agences de rattachement —
 * ce sont elles qui décident de l'ouverture (I7), même sans intervention —,
 * puis les interventions complètent ou créent les lignes qu'il ne couvre pas
 * (la file non affectée, une personne posée sans être au référentiel). Une
 * ligne semée par le référentiel et jamais rejointe par une intervention
 * reste dans la grille, VIDE : `total` vaut 0, aucune case n'a de ligne.
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
  /**
   * Le jour est-il ouvert pour cette PERSONNE ? `true` dès qu'une de ses
   * agences ouvre, `false` seulement si toutes ferment, `null` quand aucune
   * n'a de calendrier connu.
   */
  readonly ouverte: boolean | null;
  readonly lignes: readonly T[];
};

export type LigneDeGrille<T extends Posable> = {
  readonly technicienId: string | null;
  /** Les agences que cette personne sert sur la semaine, par ordre de libellé. */
  readonly agences: readonly AgenceDeGrille[];
  readonly cases: readonly CaseDeGrille<T>[];
  /** Nombre d'interventions posées sur la semaine, toutes cases confondues. */
  readonly total: number;
};

/**
 * UNE PERSONNE DU RÉFÉRENTIEL — ce qui donne à la grille une ligne pour qui
 * n'a rien cette semaine (N-06). Même forme que `TechnicienDeJournee` de
 * `journee.ts` : c'est le même référentiel, lu une fois par l'écran et donné
 * aux deux vues (`personnes.ts`).
 */
export type TechnicienDeGrille = {
  readonly id: string;
  /** Ses agences de rattachement — elles décident de l'ouverture (I7). */
  readonly agenceIds: readonly string[];
};

/**
 * Range les interventions d'une semaine en lignes et en cases.
 *
 * **L'ordre des lignes est stable et il est décidé ici** : les interventions
 * non affectées d'abord — *c'est la file qu'on regarde en premier quand on
 * ouvre un planning* —, puis les personnes, par libellé si l'appelant en
 * fournit un, par identifiant sinon. Un ordre laissé au hasard de la lecture
 * ferait sauter les lignes d'une semaine à l'autre, et le glisser-déposer du
 * lot 3 deviendrait périlleux.
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
  libelleDe: (technicienId: string) => string | null = () => null,
  techniciens: readonly TechnicienDeGrille[] = [],
): readonly LigneDeGrille<T>[] {
  const clesDesJours = new Set(jours.map(cleJour));
  const parAgence = new Map(agences.map((a) => [a.id, a]));

  const groupes = new Map<
    string,
    { technicienId: string | null; agences: Set<string>; par: Map<string, T[]> }
  >();

  // ── LE RÉFÉRENTIEL D'ABORD (N-06) ───────────────────────────────────────
  //
  // Il donne une ligne à qui n'a rien cette semaine, avec ses agences de
  // rattachement — sans elles, la ligne qu'on vient de lui rendre n'aurait
  // aucune ouverture à calculer. Les interventions, ci-dessous, complètent
  // ou rejoignent ces lignes ; elles ne les remplacent jamais.
  for (const technicien of techniciens) {
    groupes.set(technicien.id, {
      technicienId: technicien.id,
      agences: new Set(technicien.agenceIds),
      par: new Map(),
    });
  }

  for (const ligne of lignes) {
    if (ligne.date_planifiee === null) continue;
    const jour = jourDeLInstant(ligne.date_planifiee);
    if (!clesDesJours.has(cleJour(jour))) continue;

    const cle = ligne.technicien_id ?? "";
    let groupe = groupes.get(cle);
    if (groupe === undefined) {
      groupe = {
        technicienId: ligne.technicien_id,
        agences: new Set(),
        par: new Map(),
      };
      groupes.set(cle, groupe);
    }
    groupe.agences.add(ligne.agence_id);
    const caseDuJour = groupe.par.get(cleJour(jour)) ?? [];
    caseDuJour.push(ligne);
    groupe.par.set(cleJour(jour), caseDuJour);
  }

  const resultat: LigneDeGrille<T>[] = [...groupes.values()].map((groupe) => {
    const siennes = [...groupe.agences]
      .map((id) => parAgence.get(id))
      .filter((a): a is AgenceDeGrille => a !== undefined)
      .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));

    const cases = jours.map((jour) => ({
      jour,
      ouverte: ouvertePour(siennes, jour),
      lignes: (groupe.par.get(cleJour(jour)) ?? []) as readonly T[],
    }));

    return {
      technicienId: groupe.technicienId,
      agences: siennes,
      cases,
      total: cases.reduce((n, c) => n + c.lignes.length, 0),
    };
  });

  return resultat.sort((a, b) => comparerLignes(a, b, libelleDe));
}

/**
 * LA RÈGLE D'OUVERTURE D'UNE PERSONNE — ouverte si UNE agence ouvre, fermée
 * seulement si TOUTES ferment, inconnue si aucune ne sait.
 *
 * L'ordre des trois cas n'est pas indifférent : « inconnu » ne doit jamais
 * l'emporter sur un « ouvert » connu, sinon une agence sans calendrier
 * éteindrait la semaine d'une personne qui travaille ailleurs.
 */
function ouvertePour(
  agences: readonly AgenceDeGrille[],
  jour: JourLocal,
): boolean | null {
  const connues = agences.filter((a) => a.calendrierConnu);
  if (connues.length === 0) return null;
  const iso = jourSemaineIso(jour);
  return connues.some((a) => a.joursOuverts.includes(iso));
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

function comparerLignes<T extends Posable>(
  a: LigneDeGrille<T>,
  b: LigneDeGrille<T>,
  libelleDe: (technicienId: string) => string | null,
): number {
  if (a.technicienId === null && b.technicienId !== null) return -1;
  if (a.technicienId !== null && b.technicienId === null) return 1;
  if (a.technicienId === null || b.technicienId === null) return 0;
  const la = libelleDe(a.technicienId) ?? a.technicienId;
  const lb = libelleDe(b.technicienId) ?? b.technicienId;
  return la.localeCompare(lb, "fr");
}

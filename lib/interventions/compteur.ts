/**
 * LE COMPTEUR DU TECHNICIEN — la règle, sans base et sans horloge (R5-02, D119).
 *
 * ## Ce que ce module décide, et ce qu'il refuse de décider
 *
 * **Le compteur fait foi pour le temps** (D119). Ce module sait dire ce qu'un
 * ensemble de segments MESURE, et quels gestes sont possibles dessus. Il ne
 * sait ni lire une base, ni lire l'heure : *l'instant est un PARAMÈTRE, jamais
 * une lecture* — sinon un scénario deviendrait vert parce que l'horloge a
 * bougé, ce que ce dépôt refuse partout (D85, `lib/vgp/information.ts`,
 * `lib/demandes/accuse.ts`).
 *
 * **Il n'arrondit RIEN.** L'arrondi au quart d'heure supérieur et le plancher
 * d'une heure vivent dans `lib/tarification/valorisation.ts`, une seule fois,
 * sur l'intervention entière (RG-TAR-05, D83, D89). *Arrondir ici ferait deux
 * lectures d'un même critère, et la seconde déciderait du prix* (§9, 01/09).
 *
 * ## DEUX GESTES, ET NON TROIS — « pause » et « arrêt » ne diffèrent pas ENCORE
 *
 * Alexis décrit trois gestes : démarrer, mettre en pause, arrêter. **Sur les
 * segments, la pause et l'arrêt sont le MÊME geste** : tous deux ferment le
 * segment ouvert, et rien d'autre. Ce qui les distinguerait est ce que l'arrêt
 * ferait au STATUT de l'intervention — et ce point n'est pas tranché (voir la
 * migration de R5-02 : RG-INT-01 exige une machine au passage en statut de
 * travail, et le dépannage à l'aveugle est le cas ordinaire).
 *
 * *En offrir deux qui font la même chose serait mentir sur l'un des deux.* Ce
 * module en offre donc UN — `arreterLeSegment` —, et l'écran nomme le geste
 * « pause » tant que l'arrêt ne fait rien de plus. La distinction se rouvrira
 * le jour où le statut entrera dans la boucle.
 */

/** Un segment tel que la base le rend — l'ordre n'est pas supposé. */
export type Segment = {
  readonly id: string;
  readonly debut: Date;
  /** `null` : il tourne encore. */
  readonly fin: Date | null;
};

/**
 * CE QUE LES SEGMENTS MESURENT — et les deux moitiés ne se confondent jamais.
 *
 * `minutes` ne compte QUE les segments fermés : *un compteur qui tourne n'est
 * pas un temps acquis*, et l'additionner à l'instant courant ferait un total
 * qui change tout seul — le motif de D85, appliqué à un nombre au lieu d'une
 * politique. L'écran qui veut montrer un temps qui court le compose lui-même,
 * en sachant qu'il affiche une durée vivante.
 */
export type Mesure = {
  /** Minutes fermées, arrondies à la minute INFÉRIEURE : on ne facture pas une seconde. */
  readonly minutes: number;
  /** Le segment qui tourne, s'il y en a un. */
  readonly ouvert: Segment | null;
  /** Combien de segments fermés composent `minutes` — le témoin de ce qu'on additionne. */
  readonly segmentsFermes: number;
};

/** Le segment ouvert, ou `null`. La base n'en autorise qu'un par personne. */
export function segmentOuvert(segments: readonly Segment[]): Segment | null {
  return segments.find((s) => s.fin === null) ?? null;
}

/**
 * La mesure d'un ensemble de segments.
 *
 * **Les minutes sont tronquées, jamais arrondies** : deux segments de 30 s
 * feraient une minute si chacun s'arrondissait, et ce serait un arrondi que
 * personne n'a décidé, en plus de celui de RG-TAR-05. *La troncature à la
 * minute est une conversion d'unité ; l'arrondi est une règle de prix, et elle
 * a sa maison.*
 */
export function mesurer(segments: readonly Segment[]): Mesure {
  const fermes = segments.filter(
    (s): s is Segment & { fin: Date } => s.fin !== null,
  );
  const millisecondes = fermes.reduce(
    (total, s) => total + (s.fin.getTime() - s.debut.getTime()),
    0,
  );
  return {
    minutes: Math.floor(millisecondes / 60_000),
    ouvert: segmentOuvert(segments),
    segmentsFermes: fermes.length,
  };
}

/**
 * Les refus, avec leur clé — l'écran choisit ce qu'un humain en lit (L0-11).
 *
 * *Un refus porte une clé et non un texte* : une exception qui transporte de la
 * prose est une chaîne qui a changé de destination.
 */
export type RefusCompteur =
  | "compteur.refus.deja_en_cours"
  | "compteur.refus.aucun_en_cours"
  | "compteur.refus.fin_avant_debut";

export type Verdict =
  | { readonly accepte: true }
  | { readonly accepte: false; readonly cle: RefusCompteur };

const ACCEPTE: Verdict = { accepte: true };

/**
 * Peut-on démarrer un compteur ?
 *
 * **La question porte sur la PERSONNE, jamais sur l'intervention** : une
 * personne ne travaille pas à deux endroits à la fois, et c'est ce que l'index
 * partiel de la base tient. Les segments passés sont donc ceux de cette
 * personne, toutes interventions confondues — *les lui passer intervention par
 * intervention laisserait démarrer deux compteurs, et la base refuserait après
 * coup, sans motif lisible.*
 */
export function peutDemarrer(
  segmentsDeLaPersonne: readonly Segment[],
): Verdict {
  return segmentOuvert(segmentsDeLaPersonne) === null
    ? ACCEPTE
    : { accepte: false, cle: "compteur.refus.deja_en_cours" };
}

/** Peut-on arrêter le compteur ? Il faut qu'il en tourne un. */
export function peutArreter(
  segmentsDeLaPersonne: readonly Segment[],
  instant: Date,
): Verdict {
  const ouvert = segmentOuvert(segmentsDeLaPersonne);
  if (ouvert === null) {
    return { accepte: false, cle: "compteur.refus.aucun_en_cours" };
  }
  // La base porte la même borne (`CHECK fin > debut`). Elle est ici pour que le
  // refus soit NOMMÉ plutôt que rendu en SQL : *un écran qui affiche une
  // violation de contrainte a laissé la base parler à sa place.* Ce n'est pas
  // une seconde lecture qui diverge — c'est la même, dite deux fois, et celle
  // de la base est celle qui garde.
  return instant.getTime() > ouvert.debut.getTime()
    ? ACCEPTE
    : { accepte: false, cle: "compteur.refus.fin_avant_debut" };
}

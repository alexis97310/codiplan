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
 * **Il ne fait AUCUN arrondi DE PRIX.** L'arrondi au quart d'heure supérieur
 * et le plancher d'une heure vivent dans `lib/tarification/valorisation.ts`,
 * une seule fois, sur l'intervention entière (RG-TAR-05, D83, D89). *Arrondir
 * ici ferait deux lectures d'un même critère, et la seconde déciderait du
 * prix* (§9, 01/09).
 *
 * **LA TRONCATURE (`minutesDepuisMillisecondes`) EST UNE CONTRAINTE DE BASE,
 * PAS (PLUS) UN CHOIX DE CE MODULE** (9L06-COMPTEUR-MINUTE-COMMENCEE, D256) —
 * Alexis a décidé le 10/11/2026 que toute minute commencée devrait compter
 * (1 s mesurerait 1, jamais 0). Ce module ne peut PAS appliquer cette partie
 * de la décision seul : le déclencheur SQL qui garde `temps_mesure_min`
 * (`intervention_temps_mesure_du_compteur`,
 * `prisma/migrations/20260915060000_les_deux_temps_d120/migration.sql`)
 * REFUSE toute valeur différente de `floor(secondes / 60)` — une migration
 * est nécessaire pour changer le CÔTÉ BASE, et ce lot n'avait pas mandat
 * d'en poser une. CE QUI EST CORRIGÉ ICI, sans toucher la base : la
 * troncature ne se fait plus SEGMENT PAR SEGMENT (voir
 * `minutesDepuisMillisecondes`) — elle reste, pour l'instant, une troncature
 * sur le TOTAL, pas « toute minute commencée ».
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
  /** Minutes fermées, TRONQUÉES — voir `minutesDepuisMillisecondes`. */
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
 * LE SEGMENT OUVERT DE LA SEULE PERSONNE CONNECTÉE, pour un écran terrain
 * (9F4H6, point 5) — jamais celui de `mesurer(…).ouvert`, qui mesure
 * `mesureDeLIntervention` TOUTES PERSONNES CONFONDUES (un renfort compte
 * dans `minutes`, voir son docblock) : le confondre avec le SIEN ferait
 * accepter localement un « Terminer » hors réseau que le serveur refuse —
 * `intervention.refus.compteur_tourne_encore` — quand le seul segment
 * ouvert sur l'intervention est celui d'un RENFORT, pas celui de la
 * personne qui clique.
 *
 * `ici`/`enCours` viennent d'une requête déjà filtrée sur
 * `contexte.utilisateurId` seul (`compteurEnCours`) : c'est elle qui porte
 * la bonne réponse, jamais `mesure.ouvert`.
 */
export function segmentOuvertDeLaPersonne(
  ici: boolean,
  enCours: { readonly segment: Segment } | null,
): { readonly debut: string } | null {
  return ici && enCours !== null
    ? { debut: enCours.segment.debut.toISOString() }
    : null;
}

/**
 * UNE DURÉE MESURÉE (millisecondes), RENDUE EN MINUTES — TRONQUÉE, et SUR LE
 * TOTAL, JAMAIS SEGMENT PAR SEGMENT.
 *
 * **Ce que corrige ce lot (9L06-COMPTEUR-MINUTE-COMMENCEE, D256)** : trois
 * segments de 20 s (60 s au total) doivent mesurer UNE minute ; les
 * arrondir chacun séparément en mesurait trois fois ZÉRO, pour un total
 * pourtant plein — mesuré dans `mesureCompteurDeLaFile`
 * (`components/terrain/rapport-automatique.tsx`), qui additionnait des
 * minutes déjà tronquées une à une plutôt que des millisecondes. Tout
 * appelant qui recompose cette mesure à partir de plusieurs segments doit
 * additionner les MILLISECONDES avant d'appeler cette fonction, jamais
 * après avoir déjà arrondi chaque morceau — c'est ce que `mesurer`
 * fait déjà ci-dessous, et ce que `mesureCompteurDeLaFile` fait désormais.
 *
 * **Ce que ce lot NE corrige PAS, faute de mandat pour migrer** : Alexis a
 * décidé le 10/11/2026 que toute minute COMMENCÉE devrait compter (1 s
 * mesurerait 1, jamais 0) — voir le docblock de tête du fichier. Cette
 * fonction reste une TRONCATURE (`Math.floor`), parce que le déclencheur SQL
 * qui garde `temps_mesure_min` l'exige encore mot pour mot ; la changer ici
 * sans changer la base ferait refuser EN BASE tout arrêt de compteur dont la
 * durée n'est pas un multiple exact de la minute — une régression, pas une
 * correction.
 */
export function minutesDepuisMillisecondes(millisecondes: number): number {
  return Math.floor(millisecondes / 60_000);
}

/** La mesure d'un ensemble de segments — voir `minutesDepuisMillisecondes`. */
export function mesurer(segments: readonly Segment[]): Mesure {
  const fermes = segments.filter(
    (s): s is Segment & { fin: Date } => s.fin !== null,
  );
  const millisecondes = fermes.reduce(
    (total, s) => total + (s.fin.getTime() - s.debut.getTime()),
    0,
  );
  return {
    minutes: minutesDepuisMillisecondes(millisecondes),
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
  | "compteur.refus.fin_avant_debut"
  | "compteur.refus.instant_futur"
  | "compteur.refus.instant_trop_ancien"
  | "compteur.refus.operation_invalide"
  | "compteur.refus.saisie_differee_invalide";

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

/** Cinq minutes, en millisecondes — la borne future de `verifierInstantAppareil`. */
const CINQ_MINUTES_MS = 5 * 60_000;
/** Sept jours, en millisecondes — la borne passée de `verifierInstantAppareil`. */
const SEPT_JOURS_MS = 7 * 24 * 60 * 60_000;

/**
 * L'HEURE DU TÉLÉPHONE EST-ELLE CRÉDIBLE ? (9F4H2-HORS-RESEAU-HEURE-ET-REJEU,
 * décision n° 107 d'Alexis, 14/10/2026 ; D214)
 *
 * **Toujours un PARAMÈTRE contre un PARAMÈTRE** — jamais une lecture
 * d'horloge : `instantServeur` est celui que la route a déjà lu une seule
 * fois (L0-08). Un appareil hors réseau peut dériver ; ce n'est pas une
 * raison pour accepter n'importe quelle heure qu'il prétend avoir vécue.
 *
 * Deux bornes, choisies par le pilote : plus de 5 minutes dans le futur (une
 * horloge d'appareil à l'avenir n'est pas « hors réseau », elle est fausse),
 * ou plus de 7 jours dans le passé (au-delà, une saisie a plus de chances
 * d'être une erreur de fuseau ou de date qu'une vraie absence de réseau
 * prolongée).
 */
export function verifierInstantAppareil(
  instantServeur: Date,
  instantAppareil: Date,
): RefusCompteur | null {
  const delta = instantAppareil.getTime() - instantServeur.getTime();
  if (delta > CINQ_MINUTES_MS) {
    return "compteur.refus.instant_futur";
  }
  if (delta < -SEPT_JOURS_MS) {
    return "compteur.refus.instant_trop_ancien";
  }
  return null;
}

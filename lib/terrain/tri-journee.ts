import { PRIORITES } from "@/lib/interventions/saisie";

/**
 * LE TRI DE « MA JOURNÉE » (9L41-MA-JOURNEE-TRI-A-FAIRE, M8) — priorité,
 * puis créneau ; une intervention EN COURS ou SUSPENDUE passe en tête quelle
 * que soit sa priorité, parce qu'elle attend déjà une main, là où les autres
 * attendent encore d'être commencées.
 *
 * Fonction pure, sans lecture de la base ni de l'horloge : les deux formes
 * de ligne qui existent pour « Ma journée » (`LigneJourneeAffichee` en
 * ligne, `LigneJSON` hors réseau — dates en `Date` pour l'une, en texte ISO
 * pour l'autre) fournissent leurs propres clés par `cles`, pour que la
 * RÈGLE elle-même ne soit écrite qu'une fois (§9, 01/09).
 */
export type ClesTriJournee = {
  readonly statut: string;
  readonly priorite: string;
  /** Le créneau de début en millisecondes depuis l'epoch, ou `null` sans créneau. */
  readonly instant: number | null;
};

const STATUTS_EN_TETE = new Set(["en_cours", "suspendue"]);
const STATUTS_DEJA_FAITS = new Set(["terminee", "cloturee"]);

function rangStatut(statut: string): 0 | 1 {
  return STATUTS_EN_TETE.has(statut) ? 0 : 1;
}

function rangPriorite(priorite: string): number {
  const index = PRIORITES.indexOf(priorite as (typeof PRIORITES)[number]);
  return index === -1 ? PRIORITES.length : index;
}

/**
 * Trie `lignes` par priorité puis par créneau de début — stable : deux
 * lignes à égalité sur les trois clés gardent l'ordre reçu (celui de
 * `listerPlanning`, déjà par créneau puis ancienneté).
 */
export function trierParPrioriteEtDate<T>(
  lignes: readonly T[],
  cles: (ligne: T) => ClesTriJournee,
): T[] {
  return lignes
    .map((ligne, index) => ({ ligne, index, cle: cles(ligne) }))
    .sort((a, b) => {
      const rangA = rangStatut(a.cle.statut);
      const rangB = rangStatut(b.cle.statut);
      if (rangA !== rangB) {
        return rangA - rangB;
      }
      const prioA = rangPriorite(a.cle.priorite);
      const prioB = rangPriorite(b.cle.priorite);
      if (prioA !== prioB) {
        return prioA - prioB;
      }
      const instantA = a.cle.instant ?? Number.POSITIVE_INFINITY;
      const instantB = b.cle.instant ?? Number.POSITIVE_INFINITY;
      if (instantA !== instantB) {
        return instantA - instantB;
      }
      return a.index - b.index;
    })
    .map((x) => x.ligne);
}

/**
 * LA CARTE « À FAIRE MAINTENANT » — la première ligne du tri ci-dessus parmi
 * `candidats` qui n'est pas déjà terminée ou clôturée ; `null` si aucune
 * n'est éligible (l'appelant garde alors son message « rien aujourd'hui »
 * existant, sans en inventer un nouveau).
 */
export function prochaineAFaire<T>(
  candidats: readonly T[],
  cles: (ligne: T) => ClesTriJournee,
): T | null {
  const triees = trierParPrioriteEtDate(candidats, cles);
  return (
    triees.find((ligne) => !STATUTS_DEJA_FAITS.has(cles(ligne).statut)) ?? null
  );
}

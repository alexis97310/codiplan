import { t } from "@/lib/i18n/fr";

/**
 * CE QUE LE TABLEAU DE BORD COMPOSE (AV-10).
 *
 * Module sans JSX, pour la raison de `clients/presentation.ts` : le gardien
 * des chaînes visibles (L0-11) scanne un fichier qui porte du JSX **en
 * entier**, et un gabarit qui assemble deux clés du dictionnaire y passerait
 * pour du texte en dur.
 *
 * **Les types sont MINIMAUX, jamais les types complets du dépôt** — même
 * geste que `lib/interventions/personnes.ts` : ce module dit de quels CHAMPS
 * il a besoin, pas de quelle table ils viennent, et un scénario peut le
 * vérifier sans fabriquer une ligne d'intervention complète.
 */

/** Le minimum qu'une ligne de planning porte pour être comptée « du jour ». */
export type LignePlanifiable = {
  readonly date_planifiee: Date | null;
  readonly technicien_id: string | null;
};

/** Le minimum qu'une fiche « en attente de pièce » porte pour son ancienneté. */
export type FicheEnAttente = {
  readonly ancienneteJours: number;
};

/** Le minimum qu'un blocage d'agenda porte pour désigner une personne. */
export type BlocageDAgenda = {
  readonly utilisateur_id: string;
};

/**
 * LE SEUIL DE L'ANCIENNETÉ « DEPUIS PLUS DE 30 JOURS » — la maquette l'écrit
 * en toutes lettres (« dont 4 depuis plus de 30 jours »), et ce n'est pas un
 * délai métier du chapitre 10 : c'est une lecture d'écran, au même titre que
 * les fenêtres de `/absences`. Elle est nommée pour ne pas se lire comme une
 * règle de gestion qu'elle n'est pas.
 */
export const SEUIL_ANCIENNETE_JOURS = 30;

/**
 * LES LIGNES DU JOUR — `listerPlanning` rend AUSSI toute la file d'attente
 * (`date_planifiee IS NULL`), quelle que soit la fenêtre demandée : c'est ce
 * qu'elle doit faire pour un planning, et c'est exactement ce qu'un compte
 * « aujourd'hui » ne doit pas inclure. Le filtre est donc refait ici, sur les
 * lignes déjà lues — jamais une seconde requête.
 */
export function interventionsDuJour<T extends LignePlanifiable>(
  lignes: readonly T[],
  debut: Date,
  fin: Date,
): readonly T[] {
  return lignes.filter(
    (ligne) =>
      ligne.date_planifiee !== null &&
      ligne.date_planifiee.getTime() >= debut.getTime() &&
      ligne.date_planifiee.getTime() < fin.getTime(),
  );
}

/** Combien de lignes DU JOUR n'ont encore personne. */
export function nonAffecteesAujourdHui(
  lignesDuJour: readonly LignePlanifiable[],
): number {
  return lignesDuJour.filter((ligne) => ligne.technicien_id === null).length;
}

/**
 * Le détail sous le KPI « Interventions du jour » — absent plutôt qu'à zéro :
 * *un détail qui affiche toujours quelque chose finit par ne plus se lire*
 * (§9, 06/09), et « 0 non affectée » ne dit rien qu'un lecteur ait besoin de
 * lire.
 */
export function detailInterventionsDuJour(
  lignesDuJour: readonly LignePlanifiable[],
): string | undefined {
  const nonAffectees = nonAffecteesAujourdHui(lignesDuJour);
  if (nonAffectees === 0) {
    return undefined;
  }
  const unite =
    nonAffectees === 1
      ? t("tableau_de_bord.non_affectee_une")
      : t("tableau_de_bord.non_affectees");
  return `${nonAffectees} ${unite}`;
}

/** Combien de fiches « en attente de pièce » dépassent le seuil d'ancienneté. */
export function ancienNombreEnAttente(
  lignes: readonly FicheEnAttente[],
): number {
  return lignes.filter(
    (ligne) => ligne.ancienneteJours > SEUIL_ANCIENNETE_JOURS,
  ).length;
}

export function detailEnAttenteDePiece(
  lignes: readonly FicheEnAttente[],
): string | undefined {
  const anciennes = ancienNombreEnAttente(lignes);
  if (anciennes === 0) {
    return undefined;
  }
  return [
    t("tableau_de_bord.en_attente_detail_prefixe"),
    String(anciennes),
    t("tableau_de_bord.en_attente_detail_suffixe"),
  ].join(" ");
}

/**
 * COMBIEN DE PERSONNES sont couvertes par un blocage aujourd'hui — une
 * PERSONNE, jamais une LIGNE : deux blocages qui se chevauchent sur la même
 * personne ne comptent qu'une fois.
 */
export function techniciensIndisponibles(
  absencesDuJour: readonly BlocageDAgenda[],
): number {
  return new Set(absencesDuJour.map((absence) => absence.utilisateur_id)).size;
}

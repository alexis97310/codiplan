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

/**
 * ── « PRIORITÉS OPÉRATIONNELLES » (D125) ─────────────────────────────────
 *
 * `priorityItems()` de la maquette affiche quatre entrées de démonstration,
 * classées `urgent` / `piece` / `planning`. Ce dépôt n'invente aucune de ces
 * quatre lignes : chaque TYPE se résout depuis une lecture réelle déjà écrite
 * ailleurs —
 *
 * - `urgent` : les interventions du jour dont `priorite` vaut `p1`, tirées de
 *   `lignesDuJour` — la MÊME liste que le premier KPI lit déjà, jamais une
 *   seconde requête sur le même critère (§9, 01/09).
 * - `piece` : `enAttenteDePiece`, la même lecture que la carte « Dossiers
 *   bloqués ».
 * - `planning` : les interventions au statut `a_planifier`, qui n'ont ni
 *   technicien ni date.
 *
 * Le filtre `<select>` de la maquette (« Tous les besoins / Urgences / Pièces
 * / À planifier ») EST le paramètre `priorite` de l'URL — la même forme que
 * `?statut=` sur `/parc` (N-10) : un `GET`, rendu côté serveur, sans état
 * React.
 */

const PRIORITES_VALEURS = ["tous", "urgent", "piece", "planning"] as const;
export type FiltrePriorite = (typeof PRIORITES_VALEURS)[number];

/** Le filtre reçu de l'URL, ramené à une valeur connue — jamais une valeur libre. */
export function filtrePrioriteLu(
  valeur: string | string[] | undefined,
): FiltrePriorite {
  return typeof valeur === "string" &&
    (PRIORITES_VALEURS as readonly string[]).includes(valeur)
    ? (valeur as FiltrePriorite)
    : "tous";
}

/** Une entrée de la liste — jamais un `<article class="priority-item">` recopié : une donnée. */
export type ElementPriorite = {
  readonly type: Exclude<FiltrePriorite, "tous">;
  readonly rang: string;
  readonly titre: string;
  readonly detail: string;
  readonly href: string;
};

/** Le minimum qu'une intervention porte pour entrer dans la liste. */
export type InterventionPriorisable = {
  readonly id: string;
  readonly numero: number | null;
  readonly client: { readonly raison_sociale: string };
};

/**
 * LES URGENCES DU JOUR — `priorite === "p1"`, parmi les lignes déjà lues
 * pour le premier KPI.
 */
export function prioritesUrgentes(
  lignesDuJour: readonly (InterventionPriorisable & {
    readonly priorite: string;
  })[],
  reference: (ligne: { id: string; numero: number | null }) => string,
): readonly ElementPriorite[] {
  return lignesDuJour
    .filter((ligne) => ligne.priorite === "p1")
    .map((ligne) => ({
      type: "urgent" as const,
      rang: ligne.priorite.toUpperCase(),
      titre: t("tableau_de_bord.priorite_urgent_titre"),
      detail: `${reference(ligne)} · ${ligne.client.raison_sociale}`,
      href: `/interventions/${ligne.id}`,
    }));
}

/**
 * Le minimum qu'une fiche « en attente de pièce » porte pour la liste.
 *
 * `enAttenteDePiece` lit `CHAMPS_LIGNE` seul, sans jointure client (elle sert
 * d'abord la carte « Dossiers bloqués », qui ne nomme aucun client) : la
 * ligne d'ici s'appuie donc sur la RÉFÉRENCE et la pièce attendue, jamais sur
 * un nom de client qu'aucune requête de ce chemin ne charge.
 */
export type FicheEnAttentePourPriorite = {
  readonly ligne: { readonly id: string; readonly numero: number | null };
  readonly pieceAttendueRef: string;
  readonly ancienneteJours: number;
};

export function prioritesPieces(
  enAttente: readonly FicheEnAttentePourPriorite[],
  reference: (ligne: { id: string; numero: number | null }) => string,
): readonly ElementPriorite[] {
  return enAttente.map((fiche) => ({
    type: "piece" as const,
    rang: `${fiche.ancienneteJours}j`,
    titre: t("tableau_de_bord.priorite_piece_titre"),
    detail: `${reference(fiche.ligne)} · ${fiche.pieceAttendueRef} · ${fiche.ancienneteJours} ${t("tableau_de_bord.priorite_piece_detail_suffixe")}`,
    href: `/interventions/${fiche.ligne.id}`,
  }));
}

/**
 * LE RANG D'UN ÉLÉMENT « À PLANIFIER » — un RANG DE POSITION (« 01 », « 02 »
 * …), comme `priorityItems()` de la maquette (`rank:"03"`, `rank:"01"`),
 * JAMAIS la référence de l'intervention : `Local-<6 caractères>` (I10)
 * déborderait le badge de 39×39 px que la maquette dessine pour un code de
 * deux ou trois signes. La référence reste lisible, dans le détail.
 */
export function prioritesAPlanifier(
  lignes: readonly InterventionPriorisable[],
  reference: (ligne: { id: string; numero: number | null }) => string,
): readonly ElementPriorite[] {
  return lignes.map((ligne, index) => ({
    type: "planning" as const,
    rang: String(index + 1).padStart(2, "0"),
    titre: t("tableau_de_bord.priorite_a_planifier_titre"),
    detail: `${reference(ligne)} · ${ligne.client.raison_sociale}`,
    href: `/interventions/${ligne.id}`,
  }));
}

/** Le filtre s'applique EN DERNIER, sur la liste déjà composée — jamais dans chaque source. */
export function elementsFiltres(
  elements: readonly ElementPriorite[],
  filtre: FiltrePriorite,
): readonly ElementPriorite[] {
  return filtre === "tous"
    ? elements
    : elements.filter((element) => element.type === filtre);
}

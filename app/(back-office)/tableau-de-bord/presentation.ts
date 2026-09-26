import { type TypeIntervention } from "@prisma/client";

import { t } from "@/lib/i18n/fr";
import { type CompteAPrevoir } from "@/lib/vgp/registre";

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
 * LA TUILE « VGP À PRÉVOIR » MENT PAR OMISSION QUAND LE REGISTRE EST VIERGE
 * (lot AV-14, 19/09/2026) — ET ELLE MENTAIT DE LA MÊME FAÇON SUR LE RETARD
 * (VGP-2, 22/09/2026).
 *
 * `compterAPrevoir` (`lib/vgp/registre.ts`) rendait 0 dans DEUX situations que
 * le chiffre seul ne distingue pas : rien n'est dû dans l'horizon (une mesure
 * réelle, une bonne nouvelle), ou AUCUNE machine n'a jamais reçu de
 * vérification (le registre n'a encore rien à mesurer — `sans_information`,
 * `lib/vgp/information.ts`, est déjà une valeur à part entière pour la même
 * raison). La seconde se traite comme `taux_occupation_non_calcule` : un
 * texte nommé, jamais un zéro qui se lit comme une mesure.
 *
 * **Mesuré le 22/09/2026 (d9c9446) : il y avait une TROISIÈME situation, et
 * c'était la pire.** Une machine soumise dont l'échéance déduite était passée
 * depuis huit mois comptait ZÉRO — le filtre `>= 0` l'écartait — et la tuile
 * rendait « 0 — Dans les 30 prochains jours » : *le seul cas où l'outil doit
 * crier est précisément celui où il se taisait.* Le retard est le même défaut
 * qu'AV-14 a fermé pour le registre vierge, et il se ferme de la même façon :
 * **une voie NOMMÉE, jamais un zéro, jamais un vert.** La tuile porte donc
 * TROIS voies — DÉPASSÉE, À VENIR (sous l'horizon), SANS INFORMATION —, et
 * aucune ne dit « conforme » ni « non conforme » (D88) : on dit ce qu'on SAIT
 * de la date, jamais ce que la machine vaut.
 *
 * Ni l'ORDRE ni le NOMBRE des tuiles ne changent (D125) — seulement ce que
 * celle-ci dit.
 */
export type EtatVgpAPrevoir =
  ({ readonly calcule: true } & CompteAPrevoir) | { readonly calcule: false };

export function etatVgpAPrevoir(
  auMoinsUneVerificationEnregistree: boolean,
  compte: CompteAPrevoir,
): EtatVgpAPrevoir {
  return auMoinsUneVerificationEnregistree
    ? { calcule: true, ...compte }
    : { calcule: false };
}

/**
 * LE GRAND CHIFFRE DE LA TUILE — les DÉPASSÉES avec les À VENIR : une
 * échéance passée est à prévoir, et avant les autres. Les « sans
 * information » n'y entrent pas : on ne sait pas quand elles sont dues, et
 * les compter comme dues serait leur inventer une durée (L9-05). Elles sont
 * nommées dans le détail, jamais tues.
 */
export function valeurVgpAPrevoir(compte: CompteAPrevoir): number {
  return compte.depassees + compte.aVenir;
}

/**
 * LE DÉTAIL SOUS LE CHIFFRE — les trois voies, TOUJOURS nommées, dans cet
 * ordre : DÉPASSÉE (celle qui crie), À VENIR sous l'horizon REÇU (jamais
 * écrit ici — c'est la page qui le fixe, et la maquette qui l'a dessiné),
 * SANS INFORMATION.
 *
 * *Un détail qui affiche toujours quelque chose finit par ne plus se lire*
 * (§9, 06/09) vaut pour un détail qui ne dit RIEN à zéro — « 0 non affectée ».
 * Ici, « 0 échéance dépassée » dit quelque chose : que la voie existe et
 * qu'on l'a mesurée. Un lecteur qui ne voit jamais ce mot ne saurait pas que
 * la tuile le dirait le jour où il compte.
 */
export function detailVgpAPrevoir(
  compte: CompteAPrevoir,
  horizonJours: number,
): string {
  const depassees =
    compte.depassees === 1
      ? t("tableau_de_bord.vgp_voie_depassee_une")
      : t("tableau_de_bord.vgp_voie_depassees");
  return [
    `${compte.depassees} ${depassees}`,
    `${compte.aVenir} ${t("tableau_de_bord.vgp_voie_a_venir_prefixe")} ${horizonJours} ${t("tableau_de_bord.vgp_voie_a_venir_suffixe")}`,
    `${compte.sansInformation} ${t("tableau_de_bord.vgp_voie_sans_information")}`,
  ].join(" · ");
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

/**
 * Le minimum qu'une intervention porte pour entrer dans la liste.
 *
 * `description` ET `type` (GR7, 27/09/2026) : le titre nomme la PANNE
 * signalée, à défaut la NATURE — jamais le seul numéro suivi du client, qui
 * ne dit rien de ce qu'il y a à faire (audit GR, constat G8, 26/09/2026).
 * `site`, pour la même raison : la référence seule ne dit pas OÙ.
 */
export type InterventionPriorisable = {
  readonly id: string;
  readonly numero: number | null;
  readonly description: string | null;
  readonly type: TypeIntervention;
  readonly client: { readonly raison_sociale: string };
  readonly site: { readonly libelle: string };
};

/**
 * LA PANNE SIGNALÉE, À DÉFAUT LA NATURE (GR7, 27/09/2026) — jamais le seul
 * numéro : « Local-000011 · Atelier Ducos » ne dit rien de ce qui amène le
 * technicien, quand la maquette écrit « Compresseur arrêté — Lagon
 * Maintenance » (`codiplan-maquette-complete.html`). `description` porte le
 * texte saisi une seule fois à la création (`intervention.description`,
 * PARCOURS-1) ; `null` retombe sur la nature déjà nommée par
 * `type_intervention.*`, la même clé que `objetDuBloc`
 * (`../interventions/presentation.ts`) lit pour le planning — jamais un
 * second vocabulaire pour la même donnée.
 */
function panneOuNature(ligne: {
  readonly description: string | null;
  readonly type: TypeIntervention;
}): string {
  return ligne.description ?? t(`type_intervention.${ligne.type}`);
}

/**
 * L'ORDRE DE PRÉSÉANCE DES QUATRE PRIORITÉS (TABLEAU-1, 23/09/2026) — P1
 * avant P2, avant P3, avant P4. Écrit UNE fois, pour les deux listes qui en
 * ont besoin : `prioritesUrgentes` et `prioritesAPlanifier` lisent le champ
 * `priorite` déjà porté par l'intervention, jamais un second calcul.
 *
 * `Array.prototype.sort` est STABLE (ES2019) : à priorité égale, l'ordre déjà
 * lu (la date, via `listerPlanning` — urgence puis ancienneté) est conservé
 * sans qu'il faille le relire ici.
 */
const RANG_PRIORITE: Record<string, number> = { p1: 0, p2: 1, p3: 2, p4: 3 };

function triParPrioritePuisDate<T extends { readonly priorite: string }>(
  lignes: readonly T[],
): readonly T[] {
  return [...lignes].sort(
    (a, b) =>
      (RANG_PRIORITE[a.priorite] ?? RANG_PRIORITE.p4) -
      (RANG_PRIORITE[b.priorite] ?? RANG_PRIORITE.p4),
  );
}

/**
 * LES URGENCES DU JOUR — `priorite === "p1"`, parmi les lignes déjà lues
 * pour le premier KPI.
 *
 * Titre et sous-ligne intervertis le 27/09/2026 (GR7, audit G8) : le titre
 * nomme désormais la panne (à défaut la nature) et le client — `panneOuNature`
 * ci-dessus —, le détail porte la référence et le site, jamais l'inverse.
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
      titre: `${panneOuNature(ligne)}${t("ponctuation.separateur")}${ligne.client.raison_sociale}`,
      detail: `${reference(ligne)}${t("ponctuation.point_median")}${ligne.site.libelle}`,
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
 * LE RANG D'UN ÉLÉMENT « À PLANIFIER » — LA PRIORITÉ, PAS UNE POSITION
 * (TABLEAU-1, 23/09/2026).
 *
 * ~~Un RANG DE POSITION (« 01 », « 02 » …), comme `priorityItems()` de la
 * maquette (`rank:"03"`, `rank:"01"`)~~ : mesuré le 23/09/2026, une fiche
 * **P1 — critique** s'affichait « 01 Intervention à planifier », un badge
 * identique à celui d'une fiche P4 en dixième position — rien ne disait
 * qu'elle était urgente. Le rang porte désormais la priorité elle-même
 * (`P1`, `P2`…), la MÊME lecture que `prioritesUrgentes` en fait déjà pour
 * ses propres lignes — jamais un second vocabulaire pour la même donnée.
 * *`Local-<6 caractères>` (I10) débordait le badge de 39×39 px* : la
 * référence de l'intervention reste donc dans le détail, jamais dans le
 * rang.
 *
 * **Triée P1 > P2 > P3 > P4, puis date** (`triParPrioritePuisDate`) : une
 * urgence doit remonter en tête de la liste, pas seulement porter une
 * étiquette — sans ce tri explicite, l'ordre dépendrait de celui,
 * incidentel, que l'appelant a lu ailleurs.
 */
export function prioritesAPlanifier(
  lignes: readonly (InterventionPriorisable & { readonly priorite: string })[],
  reference: (ligne: { id: string; numero: number | null }) => string,
): readonly ElementPriorite[] {
  return triParPrioritePuisDate(lignes).map((ligne) => ({
    type: "planning" as const,
    rang: ligne.priorite.toUpperCase(),
    titre: `${panneOuNature(ligne)}${t("ponctuation.separateur")}${ligne.client.raison_sociale}`,
    detail: `${reference(ligne)}${t("ponctuation.point_median")}${ligne.site.libelle}`,
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

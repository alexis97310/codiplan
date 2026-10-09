import { Role, type TypeIntervention } from "@prisma/client";

import { t, type CleTraduction } from "@/lib/i18n/fr";
import { type TonKpi } from "@/components/ui/kpi";
import { type NomIcone } from "@/components/ui/icone";

/**
 * CE QUE LE TABLEAU DE BORD COMPOSE, SELON LE RÔLE (9EG-TP-UX6-TABLEAU-DE-
 * BORD-1, D185 ; amende D136/D175/D176 sur ce seul écran).
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

/** Le minimum qu'un blocage d'agenda porte pour désigner une personne. */
export type BlocageDAgenda = {
  readonly utilisateur_id: string;
};

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
 * LE DÉTAIL SOUS LA TUILE « SUSPENDUES » — « N en attente de pièce », une
 * SOUS-POPULATION du total que la tuile affiche, jamais un second total :
 * `lignes` vient d'`enAttenteDePiece`, déjà filtrée sous le MÊME critère
 * client actif que ce total. Absente plutôt qu'à zéro (§9, 06/09).
 */
export function detailEnAttenteDePiece(
  lignes: readonly unknown[],
): string | undefined {
  if (lignes.length === 0) {
    return undefined;
  }
  return [
    t("tableau_de_bord.en_attente_detail_prefixe"),
    String(lignes.length),
    t("tableau_de_bord.en_attente_detail_suffixe_piece"),
  ].join(" ");
}

/**
 * LE LIEN DE LA TUILE « EN RETARD » — ABSENT À ZÉRO (décision d'Alexis du
 * 30/09/2026, point 13 ; D144, amende D140 sur ce seul cas, tenue par D185).
 */
export function lienEnRetard(compte: number): string | undefined {
  return compte > 0 ? "/interventions?vue=en_retard" : undefined;
}

/**
 * LE TON DE LA TUILE « EN RETARD » — VERT À ZÉRO (décision d'Alexis du
 * 02/10/2026, point 4 ; D148, amende D144, tenue par D185).
 */
export function tonEnRetard(compte: number): TonKpi {
  return compte === 0 ? "vert" : "rouge";
}

/** Jours ENTIERS écoulés — même formule que `joursEcoules` de `lib/interventions/depot.ts`, jamais réexportée (R3-12). */
function joursEntiersEcoules(depuis: Date, jusqua: Date): number {
  const MS_PAR_JOUR = 24 * 60 * 60 * 1000;
  return Math.max(
    0,
    Math.floor((jusqua.getTime() - depuis.getTime()) / MS_PAR_JOUR),
  );
}

/** Première lettre en majuscule — jamais une locale, un simple découpage de chaîne. */
function enTeteDePhrase(texte: string): string {
  return texte.length === 0
    ? texte
    : texte.charAt(0).toUpperCase() + texte.slice(1);
}

// ═══ LE SOUS-TITRE DE L'EN-TÊTE — « <jour> · semaine <n> · vue <rôle> » (maquette :2904) ═══

/** Le jour, en toutes lettres — « vendredi 9 octobre », jamais `toLocaleDateString` (L0-08). */
export function jourEnToutesLettres(jour: {
  readonly annee: number;
  readonly mois: number;
  readonly jour: number;
}): string {
  return (
    enTeteDePhrase(t(`jour.${jourSemaineIso(jour)}` as CleTraduction)) +
    ` ${jour.jour} ` +
    t(`mois.${jour.mois}` as CleTraduction).toLowerCase()
  );
}

/** Isolé pour ne dépendre que de la forme minimale ci-dessus (R3-12 : pas de réexport de `lib/calendar/semaine.ts`). */
function jourSemaineIso(jour: {
  readonly annee: number;
  readonly mois: number;
  readonly jour: number;
}): number {
  const date = new Date(0);
  date.setUTCFullYear(jour.annee, jour.mois - 1, jour.jour);
  const dimancheZero = date.getUTCDay();
  return dimancheZero === 0 ? 7 : dimancheZero;
}

export function sousTitreTableauDeBord(
  jour: {
    readonly annee: number;
    readonly mois: number;
    readonly jour: number;
  },
  semaineIso: number,
  role: Role,
): string {
  return [
    jourEnToutesLettres(jour),
    `${t("tableau_de_bord.sous_titre_semaine")} ${semaineIso}`,
    `${t("tableau_de_bord.sous_titre_vue")} ${t(`role.${role}` as CleTraduction)}`,
  ].join(t("ponctuation.point_median"));
}

// ═══ LA COMPOSITION PAR RÔLE (QE-7 (a), É-7) ═══════════════════════════════

/**
 * TROIS COMPOSITIONS AUJOURD'HUI, NOMMÉES PAR LE RÔLE QUI LES PORTE EN PROPRE
 * — direction et administrateur de société gardent celle de l'ADV jusqu'au
 * second ticket (9EG-TP-UX6-TABLEAU-DE-BORD-2), qui leur donnera la leur. Le
 * rôle choisit la composition, jamais un droit : chaque lecture garde sa
 * propre capacité (`peut…`).
 *
 * **`Role.adv`/`Role.responsable_materiel`/`Role.responsable_sav`, jamais une
 * chaîne inventée** (L0-06, `tests/unit/auth/roles-sans-chaine-libre.test.ts`) :
 * un rôle s'écrit `Role.<valeur>` partout dans ce dépôt, jamais entre
 * guillemets droits.
 */
export const COMPOSITIONS_ROLE = [
  Role.adv,
  Role.responsable_materiel,
  Role.responsable_sav,
] as const;
export type CompositionRole = (typeof COMPOSITIONS_ROLE)[number];

export function compositionDuRole(role: Role): CompositionRole {
  if (role === Role.responsable_materiel) {
    return Role.responsable_materiel;
  }
  if (role === Role.responsable_sav) {
    return Role.responsable_sav;
  }
  return Role.adv;
}

/**
 * LES HUIT TUILES DE LA MAQUETTE (:2870-2883) — trois n'ont AUCUNE lecture
 * sur main (constat T5 de l'addendum du 09/10) : `a_facturer` (D45, après la
 * refonte, ARGENT), `retours_30j` (D48, lot du registre), `reserves_vgp`
 * (D53, lot du registre, migration). Leur PLACE reste ICI, marquée absente —
 * `TUILES_ABSENTES` les retire du rendu, jamais de cette liste.
 */
export type TypeTuile =
  | "a_planifier"
  | "aujourdhui"
  | "en_retard"
  | "a_facturer"
  | "a_controler"
  | "suspendues"
  | "retours_30j"
  | "reserves_vgp";

export const TUILES_ABSENTES: readonly TypeTuile[] = [
  "a_facturer",
  "retours_30j",
  "reserves_vgp",
];

export const TUILES_PAR_COMPOSITION: Readonly<
  Record<CompositionRole, readonly TypeTuile[]>
> = {
  [Role.adv]: ["a_planifier", "aujourdhui", "en_retard", "a_facturer"],
  [Role.responsable_materiel]: [
    "a_planifier",
    "en_retard",
    "reserves_vgp",
    "suspendues",
  ],
  [Role.responsable_sav]: [
    "a_controler",
    "aujourdhui",
    "suspendues",
    "retours_30j",
  ],
};

/** Les tuiles RÉELLEMENT rendues pour une composition — `TUILES_ABSENTES` retirée. */
export function tuilesRenduesDuRole(
  composition: CompositionRole,
): readonly TypeTuile[] {
  return TUILES_PAR_COMPOSITION[composition].filter(
    (tuile) => !TUILES_ABSENTES.includes(tuile),
  );
}

/** Le décompte propre au rôle, à la fin de la bande (`bandeByRole`, maquette :2887-2892). */
export type DecompteRole =
  "a_transmettre" | "garanties_qui_finissent" | "sous_garantie_ouvertes";

export const DECOMPTE_PAR_COMPOSITION: Readonly<
  Record<CompositionRole, DecompteRole>
> = {
  [Role.adv]: "a_transmettre",
  [Role.responsable_materiel]: "garanties_qui_finissent",
  [Role.responsable_sav]: "sous_garantie_ouvertes",
};

// ═══ LE DÉTAIL DES TUILES ═══════════════════════════════════════════════

/** Une intervention est-elle AFFECTÉE, DU JOUR, SANS AVOIR DÉMARRÉ (maquette `pasDemarree`) ? */
export function pasDemarree(
  ligne: { readonly statut: string; readonly creneau_debut: Date | null },
  instant: Date,
): boolean {
  return (
    ligne.statut === "affectee" &&
    ligne.creneau_debut !== null &&
    ligne.creneau_debut.getTime() < instant.getTime()
  );
}

/** « N en cours · N terminée(s) · N pas démarrée(s) » (maquette `jour: tile(...)`, :2872). */
export function detailAujourdhui(
  lignesDuJour: readonly {
    readonly statut: string;
    readonly creneau_debut: Date | null;
  }[],
  instant: Date,
): string {
  const enCours = lignesDuJour.filter(
    (ligne) => ligne.statut === "en_cours",
  ).length;
  const terminees = lignesDuJour.filter(
    (ligne) => ligne.statut === "terminee",
  ).length;
  const nonDemarrees = lignesDuJour.filter((ligne) =>
    pasDemarree(ligne, instant),
  ).length;
  return [
    `${enCours} ${t("tableau_de_bord.jour_en_cours")}`,
    `${terminees} ${terminees === 1 ? t("tableau_de_bord.jour_terminee_une") : t("tableau_de_bord.jour_terminees")}`,
    `${nonDemarrees} ${nonDemarrees === 1 ? t("tableau_de_bord.jour_pas_demarree_une") : t("tableau_de_bord.jour_pas_demarrees")}`,
  ].join(t("ponctuation.point_median"));
}

/** « dont N P1 · la plus ancienne : N j » (maquette `aPlanifier: tile(...)`, :2871). */
export function detailAPlanifier(
  aPlanifier: readonly { readonly priorite: string; readonly cree_le: Date }[],
  instant: Date,
): string {
  const p1 = aPlanifier.filter((ligne) => ligne.priorite === "p1").length;
  const ancienne = aPlanifier.reduce(
    (plusAncienne, ligne) =>
      ligne.cree_le < plusAncienne ? ligne.cree_le : plusAncienne,
    instant,
  );
  const ancienneteJours = joursEntiersEcoules(ancienne, instant);
  const prefixeP1 =
    p1 > 0
      ? `${t("tableau_de_bord.tuile_a_planifier_dont_p1_prefixe")} ${p1} ${t("tableau_de_bord.tuile_a_planifier_dont_p1_suffixe")}${t("ponctuation.point_median")}`
      : "";
  return `${prefixeP1}${t("tableau_de_bord.tuile_a_planifier_plus_ancienne")} ${ancienneteJours} ${t("tableau_de_bord.jours_suffixe")}`;
}

// ═══ « PRIORITÉS OPÉRATIONNELLES » (D125, décisions d'Alexis du 09/10 : 46, 47) ═══

export const CATEGORIES_PRIORITE = [
  "urgent",
  "retard",
  "planning",
  "qualite",
  "piece",
] as const;
export type CategoriePriorite = (typeof CATEGORIES_PRIORITE)[number];

const LIBELLE_CATEGORIE: Readonly<Record<CategoriePriorite, CleTraduction>> = {
  urgent: "tableau_de_bord.categorie_urgent",
  retard: "tableau_de_bord.categorie_retard",
  planning: "tableau_de_bord.categorie_planning",
  qualite: "tableau_de_bord.categorie_qualite",
  piece: "tableau_de_bord.categorie_piece",
};

/**
 * LES CATÉGORIES VISIBLES PAR RÔLE (`prioritesDe`, maquette :2771) — sans
 * « Équipe » (lot -2). ADV : toutes ; responsable matériel : sans Contrôle ;
 * responsable SAV : Urgences et Contrôle seulement.
 */
export const CATEGORIES_PAR_COMPOSITION: Readonly<
  Record<CompositionRole, readonly CategoriePriorite[]>
> = {
  [Role.adv]: ["urgent", "retard", "planning", "qualite", "piece"],
  [Role.responsable_materiel]: ["urgent", "retard", "planning", "piece"],
  [Role.responsable_sav]: ["urgent", "qualite"],
};

export type FiltrePriorite = "tous" | CategoriePriorite;

/** Le filtre reçu de l'URL, ramené à une valeur connue — jamais une valeur libre. */
export function filtrePrioriteLu(
  valeur: string | string[] | undefined,
): FiltrePriorite {
  if (
    typeof valeur === "string" &&
    (CATEGORIES_PRIORITE as readonly string[]).includes(valeur)
  ) {
    return valeur as FiltrePriorite;
  }
  return "tous";
}

/** Une entrée de la liste — jamais un `<article class="mini-item">` recopié : une donnée. */
export type ElementPriorite = {
  readonly type: CategoriePriorite;
  readonly icone: NomIcone;
  readonly ton: TonKpi;
  readonly titre: string;
  readonly detail: string;
  readonly href: string;
  /** Le libellé du BOUTON d'action, quand la ligne en porte un ; sinon un simple chevron vers `href`. */
  readonly actionLibelle?: string;
};

/** Le minimum qu'une intervention porte pour entrer dans la liste. */
export type InterventionPriorisable = {
  readonly id: string;
  readonly numero: number | null;
  readonly description: string | null;
  readonly type: TypeIntervention;
  readonly client: { readonly raison_sociale: string };
  readonly site: { readonly libelle: string };
};

function detailReferenceEtSite(
  ligne: InterventionPriorisable,
  reference: (ligne: { id: string; numero: number | null }) => string,
): string {
  return `${reference(ligne)}${t("ponctuation.point_median")}${ligne.site.libelle}`;
}

/** URGENCES — « P1 à planifier » (`aPlanifier().filter(p1)`, maquette :2772). */
export function prioritesP1APlanifier(
  aPlanifier: readonly (InterventionPriorisable & {
    readonly priorite: string;
  })[],
  reference: (ligne: { id: string; numero: number | null }) => string,
): readonly ElementPriorite[] {
  return aPlanifier
    .filter((ligne) => ligne.priorite === "p1")
    .map((ligne) => ({
      type: "urgent" as const,
      icone: "zap" as const,
      ton: "rouge" as const,
      titre: `${t("tableau_de_bord.priorite_p1_titre")}${t("ponctuation.point_median")}${ligne.client.raison_sociale}`,
      detail: detailReferenceEtSite(ligne, reference),
      href: `/interventions/${ligne.id}?depuis=tableau_de_bord`,
    }));
}

/** URGENCES — « Pas démarrée » (`ivsDuJour().filter(pasDemarree)`, maquette :2773). */
export function prioritesPasDemarrees(
  lignesDuJour: readonly (InterventionPriorisable & {
    readonly statut: string;
    readonly creneau_debut: Date | null;
  })[],
  instant: Date,
  reference: (ligne: { id: string; numero: number | null }) => string,
): readonly ElementPriorite[] {
  return lignesDuJour
    .filter((ligne) => pasDemarree(ligne, instant))
    .map((ligne) => ({
      type: "urgent" as const,
      icone: "clock" as const,
      ton: "orange" as const,
      titre: `${t("tableau_de_bord.priorite_pas_demarree_titre")}${t("ponctuation.point_median")}${ligne.client.raison_sociale}`,
      detail: detailReferenceEtSite(ligne, reference),
      href: `/interventions/${ligne.id}?depuis=tableau_de_bord`,
    }));
}

/** RETARDS — « En retard » (`DATA.interventions.filter(enRetard)`, maquette :2774). */
export function prioritesEnRetard(
  lignes: readonly InterventionPriorisable[],
  reference: (ligne: { id: string; numero: number | null }) => string,
): readonly ElementPriorite[] {
  return lignes.map((ligne) => ({
    type: "retard" as const,
    icone: "calendar" as const,
    ton: "orange" as const,
    titre: `${t("tableau_de_bord.priorite_retard_titre")}${t("ponctuation.point_median")}${ligne.client.raison_sociale}`,
    detail: detailReferenceEtSite(ligne, reference),
    href: `/planning?intervention=${ligne.id}`,
    actionLibelle: t("tableau_de_bord.priorite_action_deplacer"),
  }));
}

/** À PLANIFIER OU TRANSMETTRE — « À transmettre » (`aTransmettre(TODAY)`, maquette :2775). */
export function prioritesATransmettre(
  lignesDuJour: readonly (InterventionPriorisable & {
    readonly statut: string;
    readonly creneau_debut: Date | null;
    readonly technicien_id: string | null;
  })[],
  nomDuTechnicien: (technicienId: string | null) => string,
  heure: (instant: Date) => string,
): readonly ElementPriorite[] {
  return lignesDuJour
    .filter((ligne) => ligne.statut === "planifiee")
    .map((ligne) => ({
      type: "planning" as const,
      icone: "send" as const,
      ton: "bleu" as const,
      titre: `${t("tableau_de_bord.priorite_a_transmettre_titre")}${t("ponctuation.point_median")}${ligne.client.raison_sociale}${ligne.creneau_debut === null ? "" : `, ${heure(ligne.creneau_debut)}`}`,
      detail: `${t("tableau_de_bord.priorite_a_transmettre_detail_prefixe")} ${nomDuTechnicien(ligne.technicien_id)}`,
      href: `/planning?intervention=${ligne.id}`,
      actionLibelle: t("tableau_de_bord.priorite_action_transmettre"),
    }));
}

/** À PLANIFIER OU TRANSMETTRE — « Demande à qualifier » (décision 47 d'Alexis du 09/10, D185 amende D176). */
export type DemandeAQualifierPourPriorite = {
  readonly id: string;
  readonly clientNom: string;
  readonly source: string;
  readonly deposeLe: Date;
  readonly minutesOuvrees: number;
};

export function prioritesDemandeAQualifier(
  demandes: readonly DemandeAQualifierPourPriorite[],
  heure: (instant: Date) => string,
  duree: (minutes: number) => string,
): readonly ElementPriorite[] {
  return demandes.map((demande) => ({
    type: "planning" as const,
    icone: "inbox" as const,
    ton: "bleu" as const,
    titre: `${t("tableau_de_bord.priorite_demande_titre")}${t("ponctuation.point_median")}${demande.clientNom}`,
    detail: `${t(`demande.source.${demande.source}` as CleTraduction)} ${t("tableau_de_bord.priorite_demande_detail_recu_prefixe")} ${heure(demande.deposeLe)}${t("ponctuation.point_median")}${t("tableau_de_bord.priorite_demande_detail_non_qualifiee")} ${duree(demande.minutesOuvrees)}`,
    href: `/demandes/${demande.id}`,
  }));
}

/** CONTRÔLE — « Client absent à la signature / refus » (`InterventionSignature`, décision 48 appliquée pour sa part faisable). */
export type SignatureAbsentePourPriorite = {
  readonly interventionId: string;
  readonly clientNom: string;
  readonly issue: "client_absent" | "refus_signature";
  readonly motif: string;
};

export function prioritesSignatureAbsente(
  lignes: readonly SignatureAbsentePourPriorite[],
): readonly ElementPriorite[] {
  return lignes.map((ligne) => ({
    type: "qualite" as const,
    icone: "alert-circle" as const,
    ton: "orange" as const,
    titre: `${t(
      ligne.issue === "client_absent"
        ? "tableau_de_bord.priorite_signature_absente_titre"
        : "tableau_de_bord.priorite_signature_refus_titre",
    )}${t("ponctuation.point_median")}${ligne.clientNom}`,
    detail: `${t("tableau_de_bord.priorite_signature_motif_prefixe")} ${ligne.motif}`,
    href: `/interventions/${ligne.interventionId}?depuis=tableau_de_bord`,
  }));
}

/** PIÈCES — « Pièce attendue » (`enAttenteDePiece`, la même lecture que la tuile « Suspendues »). */
export type FicheEnAttentePourPriorite = {
  readonly ligne: { readonly id: string; readonly numero: number | null };
  readonly clientNom: string;
  readonly pieceAttendueRef: string;
  readonly ancienneteJours: number;
};

export function prioritesPieces(
  enAttente: readonly FicheEnAttentePourPriorite[],
  reference: (ligne: { id: string; numero: number | null }) => string,
): readonly ElementPriorite[] {
  return enAttente.map((fiche) => ({
    type: "piece" as const,
    icone: "clipboard" as const,
    ton: "orange" as const,
    titre: `${t("tableau_de_bord.priorite_piece_titre")}${t("ponctuation.point_median")}${fiche.clientNom}`,
    detail: `${reference(fiche.ligne)} · ${fiche.pieceAttendueRef} · ${fiche.ancienneteJours} ${t("tableau_de_bord.priorite_piece_detail_suffixe")}`,
    href: `/interventions/${fiche.ligne.id}?depuis=tableau_de_bord`,
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

/** « Tous les besoins (N) » puis une option par catégorie PRÉSENTE, avec son compte (`prioritesCard`, maquette :2788). */
export function optionsFiltrePriorites(
  elements: readonly ElementPriorite[],
): readonly { readonly valeur: FiltrePriorite; readonly libelle: string }[] {
  const categoriesPresentes = CATEGORIES_PRIORITE.filter((categorie) =>
    elements.some((element) => element.type === categorie),
  );
  return [
    {
      valeur: "tous" as const,
      libelle: `${t("tableau_de_bord.priorites_filtre_tous")} (${elements.length})`,
    },
    ...categoriesPresentes.map((categorie) => ({
      valeur: categorie,
      libelle: `${t(LIBELLE_CATEGORIE[categorie])} (${elements.filter((e) => e.type === categorie).length})`,
    })),
  ];
}

/** DÉCISION 24 D'ALEXIS DU 05/10/2026 (IN-49) — sept lignes, comme la maquette. */
export const LIGNES_PRIORITES = 7;

/** « Les 7 plus urgentes, sur M » — absent sous le seuil (`prioritesCard`, maquette :2792). */
export function piedPriorites(total: number): string | undefined {
  if (total <= LIGNES_PRIORITES) {
    return undefined;
  }
  return `${t("tableau_de_bord.priorites_pied_prefixe")} ${LIGNES_PRIORITES} ${t("tableau_de_bord.priorites_pied_suffixe")} ${total}`;
}

// ═══ L'ALERTE P1 (`alerteP1`, maquette :2902) ═══════════════════════════

export function detailAlerteP1(
  nombre: number,
  minutesAttente: number,
  duree: (minutes: number) => string,
): string {
  if (nombre === 1) {
    return `${t("tableau_de_bord.alerte_p1_une_prefixe")} ${duree(minutesAttente)}.`;
  }
  return `${nombre} ${t("tableau_de_bord.alerte_p1_plusieurs_suffixe")} ${duree(minutesAttente)}.`;
}

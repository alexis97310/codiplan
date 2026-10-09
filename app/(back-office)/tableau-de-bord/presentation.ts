import { Role, type TypeIntervention } from "@prisma/client";

import { type Fuseau, versLocal } from "@/lib/calendar/fuseau";
import { t, type CleTraduction } from "@/lib/i18n/fr";
import { mot, motDansUnePhrase } from "@/lib/i18n/vocabulaire";
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
  Role.direction,
  Role.admin_societe,
] as const;
export type CompositionRole = (typeof COMPOSITIONS_ROLE)[number];

/**
 * DIRECTION ET ADMINISTRATEUR DE SOCIÉTÉ ONT DÉSORMAIS LEUR PROPRE
 * COMPOSITION (9EG-TP-UX6-TABLEAU-DE-BORD-2, D189, complète D185) — jusque-là
 * ils gardaient celle de l'ADV (lot -1).
 */
export function compositionDuRole(role: Role): CompositionRole {
  if (role === Role.responsable_materiel) {
    return Role.responsable_materiel;
  }
  if (role === Role.responsable_sav) {
    return Role.responsable_sav;
  }
  if (role === Role.direction) {
    return Role.direction;
  }
  if (role === Role.admin_societe) {
    return Role.admin_societe;
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
  | "reserves_vgp"
  | "cloture_en_mois"
  | "parc_suivi"
  | "acces_a_ouvrir"
  | "donnees_a_completer"
  | "import_en_controle";

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
  // DIRECTION ET ADMINISTRATEUR (9EG-TP-UX6-TABLEAU-DE-BORD-2, maquette
  // :2885-2886) — `a_facturer` reste ABSENTE (constat 8, aucune lecture).
  [Role.direction]: [
    "cloture_en_mois",
    "en_retard",
    "parc_suivi",
    "a_facturer",
  ],
  [Role.admin_societe]: [
    "acces_a_ouvrir",
    "donnees_a_completer",
    "import_en_controle",
    "parc_suivi",
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
  | "a_transmettre"
  | "garanties_qui_finissent"
  | "sous_garantie_ouvertes"
  | "p1_a_planifier"
  | "habilitations_echeance";

export const DECOMPTE_PAR_COMPOSITION: Readonly<
  Record<CompositionRole, DecompteRole>
> = {
  [Role.adv]: "a_transmettre",
  [Role.responsable_materiel]: "garanties_qui_finissent",
  [Role.responsable_sav]: "sous_garantie_ouvertes",
  [Role.direction]: "p1_a_planifier",
  [Role.admin_societe]: "habilitations_echeance",
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
  // DIRECTION (9EG-TP-UX6-TABLEAU-DE-BORD-2) — « Urgences, Retards, Pièces »,
  // sans « À planifier ou transmettre » ni « Contrôle ».
  [Role.direction]: ["urgent", "retard", "piece"],
  // ADMINISTRATEUR — AUCUNE carte « Priorités opérationnelles » (V4) : la
  // liste vide retire le bloc entier, jamais seulement son contenu.
  [Role.admin_societe]: [],
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

// ═══ LA TUILE « CLÔTURÉ EN <MOIS> » (direction, maquette `T.ca`, :2884) ═══

/** « Clôturé en <mois> » — le mois en toutes lettres, composé hors du dictionnaire (L0-08, L0-11). */
export function libelleClotureEnMois(mois: number): string {
  return `${t("tableau_de_bord.tuile_cloture_prefixe")} ${t(`mois.${mois}` as CleTraduction).toLowerCase()}`;
}

// ═══ LE BLOC « <MOIS ANNÉE>, AU JJ/MM » (direction, maquette `moisCard`, :2823-2826) ═══

/** « Septembre 2026, au 09/10 » — composé hors du dictionnaire (L0-08, L0-11). */
export function titreBlocMois(jour: {
  readonly annee: number;
  readonly mois: number;
  readonly jour: number;
}): string {
  const nomMois = enTeteDePhrase(t(`mois.${jour.mois}` as CleTraduction));
  const jj = String(jour.jour).padStart(2, "0");
  const mm = String(jour.mois).padStart(2, "0");
  return `${nomMois} ${jour.annee}${t("ponctuation.virgule")}${t("tableau_de_bord.bloc_mois_au_prefixe")} ${jj}/${mm}`;
}

/** « Créées »/« Clôturées » par nature, en barres triées décroissant — les natures à zéro sont masquées. */
export function barresParNature(
  comptes: ReadonlyMap<TypeIntervention, number>,
): readonly { readonly type: TypeIntervention; readonly compte: number }[] {
  return [...comptes.entries()]
    .filter(([, compte]) => compte > 0)
    .map(([type, compte]) => ({ type, compte }))
    .sort((a, b) => b.compte - a.compte);
}

// ═══ LE JOURNAL D'AUDIT (direction, administrateur — `journalCard`, maquette :2845-2848) ═══

/** DÉCISION 27 D'ALEXIS DU 05/10/2026 — les cinq dernières écritures du jour. */
export const LIGNES_JOURNAL = 5;

/** Le minimum qu'une écriture de journal porte pour être affichée. */
export type EcritureJournalAffichee = {
  readonly entite: string;
  readonly entiteId: string;
  readonly action: string;
  readonly horodatage: Date;
};

/**
 * LE LIBELLÉ DE L'ENTITÉ — une clé par entité CONNUE du dictionnaire ; une
 * entité inconnue s'affiche par son NOM DE TABLE brut (jamais une erreur). Le
 * journal couvre toute table du périmètre d'audit (I8, inversé, D55) : ce
 * dépôt n'en nomme ici qu'un sous-ensemble connu, le reste tombant sur ce
 * filet, nommé en passation.
 */
const LIBELLE_ENTITE_JOURNAL: Readonly<Record<string, CleTraduction>> = {
  intervention: "journal.entite.intervention",
  demande: "journal.entite.demande",
  client: "journal.entite.client",
  machine: "journal.entite.machine",
  utilisateur: "journal.entite.utilisateur",
  technicien: "journal.entite.technicien",
  technicien_habilitation: "journal.entite.technicien_habilitation",
  import_lot: "journal.entite.import_lot",
  absence: "journal.entite.absence",
  contact: "journal.entite.contact",
};

export function libelleEntiteJournal(entite: string): string {
  const cle = LIBELLE_ENTITE_JOURNAL[entite];
  return cle === undefined ? entite : t(cle);
}

const LIBELLE_ACTION_JOURNAL: Readonly<Record<string, CleTraduction>> = {
  creation: "journal.action.creation",
  modification: "journal.action.modification",
  suppression: "journal.action.suppression",
};

export function libelleActionJournal(action: string): string {
  const cle = LIBELLE_ACTION_JOURNAL[action];
  return cle === undefined ? action : t(cle);
}

/** La fiche visée, pour une intervention ou une demande seulement (V11). */
export function lienEcritureJournal(
  ecriture: EcritureJournalAffichee,
): string | undefined {
  if (ecriture.entite === "intervention") {
    return `/interventions/${ecriture.entiteId}?depuis=tableau_de_bord`;
  }
  if (ecriture.entite === "demande") {
    return `/demandes/${ecriture.entiteId}`;
  }
  return undefined;
}

/** « N écritures aujourd'hui » — jamais un second total, celui qu'on vient de compter. */
export function libelleCompteJournal(nombre: number): string {
  return `${nombre} ${
    nombre === 1
      ? t("tableau_de_bord.journal_compte_une")
      : t("tableau_de_bord.journal_compte")
  }`;
}

// ═══ « ACCÈS À OUVRIR » (administrateur — `accesCard`, maquette :2838-2842) ═══

/** « JJ/MM/AAAA » LOCAL — l'horodatage d'un envoi de lien, dans le bloc du tableau de bord (L0-08). */
export function dateCourteLocale(instant: Date, fuseau: Fuseau): string {
  const local = versLocal(instant, fuseau);
  const jour = String(local.jour).padStart(2, "0");
  const mois = String(local.mois).padStart(2, "0");
  return `${jour}/${mois}/${local.annee}`;
}

/** L'état d'accès d'un technicien, en clair, dans le bloc du tableau de bord. */
export function libelleEtatAccesTuile(
  etat: { readonly etat: "aucun" | "lien_envoye" | "actif" },
  dateEnvoyee: string | undefined,
): string {
  if (etat.etat === "lien_envoye" && dateEnvoyee !== undefined) {
    return `${t("equipe.acces.lien_envoye_prefixe")} ${dateEnvoyee}`;
  }
  return t("tableau_de_bord.acces_aucun_lien");
}

/** « N liens envoyés · N sans lien » — le détail de la tuile « Accès à ouvrir ». */
export function detailAccesAOuvrir(
  lignes: readonly { readonly etat: { readonly etat: string } }[],
): string {
  const lienEnvoye = lignes.filter((l) => l.etat.etat === "lien_envoye").length;
  const sansLien = lignes.filter((l) => l.etat.etat === "aucun").length;
  const libelleLienEnvoye =
    lienEnvoye === 1
      ? t("tableau_de_bord.acces_detail_lien_envoye_un")
      : t("tableau_de_bord.acces_detail_lien_envoye");
  return [
    `${lienEnvoye} ${libelleLienEnvoye}`,
    `${sansLien} ${t("tableau_de_bord.acces_detail_sans_lien")}`,
  ].join(t("ponctuation.point_median"));
}

// ═══ « MISE EN ROUTE » (administrateur — `miseEnRoute`, maquette :2828-2836) ═══

export type EtapeMiseEnRoute = {
  readonly fait: boolean;
  readonly libelle: string;
  readonly href: string;
};

/** Le minimum qu'une mise en route porte — voir `lib/tableau-de-bord/mise-en-route.ts`. */
export type FaitsMiseEnRoutePourPresentation = {
  readonly agenceAvecHoraires: boolean;
  readonly tauxHoraire: boolean;
  readonly trajetsEtForfaits: boolean;
  readonly familleMateriel: boolean;
  readonly famillesADeterminerCompte: number;
  readonly equipePosee: boolean;
  readonly accesAOuvrirCompte: number;
  readonly clientsSitesMachines: boolean;
  readonly planningTransmis: boolean;
};

/**
 * LES HUIT ÉTAPES (PU-1), CHOIX DU PILOTE VALIDÉS PAR ALEXIS LE 05/10/2026
 * (décision 29) — ÉTAPE 1 (« Identité de la société ») est TOUJOURS faite
 * (`societe.raison_sociale`/`code` NOT NULL) : aucune lecture ne la précède.
 *
 * Étape 1 ouvre `/parametres` (9DQ : `/parametres/societe` n'est plus qu'un
 * `redirect`, l'identité est désormais une carte du hub).
 */
export function etapesMiseEnRoute(
  faits: FaitsMiseEnRoutePourPresentation,
): readonly EtapeMiseEnRoute[] {
  return [
    {
      fait: true,
      libelle: t("tableau_de_bord.etape_identite"),
      href: "/parametres",
    },
    {
      fait: faits.agenceAvecHoraires,
      libelle: `${mot("agence")}${t("ponctuation.virgule")}${t("tableau_de_bord.etape_agence_detail")}`,
      href: "/parametres/agences",
    },
    {
      fait: faits.tauxHoraire,
      libelle: t("tableau_de_bord.etape_taux"),
      href: "/parametres/taux-horaire",
    },
    {
      fait: faits.trajetsEtForfaits,
      libelle: t("tableau_de_bord.etape_trajets"),
      href: "/parametres/trajets",
    },
    {
      fait: faits.familleMateriel && faits.famillesADeterminerCompte === 0,
      libelle: libelleEtapeMateriel(faits.famillesADeterminerCompte),
      href: "/parametres/materiel",
    },
    {
      fait: faits.equipePosee && faits.accesAOuvrirCompte === 0,
      libelle: libelleEtapeEquipe(faits.accesAOuvrirCompte),
      href: "/parametres/equipe?acces=a-ouvrir",
    },
    {
      fait: faits.clientsSitesMachines,
      libelle: libelleEtapeImportes(),
      href: "/imports",
    },
    {
      fait: faits.planningTransmis,
      libelle: t("tableau_de_bord.etape_planning"),
      href: "/planning",
    },
  ];
}

function libelleEtapeMateriel(famillesADeterminerCompte: number): string {
  if (famillesADeterminerCompte === 0) {
    return t("tableau_de_bord.etape_materiel");
  }
  const suffixe =
    famillesADeterminerCompte === 1
      ? t("tableau_de_bord.etape_materiel_detail_une")
      : t("tableau_de_bord.etape_materiel_detail");
  return `${t("tableau_de_bord.etape_materiel")}${t("ponctuation.point_median")}${famillesADeterminerCompte} ${suffixe}`;
}

function libelleEtapeEquipe(accesAOuvrirCompte: number): string {
  if (accesAOuvrirCompte === 0) {
    return t("tableau_de_bord.etape_equipe");
  }
  return `${t("tableau_de_bord.etape_equipe")}${t("ponctuation.point_median")}${accesAOuvrirCompte} ${t("tableau_de_bord.acces_detail_a_ouvrir")}`;
}

function libelleEtapeImportes(): string {
  return `${t("tableau_de_bord.etape_importes_prefixe")}${t("ponctuation.virgule")}${motDansUnePhrase("site", true)} ${t("tableau_de_bord.etape_importes_suffixe")}`;
}

/** « N sur 8 » — l'étiquette de la jauge, numérateur ET dénominateur toujours visibles (D56). */
export function libelleJauge(etapes: readonly EtapeMiseEnRoute[]): string {
  const faites = etapes.filter((etape) => etape.fait).length;
  return `${faites} ${t("tableau_de_bord.mise_en_route_sur")} ${etapes.length}`;
}

export function pourcentageJauge(etapes: readonly EtapeMiseEnRoute[]): number {
  const faites = etapes.filter((etape) => etape.fait).length;
  return etapes.length === 0 ? 0 : Math.round((faites / etapes.length) * 100);
}

// ═══ LA BANDE DE L'ADMINISTRATEUR — HABILITATIONS (`bandeByRole.admin`, maquette :2894) ═══

export function libelleHabilitationsExpirees(nombre: number): string {
  return nombre === 1
    ? t("tableau_de_bord.bande_habilitation_expiree_un")
    : t("tableau_de_bord.bande_habilitation_expiree");
}

export function libelleHabilitationsARenouveler(nombre: number): string {
  return nombre === 1
    ? t("tableau_de_bord.bande_habilitation_renouveler_un")
    : t("tableau_de_bord.bande_habilitation_renouveler");
}

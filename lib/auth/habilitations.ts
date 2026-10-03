import { Role } from "./roles";

/**
 * Matrice des rôles — ce que chaque rôle peut faire (ticket L0-06, corrigé par
 * l'arbitrage D37).
 *
 * **Source.** La règle de gestion RG-DRO-03 renvoie explicitement à « la matrice
 * du §5.2 » du cahier des charges : cette matrice est donc normative par
 * renvoi, et c'est elle qui est transcrite ici, ligne pour ligne. Les rôles
 * éditeur du §22.5, absents de la matrice parce qu'ils se situent au-dessus des
 * sociétés, y sont ajoutés d'après le tableau du §22.5. **Le §5.2 fait foi :
 * aucun rôle n'est recopié ailleurs.**
 *
 * **Quatre corrections d'arbitrage** sont appliquées à la matrice d'origine, la
 * note d'arbitrage primant sur le cahier des charges (D1) :
 *   - 3.17 — le technicien ne clôture pas : « il termine, le responsable valide
 *     et clôture ». Le `○` de la ligne « clôturer » devenait « aucun ».
 *   - 3.8 — aucun montant sur le portail client en V1 : « le `○` de la matrice
 *     devient `—` » sur la ligne « voir les montants de vente ».
 *   - D37 — la colonne « Admin » est SCINDÉE, voir ci-dessous.
 *   - D131 (arbitrage Alexis, 23/09/2026, ticket DROITS-1) — RÉTABLIT le `○`
 *     que 3.17 avait retiré, mais SCOPÉ : le technicien clôture, suspend et
 *     reprend SES PROPRES interventions, jamais celles d'un collègue (le
 *     dépôt juge le périmètre, la porte ne le juge pas — voir
 *     `lib/auth/porte.ts`). Il n'annule jamais. Trois lignes ABSENTES du §5.2
 *     sont ajoutées par le même arbitrage : « annuler une intervention »,
 *     « suspendre / reprendre une intervention », « enregistrer une
 *     vérification VGP » — la troisième restreinte de la même façon, sur les
 *     machines des interventions du technicien. Le tableau complet et son
 *     motif vivent dans `docs/arbitrages.md` (D131).
 *
 * **La colonne « Admin » n'est plus celle d'`admin_plateforme` (D37).** Elle
 * l'était, et c'était l'erreur : créer un compte chez un client passait alors
 * par l'éditeur, ce qui est intenable dès la première vente. Toutes les lignes
 * du §5.2 sont de portée SOCIÉTÉ — la matrice décrit ce qui se fait à
 * l'intérieur d'une société —, elles reviennent donc à `admin_societe`. Ce qui
 * reste à `admin_plateforme` est de portée PLATEFORME, et se lit au §22.5 :
 * comptes clients, abonnements, indicateurs éditeur, support, « connexion en
 * tant que », plus les référentiels de plateforme de I1.
 *
 * Deux réserves sur `admin_societe`, posées par D37 :
 *   - il ne lit pas les données financières — montants de vente, marges,
 *     éléments à facturer restent à la direction ;
 *   - il administre en revanche les **agences** de sa société, ligne que le
 *     §5.2 n'avait pas et qui est ajoutée ici. Les habilitations, elles, sont
 *     des lignes d'`utilisateur_societe` : elles relèvent d'« administrer les
 *     utilisateurs ».
 *
 * Une capacité ne donne accès à rien tant qu'aucune société n'est active, et
 * activer une société suppose une habilitation dans `utilisateur_societe` —
 * qu'un salarié de l'éditeur n'a pas. La capacité dit ce qu'un rôle a le droit
 * de faire ; le cloisonnement dit sur quelles données. Les deux se cumulent.
 */

/** Degré d'accès, tel que la matrice le note : ● complet, ○ restreint, — aucun. */
export type Niveau = "complet" | "restreint" | "aucun";

/** Les capacités de la matrice §5.2, puis celles du §22.5 et de I1. */
export const CAPACITES = [
  "consulter_planning",
  "modifier_planning",
  "creer_demande",
  "qualifier_affecter",
  "saisir_rapport",
  "valider_rapport",
  "cloturer_intervention",
  // D131 (23/09/2026, DROITS-1) — absentes du §5.2, arbitrées avec
  // « clôturer une intervention » plutôt que devinées séparément.
  "annuler_intervention",
  "suspendre_reprendre_intervention",
  "enregistrer_vgp",
  "gerer_contrat",
  "gerer_machine",
  "gerer_client_site",
  "consulter_parc_complet",
  "consulter_parc_propre",
  // D153 (03/10/2026, TP-S3) — lecture des clients et des sites, distincte de
  // `gerer_client_site` qui en porte l'écriture.
  "consulter_clients_sites",
  "voir_montants_vente",
  "voir_marges",
  "preparer_facturation",
  "importer_exporter",
  "parametrer_societe",
  "administrer_utilisateurs",
  "administrer_agences",
  // D153 (03/10/2026, TP-S3, décision PA-25) — l'ADV règle les temps de
  // trajet par zone ; absente du §5.2, qui ne connaît pas ce rôle sur
  // `parametrer_societe`.
  "regler_trajets",
  "consulter_journal_audit",
  "gerer_comptes_clients",
  "gerer_abonnements",
  "consulter_indicateurs_editeur",
  "support_technique",
  "connexion_en_tant_que",
  "modifier_referentiel_plateforme",
] as const;

export type Capacite = (typeof CAPACITES)[number];

/** Une ligne de la matrice : qui a ●, qui a ○. Tout le reste est « aucun ». */
type Ligne = {
  readonly complet: readonly Role[];
  readonly restreint?: readonly Role[];
};

const A = Role.admin_plateforme;
const EC = Role.editeur_commercial;
const ES = Role.editeur_support;
const ADMS = Role.admin_societe;
const DIR = Role.direction;
const RM = Role.responsable_materiel;
const RS = Role.responsable_sav;
const ADV = Role.adv;
const TEC = Role.technicien;
const CLI = Role.client;

const MATRICE: Readonly<Record<Capacite, Ligne>> = {
  // ── §5.2 — toutes ces lignes sont de portée SOCIÉTÉ (D37) ────────────────
  consulter_planning: { complet: [ADMS, DIR, RM, RS, ADV], restreint: [TEC] },
  modifier_planning: { complet: [ADMS, DIR, RM, RS, ADV] },
  creer_demande: { complet: [ADMS, DIR, RM, RS, ADV, TEC, CLI] },
  qualifier_affecter: { complet: [ADMS, DIR, RM, RS, ADV] },
  // D151 (03/10/2026, reprise 9DCA de 9DC-TP-S2-S5) — le technicien passe en
  // ○ : le RENFORT (un technicien non affecté) ne fait que POINTER son temps
  // (le compteur, hors de cette ligne) ; rapport, prestations, photos et
  // signature restent réservés au technicien AFFECTÉ. Avant cette décision,
  // `saisir_rapport` était ● pour TEC, et `accesSurCetteIntervention` sur
  // cette capacité rendait donc toujours vrai — le ○ est ce qui rend le
  // périmètre du dépôt (`lib/interventions/depot-rapport-terrain.ts`,
  // `lib/documents/depot.ts`) effectif.
  saisir_rapport: { complet: [ADMS, RM, RS], restreint: [TEC] },
  valider_rapport: { complet: [ADMS, DIR, RM, RS] },
  // D131 (23/09/2026) rétablit le ○ que l'arbitrage 3.17 avait retiré, mais
  // SCOPÉ : le technicien ne clôture que SA PROPRE intervention affectée — la
  // porte laisse passer le ○ (`lib/auth/porte.ts`), le dépôt juge le
  // périmètre (`lib/interventions/depot.ts`, `perimetreParPersonne`).
  cloturer_intervention: {
    complet: [ADMS, DIR, RM, RS, ADV],
    restreint: [TEC],
  },
  // D131 — absente du §5.2 : le bureau annule, le technicien jamais (une
  // annulation est une décision commerciale).
  annuler_intervention: { complet: [ADMS, DIR, RM, RS, ADV] },
  // D131 — absente du §5.2, même périmètre scopé que « clôturer ».
  suspendre_reprendre_intervention: {
    complet: [ADMS, DIR, RM, RS, ADV],
    restreint: [TEC],
  },
  // D131 — absente du §5.2 : le technicien n'enregistre une VGP que sur une
  // machine portée par une de SES interventions non annulées (le dépôt le
  // vérifie en base, la porte ne le juge pas).
  enregistrer_vgp: { complet: [ADMS, DIR, RM, RS, ADV], restreint: [TEC] },
  gerer_contrat: { complet: [ADMS, DIR, RM], restreint: [ADV] },
  gerer_machine: { complet: [ADMS, DIR, RM, RS, ADV, TEC] },
  // D130 : la fiche client et la fiche site sont du référentiel commercial,
  // pas de l'exploitation — responsable_materiel et responsable_sav en sont
  // délibérément absents, malgré leur accès complet à la machine.
  gerer_client_site: { complet: [ADMS, DIR, ADV] },
  // Le ○ du technicien est la restriction de RG-DRO-02, précisée par D22 :
  // les machines de ses interventions, le parc des clients qu'il visite sous
  // 7 jours, et la résolution par QR. Le périmètre lui-même relève du lot 2.
  consulter_parc_complet: {
    complet: [ADMS, DIR, RM, RS, ADV],
    restreint: [TEC],
  },
  consulter_parc_propre: { complet: [CLI] },
  // D153 (03/10/2026, TP-S3, constat CS6) — la fiche client et la fiche site
  // sont LUES par les responsables d'exploitation, qui en ont besoin pour
  // leur travail quotidien (planifier une intervention, juger une VGP), sans
  // pouvoir les modifier : `gerer_client_site` reste réservé à ADMS, DIR, ADV
  // (D130). Capacité de LECTURE seule, jamais confondue avec l'écriture.
  consulter_clients_sites: { complet: [ADMS, DIR, RM, RS, ADV] },
  // Arbitrage 3.8 : aucun montant sur le portail client en V1 — le ○ du client
  // devient « aucun ». D37 : l'administrateur de société ne lit pas les données
  // financières, elles restent à la direction.
  voir_montants_vente: { complet: [DIR, RM, RS, ADV] },
  voir_marges: { complet: [DIR, RM], restreint: [RS] },
  preparer_facturation: { complet: [DIR, RM, ADV] },
  importer_exporter: { complet: [ADMS, DIR, RM, ADV], restreint: [RS] },
  // D153 (03/10/2026, TP-S3, décision PA-02) — le ○ de la direction est
  // désormais LECTURE SEULE : `exigerCapaciteComplete` (lib/auth/porte.ts),
  // appelée par les treize routes d'écriture de taux, forfaits, matériel et
  // prestations, exige le ● et refuse le ○. `exigerCapacite` (le ○ comme le
  // ●) ne garde plus que la LECTURE de ces écrans.
  parametrer_societe: { complet: [ADMS], restreint: [DIR] },
  administrer_utilisateurs: { complet: [ADMS] },
  // Ligne ajoutée par D37 : « il administre comptes, agences et habilitations
  // de SA société ». Les agences sont des établissements CODIMA (D5), pas des
  // sites clients — le vocabulaire est imposé.
  administrer_agences: { complet: [ADMS] },
  // D153 (03/10/2026, TP-S3, décision PA-25/D107) — l'ADV règle les trajets ;
  // la direction y garde le ○ de PA-02 (LECTURE SEULE, jamais l'écriture).
  // Personne d'autre : ni RM, ni RS, pour qui le trajet est une donnée de
  // planification, pas un tarif qu'ils posent.
  regler_trajets: { complet: [ADMS, ADV], restreint: [DIR] },
  consulter_journal_audit: { complet: [ADMS, DIR] },
  // ── §22.5 — les trois rôles éditeur, de portée PLATEFORME ────────────────
  gerer_comptes_clients: { complet: [A] },
  gerer_abonnements: { complet: [A, EC] },
  consulter_indicateurs_editeur: { complet: [A, EC] },
  support_technique: { complet: [A, ES] },
  // « Sur demande explicite du client, avec traçabilité et notification » : un
  // accès restreint, jamais permanent. C'est le SEUL chemin par lequel un
  // salarié de l'éditeur atteint les données d'un client (D37).
  connexion_en_tant_que: { complet: [A], restreint: [ES] },
  // I1 — les référentiels de plateforme sont modifiables par les seuls rôles
  // éditeur. La base applique la même règle (`app_est_role_editeur`), et
  // `admin_societe` n'en fait pas partie : il administre SA société, pas la
  // plateforme.
  modifier_referentiel_plateforme: { complet: [A, EC, ES] },
};

/** Degré d'accès d'un rôle sur une capacité. */
export function niveau(role: Role, capacite: Capacite): Niveau {
  const ligne = MATRICE[capacite];
  if (ligne.complet.includes(role)) {
    return "complet";
  }
  if (ligne.restreint?.includes(role)) {
    return "restreint";
  }
  return "aucun";
}

/** Vrai si le rôle a un accès, complet ou restreint. */
export function peut(role: Role, capacite: Capacite): boolean {
  return niveau(role, capacite) !== "aucun";
}

/** Vrai si le rôle a un accès complet — le ○ ne suffit pas. */
export function peutPleinement(role: Role, capacite: Capacite): boolean {
  return niveau(role, capacite) === "complet";
}

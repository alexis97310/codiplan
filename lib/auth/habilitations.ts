import { Role } from "./roles";

/**
 * Matrice des rôles — ce que chaque rôle peut faire (ticket L0-06).
 *
 * **Source.** La règle de gestion RG-DRO-03 renvoie explicitement à « la matrice
 * du §5.2 » du cahier des charges : cette matrice est donc normative par
 * renvoi, et c'est elle qui est transcrite ici, ligne pour ligne. Les trois
 * rôles éditeur du §22.5, absents de la matrice parce qu'ils se situent
 * au-dessus des sociétés, y sont ajoutés d'après le tableau du §22.5.
 *
 * **Deux corrections d'arbitrage** sont appliquées à la matrice d'origine, la
 * note d'arbitrage primant sur le cahier des charges (D1) :
 *   - 3.17 — le technicien ne clôture pas : « il termine, le responsable valide
 *     et clôture ». Le `○` de la ligne « clôturer » devient « aucun ».
 *   - 3.8 — aucun montant sur le portail client en V1 : « le `○` de la matrice
 *     devient `—` » sur la ligne « voir les montants de vente ».
 *
 * **La colonne « Admin » est celle d'`admin_plateforme`.** L'énumération
 * canonique est close et ne comporte pas d'autre rôle d'administration ; le
 * §22.5 donne d'ailleurs au super-administrateur plateforme « tout ». Cela ne
 * contredit pas le principe « aucun accès par défaut aux données d'un client » :
 * une capacité ne donne accès à rien tant qu'aucune société n'est active, et
 * n'activer une société suppose une habilitation dans `utilisateur_societe` —
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
  "gerer_contrat",
  "gerer_machine",
  "consulter_parc_complet",
  "consulter_parc_propre",
  "voir_montants_vente",
  "voir_marges",
  "preparer_facturation",
  "importer_exporter",
  "parametrer_societe",
  "administrer_utilisateurs",
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
const DIR = Role.direction;
const RM = Role.responsable_materiel;
const RS = Role.responsable_sav;
const ADV = Role.adv;
const TEC = Role.technicien;
const CLI = Role.client;

const MATRICE: Readonly<Record<Capacite, Ligne>> = {
  consulter_planning: { complet: [A, DIR, RM, RS, ADV], restreint: [TEC] },
  modifier_planning: { complet: [A, DIR, RM, RS, ADV] },
  creer_demande: { complet: [A, DIR, RM, RS, ADV, TEC, CLI] },
  qualifier_affecter: { complet: [A, DIR, RM, RS, ADV] },
  saisir_rapport: { complet: [A, RM, RS, TEC] },
  valider_rapport: { complet: [A, DIR, RM, RS] },
  // Arbitrage 3.17 : le technicien ne clôture pas — le ○ d'origine est retiré.
  cloturer_intervention: { complet: [A, DIR, RM, RS, ADV] },
  gerer_contrat: { complet: [A, DIR, RM], restreint: [ADV] },
  gerer_machine: { complet: [A, DIR, RM, RS, ADV, TEC] },
  // Le ○ du technicien est la restriction de RG-DRO-02, précisée par D22 :
  // les machines de ses interventions, le parc des clients qu'il visite sous
  // 7 jours, et la résolution par QR. Le périmètre lui-même relève du lot 2.
  consulter_parc_complet: { complet: [A, DIR, RM, RS, ADV], restreint: [TEC] },
  consulter_parc_propre: { complet: [CLI] },
  // Arbitrage 3.8 : aucun montant sur le portail client en V1 — le ○ du client
  // devient « aucun ».
  voir_montants_vente: { complet: [A, DIR, RM, RS, ADV] },
  voir_marges: { complet: [A, DIR, RM], restreint: [RS] },
  preparer_facturation: { complet: [A, DIR, RM, ADV] },
  importer_exporter: { complet: [A, DIR, RM, ADV], restreint: [RS] },
  parametrer_societe: { complet: [A], restreint: [DIR] },
  administrer_utilisateurs: { complet: [A] },
  consulter_journal_audit: { complet: [A, DIR] },
  // §22.5 — les trois rôles éditeur.
  gerer_comptes_clients: { complet: [A] },
  gerer_abonnements: { complet: [A, EC] },
  consulter_indicateurs_editeur: { complet: [A, EC] },
  support_technique: { complet: [A, ES] },
  // « Sur demande explicite du client, avec traçabilité et notification » : un
  // accès restreint, jamais permanent.
  connexion_en_tant_que: { complet: [A], restreint: [ES] },
  // I1 — les référentiels de plateforme sont modifiables par les seuls rôles
  // éditeur. La base applique la même règle (`app_est_role_editeur`).
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

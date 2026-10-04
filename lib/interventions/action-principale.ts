import type { StatutIntervention } from "./saisie";

/**
 * L'ACTION PRINCIPALE DE LA FICHE (93-FICHE-ACTIONS, constat 19 de l'audit du
 * 25/09/2026) — laquelle des actions du panneau « Actions » fait avancer
 * l'intervention, pour ce statut-là.
 *
 * Ce module ne décide RIEN que `lib/interventions/cycle-de-vie.ts` ne décide
 * déjà — il ne dit pas si l'action est PERMISE, seulement laquelle, si elle
 * l'est, est CELLE QUI COMPTE. Le panneau restait juste — sept blocs ouverts,
 * chacun avec son verdict propre — mais rien n'y disait laquelle faire
 * ensuite ; ce module répond à cette seule question, à l'écran, jamais en
 * base.
 */
export type ActionPrincipale =
  "planifier" | "transmettre" | "reprendre" | "cloturer" | null;

const PAR_STATUT: Readonly<Record<StatutIntervention, ActionPrincipale>> = {
  a_planifier: "planifier",
  // TRANSMETTRE, PAS AFFECTER (QG-5, D141, 9CO-PG-G14A-TRANSMETTRE) — une
  // Planifiée porte déjà son technicien (PARCOURS-1 exige les quatre valeurs
  // ensemble) ; ce qui fait avancer l'intervention est de la transmettre, pas
  // de réaffecter. « Affecter un technicien » reste une action SECONDAIRE,
  // pour changer le technicien avant transmission.
  planifiee: "transmettre",
  affectee: null,
  en_cours: null,
  suspendue: "reprendre",
  terminee: "cloturer",
  cloturee: null,
  annulee: null,
};

export function actionPrincipale(statut: StatutIntervention): ActionPrincipale {
  return PAR_STATUT[statut];
}

/**
 * LE BLOC « CLÔTURER » SE REPLIE-T-IL ? (99T-G9-CLOTURER-REPLIE, 26/09/2026,
 * audit d'ergonomie constat G9, décision d'Alexis : « OUI, replier »)
 *
 * Le refus « aucun temps mesuré » (`intervention.refus.temps_manquant`)
 * s'affichait déplié, en oxyde, sur CHAQUE fiche non terminée — à force de le
 * voir sur chaque intervention, on ne le remarquait plus. Il ne reste déplié
 * que sur l'intervention `terminee`, la seule où « Clôturer » EST l'action
 * principale (`actionPrincipale`) et où un refus a un sens à signaler
 * tout de suite.
 *
 * **GÉNÉRALISÉ À TOUT REFUS (D160, 9DF-TP-CY2-MATRICE-D8).** `peutCloturer`
 * refuse désormais aussi depuis `en_cours`, `suspendue`, `planifiee`,
 * `affectee` et `a_planifier` (QT-4, D8 à la lettre : « cloture seulement
 * depuis Terminee »), avec la clé `intervention.refus.pas_terminee` — la
 * restreindre à la seule clé `temps_manquant` aurait laissé CETTE clé-là
 * s'afficher dépliée sur chaque fiche non terminée, reproduisant exactement
 * le défaut que G9 a fermé. Le critère redevient donc simplement : un refus
 * ne reste déplié que là où « Clôturer » est l'action principale.
 */
export function blocCloturerReplie(params: {
  readonly statut: StatutIntervention;
  readonly verdict: { readonly refuse: boolean; readonly cle?: string };
}): boolean {
  return params.statut !== "terminee" && params.verdict.refuse;
}

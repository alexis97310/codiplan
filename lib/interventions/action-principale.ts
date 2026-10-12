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

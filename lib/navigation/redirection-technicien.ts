/**
 * QUELLE INTERVENTION UNE URL DU BACK-OFFICE NOMME-T-ELLE ? (D221, décision
 * d'Alexis du 21/10/2026, 9G8-TERRAIN-CONFIRMATIONS-ET-ACCES).
 *
 * Fonction PURE — aucune session, aucune base : seulement reconnaître la
 * FORME d'un chemin. `app/(back-office)/layout.tsx` l'appelle avec le
 * chemin porté par `middleware.ts` (voir son en-tête), puis juge seul ce
 * qu'il faut faire de cet identifiant — ce module ne le fait jamais.
 *
 * Les deux SEULES routes du back-office qui portent un identifiant
 * D'INTERVENTION sont `/interventions/<id>` et `/interventions/<id>/bon` —
 * toutes les autres routes `[id]` du périmètre (`clients/[id]`,
 * `sites/[id]`, `demandes/[id]`, `imports/[id]`, `parc/[id]`,
 * `parametres/agences/[agenceId]`, `parametres/forfaits/[id]`,
 * `parametres/agences/calendrier/[id]`, `vgp/enregistrer/[id]`) nomment une
 * AUTRE sorte d'identifiant, et ne doivent jamais être confondues avec
 * celle-ci.
 */
const MOTIF_FICHE_INTERVENTION =
  /^\/interventions\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/bon)?\/?$/i;

export function idInterventionDuChemin(chemin: string): string | null {
  const correspondance = MOTIF_FICHE_INTERVENTION.exec(chemin);
  return correspondance === null ? null : correspondance[1];
}

/**
 * `/arrivee` EST OUVERTE À TOUT RÔLE (99A-ARRIVEE) — elle décide déjà SEULE,
 * pour le technicien comme pour n'importe qui d'autre (une société unique y
 * redirige d'emblée vers `/terrain`, plusieurs y affichent le choix), où
 * aller. Un garde-fou qui la précéderait casserait ce choix qu'elle rend
 * déjà correctement.
 */
export const CHEMIN_EXEMPTE_DU_GARDE_TECHNICIEN = "/arrivee";

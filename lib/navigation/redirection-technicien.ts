/**
 * QUELLE INTERVENTION UNE URL DU BACK-OFFICE NOMME-T-ELLE ? (D221, décision
 * d'Alexis du 21/10/2026, 9G8-TERRAIN-CONFIRMATIONS-ET-ACCES).
 *
 * Fonction PURE — aucune session, aucune base : seulement reconnaître la
 * FORME d'un chemin. `app/(back-office)/template.tsx` l'appelle avec le
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

/**
 * `/absences?declarer=1` RESTE OUVERTE AU TECHNICIEN (précision du
 * 24/10/2026 sous D221, décision d'Alexis, 9G8B-REPRISE-9G8A) : D221 avait
 * fermé cette route par effet de bord, en même temps que le reste du
 * back-office ; Alexis a rouvert SEULEMENT cette route — un technicien
 * garde un ○ sur `modifier_planning` pour déclarer sa propre absence
 * (TR-5, D152/QT-2), et cette capacité reste sans équivalent terrain.
 * Le reste de `/absences` (la liste, écourter, lever) suit D221 sans
 * changement : seul le volet de DÉCLARATION est concerné, jamais la page
 * nue.
 *
 * Reçoit le chemin ET la recherche séparément, jamais une URL recomposée —
 * `?declarer=1` n'ouvre le volet que si la VALEUR vaut exactement `1`
 * (même lecture que `app/(back-office)/absences/page.tsx`), pas sa seule
 * présence.
 */
export function declarationAbsenceOuverteAuTechnicien(
  chemin: string,
  recherche: string,
): boolean {
  if (chemin !== "/absences") {
    return false;
  }
  return new URLSearchParams(recherche).get("declarer") === "1";
}

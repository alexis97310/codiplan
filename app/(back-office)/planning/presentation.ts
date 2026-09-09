/**
 * CE QUE LE PLANNING AFFICHE — et qui n'est ni une règle métier, ni une couleur.
 *
 * **Les couleurs de statut ne sont PAS ici** : elles sont dans
 * `lib/theme/statuts.ts`, le seul endroit du dépôt où une couleur s'écrit en
 * clair (CLAUDE.md §6). Elles y ont été déplacées le jour où elles ont été
 * écrites ici — c'est le gardien qui l'a dit, pas la relecture.
 */

/**
 * LA RÉFÉRENCE AFFICHÉE — `numero`, ou `Local-<6 caractères>` tant qu'il est nul
 * (I10).
 *
 * Le numéro est attribué par le serveur à la première synchronisation, et
 * PERSONNE ne l'attribue aujourd'hui : la référence est donc toujours locale
 * pour l'instant, et l'écran le dit plutôt que d'afficher un vide.
 */
export function referenceAffichee(ligne: {
  id: string;
  numero: number | null;
}): string {
  if (ligne.numero !== null) {
    return `INT-${String(ligne.numero).padStart(5, "0")}`;
  }
  return `Local-${ligne.id.replaceAll("-", "").slice(-6).toUpperCase()}`;
}

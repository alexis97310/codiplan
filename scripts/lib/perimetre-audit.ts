/**
 * LE PÉRIMÈTRE DU JOURNAL D'AUDIT — invariant I8, arbitrages D32, D52, D53.
 *
 * **Ce fichier est la seule maison de cette liste.** Ni l'invariant I8 du
 * CLAUDE.md, ni la règle RG-DRO-04 du chapitre 10, ni le README ne l'énumèrent :
 * tous trois y renvoient. La onzième table s'ajoutera à un seul endroit parce
 * qu'il n'y en aura qu'un *(D53)*.
 *
 * **Pourquoi la recopie a été retirée.** Elle était délibérée et argumentée —
 * « c'est la constitution qui est confrontée au dépôt ». Mais rien ne
 * confrontait la recopie à la constitution : deux listes qui pouvaient diverger
 * en silence, exactement le défaut d'É8 une catégorie plus bas. L'indépendance
 * réelle du gardien ne vient pas de la recopie ; elle vient de ce qu'il
 * confronte cette liste à ce que les MIGRATIONS font vraiment, et à ce que le
 * SCHÉMA contient vraiment — deux sources qu'il ne contrôle pas.
 *
 * La liste est close DES DEUX CÔTÉS depuis D52 : une table qui y figure et
 * existe au schéma doit porter son déclencheur ; un déclencheur posé sur une
 * table qui n'y figure pas est refusé, quelle qu'elle soit. Élargir la
 * traçabilité est un arbitrage, jamais une décision de ticket.
 */

/** Ce que le déclencheur d'audit s'appelle, partout où il est posé. */
export const NOM_DECLENCHEUR = "journal_audit";

/** Une entrée du périmètre. `lot` dit d'où la table viendra quand elle n'existe pas encore. */
export type EntreePerimetre = {
  readonly entite: string;
  readonly table: string;
  readonly lot: string | null;
};

export const PERIMETRE_I8: readonly EntreePerimetre[] = [
  { entite: "paramétrage de la société", table: "societe", lot: null },
  { entite: "établissements (D5)", table: "agence", lot: null },
  { entite: "heures d'ouverture (D13)", table: "calendrier", lot: null },
  { entite: "heures d'ouverture (D13)", table: "calendrier_plage", lot: null },
  {
    entite: "écarts locaux de calendrier (D46)",
    table: "calendrier_ferie",
    lot: null,
  },
  // D52 — c'est par cette table qu'on se donne un accès. « Qui a accordé ce
  // droit, quand, depuis quelle valeur » est la question de l'auditeur, et
  // celle qui rend vérifiable la procédure de déblocage de D40 (L7-01).
  { entite: "habilitations (D52)", table: "utilisateur_societe", lot: null },
  { entite: "comptes portail (D10)", table: "utilisateur_client", lot: null },
  // Les trois tables métier qui n'existent pas encore.
  { entite: "fiches machine", table: "machine", lot: "L2-01" },
  { entite: "interventions", table: "intervention", lot: "L2-07" },
  { entite: "contrats", table: "contrat", lot: "lot 4" },
] as const;

/** Les noms SQL du périmètre, dans l'ordre de la liste. */
export function tablesDuPerimetre(
  perimetre: readonly EntreePerimetre[] = PERIMETRE_I8,
): string[] {
  return perimetre.map((entree) => entree.table);
}

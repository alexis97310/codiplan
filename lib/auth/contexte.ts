import { z } from "zod";

import { exigeSecondFacteur, schemaRole, type Role } from "./roles";

/**
 * Contexte porté par une session serveur (ticket L0-06).
 *
 * C'est le seul objet qui autorise une lecture cloisonnée : `societeId` alimente
 * `app.societe_id` et `role` alimente `app.role`. Les décisions ci-dessous sont
 * pures — aucune base, aucun cadre web — pour qu'elles soient éprouvées par des
 * tests unitaires et non seulement par le bout de la chaîne.
 */

/** Contexte tel que la session le porte. Société et rôle vont toujours ensemble. */
export type ContexteSession = {
  /** Identifiant du compte connecté. */
  utilisateurId: string;
  /** Société active, `null` tant qu'aucune n'a été choisie ou accordée. */
  societeId: string | null;
  /** Rôle tenu sur cette société, `null` en l'absence de société active. */
  role: Role | null;
  /** Le second facteur a été présenté et validé à l'ouverture de la session. */
  secondFacteurValide: boolean;
};

export const schemaContexteSession = z.object({
  utilisateurId: z.uuid(),
  societeId: z.uuid().nullable(),
  role: schemaRole.nullable(),
  secondFacteurValide: z.boolean(),
});

/** Contexte dont la société et le rôle sont établis : le seul qui lit quelque chose. */
export type ContexteActif = ContexteSession & {
  societeId: string;
  role: Role;
};

/**
 * Motif de refus d'un contexte, ou `null` s'il peut ouvrir une transaction
 * cloisonnée.
 *
 * Trois refus, dans cet ordre :
 *   1. **aucune société active** — la session ne doit alors rien pouvoir lire.
 *      La base le garantit déjà (sans `app.societe_id`, les politiques
 *      renvoient zéro ligne) ; on refuse néanmoins d'ouvrir la transaction,
 *      pour que l'absence de société soit une erreur explicite et non une liste
 *      vide qu'un écran afficherait comme « aucun résultat » ;
 *   2. **rôle manquant** — une société sans rôle ne dit pas ce que l'utilisateur
 *      a le droit d'y faire, et laisserait `app.role` vide ;
 *   3. **second facteur absent** sur un rôle qui l'exige (`admin_plateforme`,
 *      `direction`).
 */
export function motifRefusContexte(contexte: ContexteSession): string | null {
  if (contexte.societeId === null) {
    return (
      "Aucune société active sur cette session : aucune donnée cloisonnée ne " +
      "peut être lue. Activer une société sur laquelle le compte est habilité."
    );
  }
  if (contexte.role === null) {
    return (
      "Session sans rôle sur la société active : le rôle est requis pour " +
      "déterminer les droits et alimenter `app.role`."
    );
  }
  if (exigeSecondFacteur(contexte.role) && !contexte.secondFacteurValide) {
    return (
      `Le rôle « ${contexte.role} » exige un second facteur, absent de cette ` +
      "session. Activer le second facteur sur le compte, puis se reconnecter."
    );
  }
  return null;
}

/** Vrai si le contexte porte une société et un rôle exploitables. */
export function estContexteActif(
  contexte: ContexteSession,
): contexte is ContexteActif {
  return motifRefusContexte(contexte) === null;
}

/** Renvoie le contexte actif, ou lève avec le motif du refus. */
export function exigerContexteActif(contexte: ContexteSession): ContexteActif {
  const motif = motifRefusContexte(contexte);
  if (motif !== null) {
    throw new Error(motif);
  }
  return contexte as ContexteActif;
}

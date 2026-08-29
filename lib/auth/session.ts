import { z } from "zod";

import { auth } from "./config";
import { type ContexteSession } from "./contexte";
import { schemaRole } from "./roles";

/**
 * Lecture de la session serveur (ticket L0-06).
 *
 * Better Auth range la session en base ; le navigateur ne porte qu'un jeton
 * signé. Ce module en tire le contexte de `lib/auth/contexte` — société active,
 * rôle, second facteur —, seul objet que `lib/db/client` accepte pour ouvrir une
 * transaction cloisonnée.
 */

/**
 * Les trois colonnes que CODIPLAN ajoute à la session. Elles sont relues par un
 * schéma plutôt que par une conversion de type : une valeur inattendue en base
 * — un rôle retiré de l'énumération, par exemple — doit dégrader la session en
 * « aucune société active », pas se propager en aval.
 */
const schemaChampsSession = z.object({
  societe_id_active: z.uuid().nullish(),
  role_actif: schemaRole.nullish(),
  second_facteur_valide: z.boolean().nullish(),
});

/** Session serveur telle que l'application la manipule. */
export type SessionServeur = {
  /** Identifiant de la ligne `session`, requis pour basculer de société. */
  sessionId: string;
  contexte: ContexteSession;
};

/**
 * Renvoie la session serveur associée aux en-têtes de la requête, ou `null`
 * si personne n'est authentifié.
 */
export async function obtenirSession(
  entetes: Headers,
): Promise<SessionServeur | null> {
  const resultat = await auth().api.getSession({ headers: entetes });
  if (resultat === null) {
    return null;
  }

  const champs = schemaChampsSession.safeParse(resultat.session);
  const societeId = champs.success
    ? (champs.data.societe_id_active ?? null)
    : null;
  const role = champs.success ? (champs.data.role_actif ?? null) : null;
  const secondFacteurValide = champs.success
    ? (champs.data.second_facteur_valide ?? false)
    : false;

  return {
    sessionId: resultat.session.id,
    contexte: {
      utilisateurId: resultat.user.id,
      // Société et rôle vont ensemble : l'un sans l'autre ne veut rien dire,
      // et laisserait une transaction s'ouvrir sur un contexte incomplet.
      societeId: role === null ? null : societeId,
      role: societeId === null ? null : role,
      secondFacteurValide,
      // Better Auth la pose sur la ligne `session` (colonne `adresse_ip`, voir
      // la correspondance de `lib/auth/config.ts`). Elle n'ouvre aucun droit :
      // elle sert au seul journal d'audit (chapitre 11.2, L0-10).
      adresseIp: resultat.session.ipAddress ?? null,
    },
  };
}

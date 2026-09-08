import { z } from "zod";

import { auth, type Auth } from "./config";
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

/**
 * L'identité que la session porte déjà (L1-02f).
 *
 * `getSession` rend l'utilisateur avec sa session — deux opérations de client,
 * mais une seule pour l'appelant. La page d'arrivée n'a donc AUCUNE lecture à
 * ajouter pour dire qui vous êtes : elle lit ce qui est déjà là.
 *
 * `twoFactorEnabled` est le nom que le greffon donne à `mfa_actif` (voir la
 * correspondance de `lib/auth/config.ts`). Relu par un schéma comme le reste :
 * absent, il vaut `false`, ce qui envoie vers l'enrôlement plutôt que de
 * laisser passer un compte dont on ne sait rien.
 */
const schemaIdentite = z.object({
  name: z.string().nullish(),
  email: z.string().nullish(),
  twoFactorEnabled: z.boolean().nullish(),
});

/** Session serveur telle que l'application la manipule. */
export type IdentiteSession = {
  /** Nom de la personne connectée. */
  readonly nom: string;
  /** Son adresse électronique — l'identifiant qu'elle a saisi. */
  readonly email: string;
  /** Le compte porte-t-il un second facteur ? `mfa_actif` en base. */
  readonly mfaActif: boolean;
};

export type SessionServeur = {
  /**
   * JETON de la session, requis pour basculer de société (L1-02d).
   *
   * Le jeton et non l'identifiant : `session` porte la forme « désignation », et
   * sa clé est cette valeur opaque. Un UUID v7 n'en serait pas une.
   */
  jetonSession: string;
  contexte: ContexteSession;
  /** Qui est connecté — lu de la réponse, sans lecture supplémentaire. */
  identite: IdentiteSession;
};

/**
 * Renvoie la session serveur associée aux en-têtes de la requête, ou `null`
 * si personne n'est authentifié.
 *
 * **`instance` est prise en paramètre pour une raison qui est le ticket L1-02d**
 * — et non par goût de l'injection. Cette fonction n'avait AUCUN appelant : pas
 * une page, pas un scénario. Elle a donc rendu `null` pour tout compte connecté
 * pendant un ticket entier sans que rien ne rougisse. *Le dépôt ne peut pas
 * détecter les régressions d'une couche qui n'a pas d'appelant.* Le paramètre
 * lui en donne un — `tests/isolation/chaine-session.test.ts` —, sans écran et
 * sans attendre le premier.
 */
export async function obtenirSession(
  entetes: Headers,
  instance: Auth = auth(),
): Promise<SessionServeur | null> {
  const resultat = await instance.api.getSession({ headers: entetes });
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

  const identite = schemaIdentite.safeParse(resultat.user);

  return {
    jetonSession: resultat.session.token,
    identite: {
      nom: identite.success ? (identite.data.name ?? "") : "",
      email: identite.success ? (identite.data.email ?? "") : "",
      mfaActif: identite.success
        ? (identite.data.twoFactorEnabled ?? false)
        : false,
    },
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

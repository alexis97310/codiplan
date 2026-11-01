import { APIError } from "better-auth/api";
import { z } from "zod";

import { auth, type Auth } from "./config";
import { dansUnEchangeAuth } from "./echange";
import { LONGUEUR_MINIMALE } from "./premier-acces";

/**
 * MON COMPTE — changer son mot de passe EN ÉTANT CONNECTÉ (9I9-MON-COMPTE).
 *
 * ## Ce qui distingue ce module du premier accès
 *
 * `lib/auth/premier-acces.ts` consomme un jeton à usage unique, émis pour un
 * compte dont on ne sait rien côté serveur avant qu'il ne se présente : les
 * refus y sont indiscernables (D35, D50), parce que distinguer renseignerait
 * un tiers sur l'existence ou l'état d'un compte.
 *
 * Ici, une session valide existe déjà : l'identité est CONNUE, par
 * construction — c'est elle, et seulement elle, que `changePassword` relit
 * (`sensitiveSessionMiddleware`, Better Auth). Aucun identifiant de compte ne
 * transite jamais en entrée de ce module : une requête qui en forgerait un
 * (nom de champ quelconque) serait ignorée, jamais lue. *On ne change que SON
 * PROPRE mot de passe, parce qu'il n'y a littéralement rien d'autre à
 * désigner.* Distinguer un mot de passe actuel faux d'une saisie discordante
 * ne renseigne donc personne qu'elle ne sache déjà : c'est son propre compte.
 *
 * ## Les autres sessions de la personne — MESURÉ, PAS DEVINÉ
 *
 * `changePassword` accepte un `revokeOtherSessions` optionnel : vrai, il
 * détruit toutes les AUTRES sessions du compte et en ouvre une neuve pour
 * celle-ci. Ce module ne le passe pas (lecture par défaut, `false`) : aucune
 * autre session n'est donc révoquée par un changement de mot de passe — point
 * laissé tel quel, non demandé par le ticket, et nommé dans sa passation
 * plutôt que décidé ici en silence.
 */

const Saisie = z.object({
  motDePasseActuel: z.string().min(1),
  motDePasse: z.string(),
  confirmation: z.string(),
});

export type SaisieChangementMotDePasse = z.input<typeof Saisie>;

export type IssueChangementMotDePasse =
  | { readonly issue: "abouti" }
  | { readonly issue: "discordance" }
  | { readonly issue: "trop_court" }
  | { readonly issue: "actuel_incorrect" }
  | { readonly issue: "refuse" };

/**
 * Change le mot de passe de la personne dont `entetes` porte la session.
 *
 * `entetes` est ce que l'appelant HTTP a reçu de la requête — les cookies de
 * session y voyagent, et c'est tout ce que `changePassword` lit pour savoir
 * QUI agit. Aucun identifiant de compte n'est un paramètre de cette fonction.
 */
export async function changerSonMotDePasse(
  saisie: SaisieChangementMotDePasse,
  entetes: Headers,
  instance: Auth = auth(),
): Promise<IssueChangementMotDePasse> {
  const analyse = Saisie.safeParse(saisie);
  if (!analyse.success) {
    return { issue: "refuse" };
  }
  const { motDePasseActuel, motDePasse, confirmation } = analyse.data;

  // LES DEUX CONTRÔLES DE SAISIE D'ABORD, même ordre que le premier accès :
  // ils ne consultent ni ne modifient rien en base.
  if (motDePasse !== confirmation) {
    return { issue: "discordance" };
  }
  if (motDePasse.length < LONGUEUR_MINIMALE) {
    return { issue: "trop_court" };
  }

  return dansUnEchangeAuth(async () => {
    try {
      await instance.api.changePassword({
        headers: entetes,
        body: {
          currentPassword: motDePasseActuel,
          newPassword: motDePasse,
        },
      });
      return { issue: "abouti" as const };
    } catch (erreur) {
      if (
        erreur instanceof APIError &&
        erreur.body?.code === "INVALID_PASSWORD"
      ) {
        return { issue: "actuel_incorrect" as const };
      }
      // Session absente, greffon indisponible, ou tout autre refus de la
      // bibliothèque : un seul motif, qui ne distingue rien de plus — aucun
      // de ces cas n'apprend quoi que ce soit sur un AUTRE compte.
      return { issue: "refuse" as const };
    }
  });
}

import { type Auth, auth } from "./config";
import { dansUnEchangeAuth } from "./echange";

/**
 * LE PREMIER ACCÈS — poser le mot de passe que l'amorçage n'a pas posé
 * (complément de D65, ticket L2-15).
 *
 * **Ce chemin manquait, et son absence se mesurait à un 404.** Le geste
 * d'amorçage imprime une URL de premier accès qui conduit à `/premier-acces` ;
 * la page n'existait pas. *Une garantie qu'on ne peut pas emprunter n'en est
 * pas une* — le compte s'ouvrait, et personne ne pouvait s'en servir.
 *
 * **Ce module n'ouvre rien et ne décide rien.** Il transmet un jeton et un mot
 * de passe à la bibliothèque, qui les vérifie. Il ne lit pas le compte, il ne
 * dit pas si le jeton existe, et il ne distingue pas un jeton inconnu d'un
 * jeton expiré : ce serait un oracle sur l'existence d'un compte (D35, D50).
 *
 * **Il referme le cliquet de l'amorçage, et c'est un FAIT et non un drapeau** :
 * le premier mot de passe choisi remplit `compte.mot_de_passe`, que
 * `reemettreJetonPremierAcces` lit pour refuser désormais. Rien à écrire ici.
 */

/** Ce qu'un appelant obtient. Deux issues, et le refus n'apprend rien. */
export type IssuePremierAcces =
  { readonly issue: "pose" } | { readonly issue: "refus" };

/**
 * Pose le premier mot de passe d'un compte, contre son jeton.
 *
 * Le jeton est à usage unique et daté : la bibliothèque le consomme, et un
 * second appel avec le même jeton échoue — ce qui est la propriété qu'on veut,
 * et non un défaut à contourner.
 */
export async function poserLePremierMotDePasse(
  demande: { readonly jeton: string; readonly motDePasse: string },
  instance: Auth = auth(),
): Promise<IssuePremierAcces> {
  if (demande.jeton === "" || demande.motDePasse === "") {
    return { issue: "refus" };
  }

  // UN POINT D'ENTRÉE OUVRE SON ÉCHANGE (D64) : la bibliothèque lit une ligne
  // par sa clé de désignation puis réécrit celle qu'elle vient d'obtenir en la
  // nommant par son `id`. Sans échange, l'écriture est refusée EN SILENCE.
  return dansUnEchangeAuth(async () => {
    try {
      await instance.api.resetPassword({
        body: { newPassword: demande.motDePasse, token: demande.jeton },
      });
      return { issue: "pose" as const };
    } catch {
      // Un jeton inconnu, expiré, déjà consommé, ou un mot de passe refusé par
      // la politique de la bibliothèque : UNE SEULE réponse. Les distinguer
      // apprendrait à un tiers qu'un compte existe (D35).
      return { issue: "refus" as const };
    }
  });
}

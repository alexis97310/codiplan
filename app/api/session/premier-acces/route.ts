import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { poserLePremierMotDePasse } from "@/lib/auth/premier-acces";

import { champ, redirection, redirectionAvecMotif } from "../reponses";

/**
 * LE PREMIER ACCÈS (ticket L2-15, complément de D65).
 *
 * Le jeton voyage dans le formulaire et non dans l'URL de cette requête : une
 * URL se retrouve dans un journal de serveur mandataire, un corps de POST non.
 *
 * Le refus est UNIFORME (D35) : il ne dit ni si le jeton existe, ni s'il a
 * expiré, ni s'il a déjà servi.
 */
async function traiter(requete: Request): Promise<Response> {
  const formulaire = await requete.formData();

  // UN POINT D'ENTRÉE OUVRE SON ÉCHANGE (D64). Il est ouvert ICI, au point
  // d'entrée, et non seulement dans le module : c'est la route que le gardien
  // regarde, parce que c'est elle qui est le point d'entrée. L'imbrication est
  // sans effet — `dansUnEchangeAuth` réutilise l'échange déjà ouvert.
  const issue = await dansUnEchangeAuth(() =>
    poserLePremierMotDePasse({
      jeton: champ(formulaire, "jeton"),
      motDePasse: champ(formulaire, "motDePasse"),
    }),
  );

  if (issue.issue === "refus") {
    return redirectionAvecMotif("/premier-acces", "auth.refus");
  }

  // Aucune session n'est ouverte ici : poser un mot de passe n'est pas se
  // connecter, et enchaîner les deux ferait d'un jeton de courriel un moyen
  // d'ouvrir une session. On renvoie vers la connexion ordinaire.
  return redirection("/connexion?motif=premier_acces.pose");
}

export const POST = traiter;

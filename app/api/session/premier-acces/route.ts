import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { choisirLePremierMotDePasse } from "@/lib/auth/premier-acces";

import { champ, redirection, redirectionAvecMotif } from "../reponses";

/**
 * LA SURFACE HTTP DU PREMIER ACCÈS — une liste close de chemins FERMÉS (D58).
 *
 * Ce chemin ne s'ouvre qu'avec un jeton délivré par le geste d'amorçage : il
 * n'émet rien, il consomme. Il n'ouvre aucune session non plus — la personne se
 * reconnecte, et son second facteur lui est demandé si son rôle l'exige.
 *
 * **L'ÉCHANGE D'AUTHENTIFICATION EST OUVERT ICI (D64).** La bibliothèque
 * réécrit `compte` en le nommant par son `id` après l'avoir lu par sa clé de
 * désignation ; sans échange, la politique lit une variable vide et refuse — en
 * silence, c'est-à-dire zéro ligne et aucune erreur.
 */
async function traiter(requete: Request): Promise<Response> {
  const formulaire = await requete.formData();
  const jeton = champ(formulaire, "jeton");

  const issue = await choisirLePremierMotDePasse({
    jeton,
    motDePasse: champ(formulaire, "motDePasse"),
    confirmation: champ(formulaire, "confirmation"),
  });

  if (issue.issue === "abouti") {
    return redirectionAvecMotif("/connexion", "premier_acces.abouti");
  }

  // LE JETON EST RENDU À L'ÉCRAN sur un refus de SAISIE, et retiré sur un refus
  // de jeton. Sans cela, une faute de frappe obligerait à redemander un lien ;
  // avec, un jeton mort resterait dans une URL qui invite à réessayer.
  const parametres = new URLSearchParams({
    motif: `premier_acces.${issue.issue}`,
  });
  if (issue.issue !== "refuse") {
    parametres.set("token", jeton);
  }
  return redirection(`/premier-acces?${parametres.toString()}`);
}

export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

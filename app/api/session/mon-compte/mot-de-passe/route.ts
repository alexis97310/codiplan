import { headers } from "next/headers";

import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { changerSonMotDePasse } from "@/lib/auth/mon-compte";
import { exigerSessionActive } from "@/lib/auth/porte";
import { estRolePortail } from "@/lib/auth/roles";

import { champ, redirectionAvecMotif } from "../../reponses";

/**
 * CHANGER SON MOT DE PASSE EN ÉTANT CONNECTÉ (9I9-MON-COMPTE).
 *
 * `exigerSessionActive` — « société active, aucune capacité » — est la même
 * porte que lirait n'importe quel autre écran de bureau sans capacité
 * particulière : ce geste n'en exige aucune, tout rôle de bureau connecté
 * change SON PROPRE mot de passe. L'identité qui change réellement n'est de
 * toute façon jamais celle d'ici : elle vient de la session que
 * `changerSonMotDePasse` relit elle-même, par les en-têtes de la requête.
 *
 * Un aboutissement détruit la session courante et en pose une neuve (9I91) :
 * ses `Set-Cookie` sont reportés tels quels sur cette redirection, sans quoi
 * le navigateur garderait le cookie révoqué et la personne serait déconnectée
 * au prochain geste.
 */
async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerSessionActive();
  if (contexte === null) {
    return redirectionAvecMotif("/connexion", "auth.refus");
  }

  const formulaire = await requete.formData();
  const issue = await changerSonMotDePasse(
    {
      motDePasseActuel: champ(formulaire, "motDePasseActuel"),
      motDePasse: champ(formulaire, "motDePasse"),
      confirmation: champ(formulaire, "confirmation"),
    },
    await headers(),
  );

  // LA DESTINATION SUIT LE RÔLE, PAS UNE VALEUR REÇUE (9K06) : un compte du
  // portail n'atteint jamais `/mon-compte` (I5) ; cette route change le mot
  // de passe de TOUT rôle de bureau connecté sans le distinguer, voir
  // l'en-tête — seule la redirection qui suit a besoin de savoir où le
  // ramener.
  return redirectionAvecMotif(
    estRolePortail(contexte.role) ? "/portail/mon-compte" : "/mon-compte",
    `mon_compte.mot_de_passe.${issue.issue}`,
    issue.issue === "abouti" ? issue.cookies : [],
  );
}

export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

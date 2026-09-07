import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth/config";
import { estCheminInscription } from "@/lib/auth/inscription-fermee";

/**
 * Points d'entrée de Better Auth (ticket L0-06 ; inscription fermée par L1-02c).
 *
 * Tout le protocole d'authentification — connexion, déconnexion, second facteur
 * — passe par ce gestionnaire unique. Aucune route d'authentification écrite à
 * la main : il n'y en aurait pas deux qui vérifieraient la session de la même
 * façon.
 *
 * **SAUF L'INSCRIPTION, et c'est une décision d'exploitation du 07/09/2026.**
 * *Personne ne crée son propre compte, jamais, dans aucun mode.* Un compte de
 * portail est délivré par CODIMA à un client ; un compte interne est ouvert par
 * l'administrateur de la société ; en mode éditeur, la première identité d'une
 * société cliente est ouverte par la console éditeur (lot 7). **Il n'y a pas
 * d'inscription en libre-service dans ce produit, et il ne doit pas y en
 * avoir : ce n'est pas une restriction, c'est le métier.**
 *
 * Ce gestionnaire étant un *attrape-tout*, il exposait `/sign-up/email` sans
 * que personne l'ait décidé. La surface est refermée ici, au plus près de
 * l'extérieur.
 */
function fermerInscription(requete: Request): Response | null {
  if (!estCheminInscription(new URL(requete.url).pathname)) {
    return null;
  }
  // 404, et pas 403 : un refus qui explique pourquoi est un renseignement
  // (D35, §9 du 20/08). Une route qui répondrait « interdit » apprendrait
  // qu'elle existe et que l'inscription est administrée ailleurs.
  return new Response(null, { status: 404 });
}

export async function GET(requete: Request): Promise<Response> {
  return (
    fermerInscription(requete) ?? toNextJsHandler(auth().handler).GET(requete)
  );
}

export async function POST(requete: Request): Promise<Response> {
  return (
    fermerInscription(requete) ?? toNextJsHandler(auth().handler).POST(requete)
  );
}

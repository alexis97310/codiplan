import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { auth } from "@/lib/auth/config";

import { redirection } from "../reponses";

/** Fermeture de session. Le greffon retire la ligne et périme le cookie. */
async function traiter(requete: Request): Promise<Response> {
  let cookies: readonly string[] = [];
  try {
    const reponse = await auth().api.signOut({
      headers: requete.headers,
      asResponse: true,
    });
    cookies = reponse.headers.getSetCookie?.() ?? [];
  } catch {
    // Une session déjà close se déconnecte quand même : l'utilisateur repart
    // vers la page de connexion dans tous les cas.
  }
  return redirection("/connexion", cookies);
}

/**
 * L'ÉCHANGE D'AUTHENTIFICATION EST OUVERT ICI (ticket D62).
 *
 * La bibliothèque réécrit par leur `id` des lignes qu'elle vient de lire par
 * leur clé de désignation. Sans échange ouvert, ces écritures ne reçoivent
 * aucun report, la politique lit une variable vide et refuse — silencieusement.
 * L'oubli casse donc la fonctionnalité ; il n'ouvre jamais rien.
 * Voir `lib/auth/echange.ts`.
 */

export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

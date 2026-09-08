import { auth } from "@/lib/auth/config";

import { redirection } from "../reponses";

/** Fermeture de session. Le greffon retire la ligne et périme le cookie. */
export async function POST(requete: Request): Promise<Response> {
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

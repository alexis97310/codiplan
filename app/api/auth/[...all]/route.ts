import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth/config";

/**
 * Points d'entrée de Better Auth (ticket L0-06).
 *
 * Tout le protocole d'authentification — inscription, connexion, déconnexion,
 * second facteur — passe par ce gestionnaire unique. Aucune route
 * d'authentification écrite à la main : il n'y en aurait pas deux qui
 * vérifieraient la session de la même façon.
 */
export const { GET, POST } = toNextJsHandler((requete: Request) =>
  auth().handler(requete),
);

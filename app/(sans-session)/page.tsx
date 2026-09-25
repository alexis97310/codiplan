import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { etatArriveeOuAnonyme } from "@/lib/auth/arrivee";

/**
 * LA RACINE DU SITE (99-ACCUEIL-1) — ne s'affiche jamais, redirige toujours.
 *
 * Sans session → `/connexion`. Avec session → `/arrivee`, qui décide seule de
 * la suite (enrôlement, société active…) : aucune règle de rôle ou de société
 * n'est dupliquée ici.
 *
 * `etatArriveeOuAnonyme`, jamais `etatArrivee` : cet écran PRÉCÈDE la session
 * (R2-16, `app/(sans-session)`) et ne doit jamais lever — une configuration
 * d'authentification absente doit tout de même mener au formulaire.
 */
export default async function PageAccueil() {
  const entetes = await headers();
  const etat = await etatArriveeOuAnonyme(entetes);

  if (etat.issue === "anonyme") {
    redirect("/connexion");
  }
  redirect("/arrivee");
}

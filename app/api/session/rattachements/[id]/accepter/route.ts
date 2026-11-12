import { accepterRattachementClient } from "@/lib/auth/lien-d-acces";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { obtenirSession } from "@/lib/auth/session";

import { redirection, redirectionAvecMotif } from "../../../reponses";

/**
 * ACCEPTE un rattachement EN ATTENTE (9L04, D249) — `[id]` désigne la ligne
 * `UtilisateurClient`, jamais le client ni le compte (même discipline que
 * `/api/clients/[id]/revoquer-acces`).
 *
 * **Aucune capacité à vérifier** : le geste porte sur SA PROPRE ligne, et
 * `accepterRattachementClient` la filtre déjà par `utilisateur_id` ET
 * `accepte_le: null` — un identifiant forgé pour la ligne d'autrui, ou déjà
 * traitée, rend le même refus `introuvable` (D50).
 */
async function traiter(
  requete: Request,
  params: Promise<{ id: string }>,
): Promise<Response> {
  const session = await obtenirSession(requete.headers);
  if (session === null) {
    return redirection("/connexion");
  }

  const { id } = await params;
  const resultat = await accepterRattachementClient(
    session.contexte.utilisateurId,
    id,
  );
  if (!resultat.accepte) {
    return redirectionAvecMotif(
      "/arrivee",
      `arrivee.attente.refus.${resultat.motif}`,
    );
  }
  return redirection("/arrivee");
}

export async function POST(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete, params));
}

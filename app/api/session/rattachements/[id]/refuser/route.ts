import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { refuserRattachementClient } from "@/lib/auth/lien-d-acces";
import { obtenirSession } from "@/lib/auth/session";

import { redirection, redirectionAvecMotif } from "../../../reponses";

/**
 * REFUSE un rattachement EN ATTENTE (9L04, D249) — laisse la ligne inactive,
 * jamais supprimée (I6). Même discipline que `accepter/route.ts` : aucune
 * capacité à vérifier, le filtre `utilisateur_id` + `accepte_le: null` borne
 * le geste à SA PROPRE ligne, encore en attente.
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
  const resultat = await refuserRattachementClient(
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

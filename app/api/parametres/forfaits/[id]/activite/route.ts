import { changerActiviteForfait } from "@/lib/tarification/depot-forfaits";

import { champ, contexteCourant } from "../../../../interventions/actions";

/**
 * ACTIVER OU DÉSACTIVER UN FORFAIT (R2-20).
 *
 * **Il n'existe aucune route de SUPPRESSION**, et ce n'est pas un oubli : une
 * intervention désigne son forfait (`onDelete: Restrict`), et *une facture émise
 * sous un forfait disparu ne s'explique plus.* Désactiver retire du CHOIX sans
 * toucher au passé.
 *
 * L'état visé est PORTÉ par le formulaire plutôt que déduit de l'état courant :
 * *une bascule qui lit l'état qu'elle change répond à un clic vieux de plusieurs
 * secondes, et deux clics rapides se rendent mutuellement sans effet.*
 */
export async function POST(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const vers = (cle: string | null): Response =>
    new Response(null, {
      status: 303,
      headers: {
        Location:
          cle === null
            ? "/parametres/forfaits"
            : `/parametres/forfaits?motif=${encodeURIComponent(cle)}`,
      },
    });

  const contexte = await contexteCourant();
  if (contexte === null) {
    return vers("auth.refus");
  }

  const formulaire = await requete.formData();
  const resultat = await changerActiviteForfait(
    contexte,
    id,
    champ(formulaire, "actif") === "oui",
  );
  return vers(resultat.accepte ? null : `forfaits.refus.${resultat.motif}`);
}

import { retirerAttribution } from "@/lib/habilitations/depot";

import { contexteCourant } from "../../../../interventions/actions";
import { versLEquipe } from "../../../saisie-recue";

/**
 * RETIRER UNE ATTRIBUTION (ÉQUIPE-2).
 *
 * L'identifiant vient du chemin. Contrairement au référentiel, il n'y a pas
 * de bascule d'activité ici : une attribution posée par erreur se retire, elle
 * ne se désactive pas — voir l'en-tête de `lib/habilitations/depot.ts`.
 */
export async function POST(
  _requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const contexte = await contexteCourant();
  if (contexte === null) {
    return versLEquipe("auth.refus");
  }
  const { id } = await params;
  const resultat = await retirerAttribution(contexte, id);
  return versLEquipe(
    resultat.accepte ? undefined : `habilitations.refus.${resultat.motif}`,
  );
}

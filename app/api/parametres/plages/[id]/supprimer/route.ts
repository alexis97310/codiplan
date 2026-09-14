import { retirerPlage } from "@/lib/calendar/depot";
import { avecContexteApplicatif } from "@/lib/db/client";

import { champ, contexteCourant } from "../../../../interventions/actions";
import { motifDe, versLeCalendrier, versLesAgences } from "../../actions";

/**
 * RETIRER UNE PLAGE — et retirer la dernière d'un jour, c'est FERMER ce jour
 * (R3-13).
 *
 * Aucun refus n'est opposé au dernier retrait : une agence a le droit de fermer
 * le samedi. Ce qu'il faut, c'est que l'écran le DISE avant — un bouton qui
 * ferme un jour d'ouverture sans le dire est un bouton qu'on presse une fois de
 * trop.
 */
export async function POST(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const contexte = await contexteCourant();
  if (contexte === null) {
    return versLesAgences("auth.refus");
  }
  const { id } = await params;
  const formulaire = await requete.formData();
  const calendrierId = champ(formulaire, "calendrier_id");
  if (calendrierId === null) {
    return versLesAgences("parametres.plage.refus_introuvable");
  }

  const reglage = await avecContexteApplicatif(contexte, (tx) =>
    retirerPlage(tx, id),
  );
  return versLeCalendrier(calendrierId, motifDe(reglage));
}

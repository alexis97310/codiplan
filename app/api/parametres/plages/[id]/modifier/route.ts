import { modifierPlage } from "@/lib/calendar/depot";
import { avecContexteApplicatif } from "@/lib/db/client";

import { champ, contexteCourant } from "../../../../interventions/actions";
import {
  bornes,
  motifDe,
  versLeCalendrier,
  versLesAgences,
} from "../../actions";

/**
 * MODIFIER LES BORNES D'UNE PLAGE (R3-13).
 *
 * Le jour ne se change pas ici : déplacer une plage d'un jour à l'autre, c'est
 * fermer l'un et ouvrir l'autre, et les deux gestes ont chacun leur conséquence.
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
  const deuxBornes = bornes(formulaire);
  if (deuxBornes === null) {
    return versLeCalendrier(calendrierId, "parametres.plage.refus_saisie");
  }

  const reglage = await avecContexteApplicatif(contexte, (tx) =>
    modifierPlage(tx, id, deuxBornes),
  );
  return versLeCalendrier(calendrierId, motifDe(reglage));
}

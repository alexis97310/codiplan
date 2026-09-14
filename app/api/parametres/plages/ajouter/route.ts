import { ajouterPlage } from "@/lib/calendar/depot";
import { avecContexteApplicatif } from "@/lib/db/client";

import { champ, contexteCourant } from "../../../interventions/actions";
import { bornes, motifDe, versLeCalendrier, versLesAgences } from "../actions";

/**
 * OUVRIR UN JOUR, OU LUI AJOUTER UNE SECONDE PLAGE (R3-13, I7).
 *
 * Un jour sans plage EST un jour fermé — la migration du 21/08 l'a écrit à la
 * naissance de la table, et c'est pourquoi il n'y a pas de verbe « ouvrir » :
 * ouvrir un jour, c'est lui donner une plage.
 *
 * La plage est écrite SOUS le contexte cloisonné ; aucune comparaison de société
 * n'est écrite au-dessus de la politique, ce serait une seconde lecture du même
 * critère.
 */
export async function POST(requete: Request): Promise<Response> {
  const contexte = await contexteCourant();
  if (contexte === null) {
    return versLesAgences("auth.refus");
  }
  const formulaire = await requete.formData();
  const calendrierId = champ(formulaire, "calendrier_id");
  if (calendrierId === null) {
    return versLesAgences("parametres.plage.refus_introuvable");
  }
  const jour = Number(champ(formulaire, "jour") ?? Number.NaN);
  const deuxBornes = bornes(formulaire);
  if (deuxBornes === null || !Number.isInteger(jour)) {
    return versLeCalendrier(calendrierId, "parametres.plage.refus_saisie");
  }

  const reglage = await avecContexteApplicatif(contexte, (tx) =>
    ajouterPlage(tx, calendrierId, { jourSemaine: jour, ...deuxBornes }),
  );
  return versLeCalendrier(calendrierId, motifDe(reglage));
}

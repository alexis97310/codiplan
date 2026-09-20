import { attribuerHabilitation } from "@/lib/habilitations/depot";

import { contexteCourant } from "../../../interventions/actions";
import { attributionRecue, versLEquipe } from "../../saisie-recue";

/**
 * ATTRIBUER UNE HABILITATION À UN TECHNICIEN, DATÉE (ÉQUIPE-2).
 *
 * Depuis la fiche d'un technicien, sur `/parametres/equipe`. Le refus revient
 * sur cet écran avec son motif, comme la création d'un technicien.
 */
export async function POST(requete: Request): Promise<Response> {
  const contexte = await contexteCourant();
  if (contexte === null) {
    return versLEquipe("auth.refus");
  }
  const saisie = attributionRecue(await requete.formData());
  if (saisie === null) {
    return versLEquipe("habilitations.refus.saisie");
  }
  const resultat = await attribuerHabilitation(contexte, saisie);
  return versLEquipe(
    resultat.accepte ? undefined : `habilitations.refus.${resultat.motif}`,
  );
}

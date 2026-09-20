import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { attribuerHabilitation } from "@/lib/habilitations/depot";

import { attributionRecue, versLEquipe } from "../../saisie-recue";

/**
 * ATTRIBUER UNE HABILITATION À UN TECHNICIEN, DATÉE (ÉQUIPE-2).
 *
 * Depuis la fiche d'un technicien, sur `/parametres/equipe`. Le refus revient
 * sur cet écran avec son motif, comme la création d'un technicien.
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerCapacite("administrer_utilisateurs");
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

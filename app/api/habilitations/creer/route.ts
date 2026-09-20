import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { creerHabilitation } from "@/lib/habilitations/depot";

import { creationHabilitationRecue, versLeReferentiel } from "../saisie-recue";

/**
 * CRÉER UNE HABILITATION (ÉQUIPE-2).
 *
 * Le refus retourne sur le référentiel avec son motif, comme les prestations :
 * *un refus qui renvoie ailleurs fait perdre la saisie.*
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerCapacite("administrer_utilisateurs");
  if (contexte === null) {
    return versLeReferentiel("auth.refus");
  }
  const saisie = creationHabilitationRecue(await requete.formData());
  if (saisie === null) {
    return versLeReferentiel("habilitations.refus.saisie");
  }
  const resultat = await creerHabilitation(contexte, saisie);
  return versLeReferentiel(
    resultat.accepte ? undefined : `habilitations.refus.${resultat.motif}`,
  );
}

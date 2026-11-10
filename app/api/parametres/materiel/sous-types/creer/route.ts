import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { creerSousType } from "@/lib/materiel/depot";

import { saisieSousTypeRecue, versLeReferentiel } from "../../saisie-recue";

/**
 * CRÉER UN SOUS-TYPE STRUCTURÉ DE MATÉRIEL (D238, ticket 9K17A).
 *
 * Même forme que `familles/creer` : le refus retourne sur le référentiel
 * avec son motif, jamais sur une page blanche.
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerCapaciteComplete("parametrer_societe");
  if (contexte === null) {
    return versLeReferentiel(await motifDuRefus());
  }
  const saisie = saisieSousTypeRecue(await requete.formData());
  if (saisie === null) {
    return versLeReferentiel("materiel.refus.saisie");
  }
  const resultat = await creerSousType(contexte, saisie);
  return versLeReferentiel(
    resultat.accepte ? undefined : `materiel.refus.${resultat.motif}`,
  );
}

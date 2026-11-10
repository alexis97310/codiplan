import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { creerSousType } from "@/lib/materiel/depot";
import { suiteRecue } from "@/lib/materiel/suite";

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
  const formulaire = await requete.formData();
  const suite = suiteRecue(formulaire);
  const contexte = await exigerCapaciteComplete("parametrer_societe");
  if (contexte === null) {
    return versLeReferentiel({ suite, motif: await motifDuRefus() });
  }
  const saisie = saisieSousTypeRecue(formulaire);
  if (saisie === null) {
    return versLeReferentiel({
      suite,
      motif: "materiel.refus.saisie",
      volet: { type: "sous-type" },
    });
  }
  const resultat = await creerSousType(contexte, saisie);
  if (!resultat.accepte) {
    return versLeReferentiel({
      suite,
      motif: `materiel.refus.${resultat.motif}`,
      volet: { type: "sous-type" },
    });
  }
  return versLeReferentiel({ suite, ligne: resultat.id });
}

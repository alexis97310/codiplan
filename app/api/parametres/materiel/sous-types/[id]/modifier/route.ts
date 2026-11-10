import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { modifierSousType } from "@/lib/materiel/depot";
import { suiteRecue } from "@/lib/materiel/suite";

import { saisieSousTypeRecue, versLeReferentiel } from "../../../saisie-recue";

/**
 * MODIFIER UN SOUS-TYPE STRUCTURÉ DE MATÉRIEL (D238, ticket 9K17A).
 *
 * L'identifiant vient du chemin, jamais du corps — même discipline que
 * `familles/[id]/modifier`.
 */
export async function POST(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete, params));
}

async function traiter(
  requete: Request,
  params: Promise<{ id: string }>,
): Promise<Response> {
  const formulaire = await requete.formData();
  const suite = suiteRecue(formulaire);
  const { id } = await params;
  const contexte = await exigerCapaciteComplete("parametrer_societe");
  if (contexte === null) {
    return versLeReferentiel({ suite, motif: await motifDuRefus() });
  }
  const saisie = saisieSousTypeRecue(formulaire);
  if (saisie === null) {
    return versLeReferentiel({
      suite,
      motif: "materiel.refus.saisie",
      volet: { type: "sous-type", id },
    });
  }
  const resultat = await modifierSousType(contexte, id, saisie);
  if (!resultat.accepte) {
    return versLeReferentiel({
      suite,
      motif: `materiel.refus.${resultat.motif}`,
      volet: { type: "sous-type", id },
    });
  }
  return versLeReferentiel({ suite, ligne: id });
}

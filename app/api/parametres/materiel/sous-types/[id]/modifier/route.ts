import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { modifierSousType } from "@/lib/materiel/depot";

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
  const contexte = await exigerCapaciteComplete("parametrer_societe");
  if (contexte === null) {
    return versLeReferentiel(await motifDuRefus());
  }
  const { id } = await params;
  const saisie = saisieSousTypeRecue(await requete.formData());
  if (saisie === null) {
    return versLeReferentiel("materiel.refus.saisie");
  }
  const resultat = await modifierSousType(contexte, id, saisie);
  return versLeReferentiel(
    resultat.accepte ? undefined : `materiel.refus.${resultat.motif}`,
  );
}

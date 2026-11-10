import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { basculerActiviteSousType } from "@/lib/materiel/depot";

import { champ } from "../../../../../interventions/actions";
import { ACTIF, INACTIF, versLeReferentiel } from "../../../saisie-recue";

/**
 * ACTIVER OU DÉSACTIVER UN SOUS-TYPE (D238, ticket 9K17A).
 *
 * Aucune suppression, comme pour une famille : un modèle qui le désigne déjà
 * le retient en `Restrict`. L'état visé est ENVOYÉ, jamais déduit — même
 * discipline que `familles/[id]/activite`.
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
  const vise = champ(await requete.formData(), "actif");
  if (vise !== ACTIF && vise !== INACTIF) {
    return versLeReferentiel("materiel.refus.saisie");
  }
  const resultat = await basculerActiviteSousType(contexte, id, vise === ACTIF);
  return versLeReferentiel(
    resultat.accepte ? undefined : `materiel.refus.${resultat.motif}`,
  );
}

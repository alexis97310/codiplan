import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { basculerActiviteChecklist } from "@/lib/checklists/depot";

import { champ } from "../../../../interventions/actions";
import { ACTIF, INACTIF, versLeReferentiel } from "../../saisie-recue";

/**
 * ACTIVER OU DÉSACTIVER UN MODÈLE DE CHECKLIST (9K19-CHECKLIST-PARAMETRAGE,
 * CK3) — jamais de suppression. L'état visé est ENVOYÉ, jamais déduit —
 * même discipline que `materiel/familles/[id]/activite`.
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
    return versLeReferentiel("checklist.parametrage.refus.saisie");
  }
  const resultat = await basculerActiviteChecklist(
    contexte,
    id,
    vise === ACTIF,
  );
  return versLeReferentiel(
    resultat.accepte
      ? undefined
      : `checklist.parametrage.refus.${resultat.motif}`,
  );
}

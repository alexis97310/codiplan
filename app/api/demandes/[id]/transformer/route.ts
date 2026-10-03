import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import { marquerTransformee } from "@/lib/demandes/depot";

import { versLaFicheDemande } from "../../actions";

/**
 * MARQUER TRANSFORMÉE (DEMANDES-1).
 *
 * **Ne crée AUCUNE intervention** — `marquerTransformee` le dit dans son
 * propre en-tête, et ce ticket ne l'invente pas non plus. Le geste réel de
 * planifier reste un geste séparé, humain, sur `/interventions/nouvelle` ;
 * cette route pose seulement le statut et son verrou, une fois que
 * l'intervention a été créée (ou va l'être) pour cette demande.
 *
 * **La capacité retenue est `qualifier_affecter`** — voir `accuser/route.ts`
 * (décision du 03/10/2026, point 3 ; D151).
 */
export async function POST(
  _requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(params));
}

async function traiter(params: Promise<{ id: string }>): Promise<Response> {
  const { id } = await params;
  const contexte = await exigerCapacite("qualifier_affecter");
  if (contexte === null) {
    return versLaFicheDemande(id, await motifDuRefus());
  }
  const resultat = await marquerTransformee(contexte, id);
  return versLaFicheDemande(id, resultat.accepte ? undefined : resultat.cle);
}

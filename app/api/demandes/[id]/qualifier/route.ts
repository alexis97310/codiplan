import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import { qualifierDemande } from "@/lib/demandes/depot";

import { versLaFicheDemande } from "../../actions";

/**
 * QUALIFIER une demande (DEMANDES-1) — voir `accuser/route.ts` pour la
 * capacité retenue (`qualifier_affecter`, décision du 03/10/2026 point 3,
 * D151) et pourquoi.
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
  const resultat = await qualifierDemande(contexte, id);
  return versLaFicheDemande(id, resultat.accepte ? undefined : resultat.cle);
}

import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { qualifierDemande } from "@/lib/demandes/depot";

import { versLaFicheDemande } from "../../actions";

/**
 * QUALIFIER une demande (DEMANDES-1) — voir `accuser/route.ts` pour la
 * capacité retenue et pourquoi.
 */
export async function POST(
  _requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(params));
}

async function traiter(params: Promise<{ id: string }>): Promise<Response> {
  const { id } = await params;
  const contexte = await exigerCapacite("creer_demande");
  if (contexte === null) {
    return versLaFicheDemande(id, "auth.refus");
  }
  const resultat = await qualifierDemande(contexte, id);
  return versLaFicheDemande(id, resultat.accepte ? undefined : resultat.cle);
}

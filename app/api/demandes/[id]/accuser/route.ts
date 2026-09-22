import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { accuserReception } from "@/lib/demandes/depot";

import { versLaFicheDemande } from "../../actions";

/**
 * ACCUSER RÉCEPTION d'une demande (DEMANDES-1, sur `lib/demandes/depot.ts`).
 *
 * Aucune saisie : l'instant est daté par le dépôt lui-même, dans le fuseau de
 * l'agence (D13) — cet écran ne fait que déclencher le geste.
 *
 * **La capacité retenue est `creer_demande`** — la même que
 * `POST /api/interventions/creer` (mesurée là, réutilisée ici) : qualifier une
 * demande, c'est décider qu'on va intervenir, et c'est déjà la capacité qui
 * gouverne la création d'une intervention.
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
  const resultat = await accuserReception(contexte, id);
  return versLaFicheDemande(id, resultat.accepte ? undefined : resultat.cle);
}

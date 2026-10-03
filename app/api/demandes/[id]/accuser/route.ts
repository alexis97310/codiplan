import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import { accuserReception } from "@/lib/demandes/depot";

import { versLaFicheDemande } from "../../actions";

/**
 * ACCUSER RÉCEPTION d'une demande (DEMANDES-1, sur `lib/demandes/depot.ts`).
 *
 * Aucune saisie : l'instant est daté par le dépôt lui-même, dans le fuseau de
 * l'agence (D13) — cet écran ne fait que déclencher le geste.
 *
 * **La capacité retenue est `qualifier_affecter`** (décision du 03/10/2026,
 * point 3 ; D151) — REVIENT sur le choix d'origine de ce ticket
 * (`creer_demande`, « qualifier une demande, c'est décider qu'on va
 * intervenir ») : les quatre actions d'une demande — accuser, qualifier,
 * transformer, clore — relèvent de « Qualifier / affecter » (CDC §5.2), pas
 * de la création. `creer_demande` reste la capacité du lien « Créer une
 * intervention » sur `/demandes` (`app/(back-office)/demandes/page.tsx`) :
 * c'est la CRÉATION d'une demande qui en relève, jamais son TRAITEMENT.
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
  const resultat = await accuserReception(contexte, id);
  return versLaFicheDemande(id, resultat.accepte ? undefined : resultat.cle);
}

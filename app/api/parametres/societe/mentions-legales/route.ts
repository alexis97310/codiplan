import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { enregistrerMentionsLegales } from "@/lib/societes/identite";

/**
 * `POST /api/parametres/societe/mentions-legales` — ENREGISTRE LE TEXTE DU
 * PIED DES DOCUMENTS (9I7A-MENTIONS-LEGALES-MODIFIABLES).
 *
 * Même modèle que `/api/parametres/societe/logo` (9EZ-LOGO-SOCIETE-1) :
 * capacité `parametrer_societe` vérifiée à la porte ET dans
 * `enregistrerMentionsLegales`, refus par motif nommé, jamais par exception.
 * Écran d'origine : la carte « Identité » du hub, `/parametres`.
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

function versLecran(motif?: string): Response {
  const suffixe =
    motif === undefined ? "" : `?motif=${encodeURIComponent(motif)}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `/parametres${suffixe}` },
  });
}

async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerCapaciteComplete("parametrer_societe");
  if (contexte === null) {
    return versLecran(await motifDuRefus());
  }

  const formulaire = await requete.formData();
  const texte = formulaire.get("mentions_legales");
  const resultat = await enregistrerMentionsLegales(
    contexte,
    typeof texte === "string" ? texte : "",
  );
  return versLecran(resultat.ok ? undefined : resultat.motif);
}

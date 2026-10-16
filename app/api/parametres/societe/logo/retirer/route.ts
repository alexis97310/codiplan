import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { retirerLogo } from "@/lib/societes/logo";

/**
 * `POST /api/parametres/societe/logo/retirer` — RETIRE LE LOGO DE LA SOCIÉTÉ
 * ACTIVE (9EZ-LOGO-SOCIETE-1). Même porte que le dépôt.
 */
export async function POST(): Promise<Response> {
  return dansUnEchangeAuth(traiter);
}

function versLecran(motif?: string): Response {
  const suffixe =
    motif === undefined ? "" : `?motif=${encodeURIComponent(motif)}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `/parametres/societe${suffixe}` },
  });
}

async function traiter(): Promise<Response> {
  const contexte = await exigerCapaciteComplete("parametrer_societe");
  if (contexte === null) {
    return versLecran(await motifDuRefus());
  }

  const resultat = await retirerLogo(contexte);
  return versLecran(resultat.ok ? undefined : resultat.motif);
}

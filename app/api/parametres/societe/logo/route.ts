import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { enregistrerLogo, type RefusLogo } from "@/lib/societes/logo";

/**
 * `POST /api/parametres/societe/logo` — DÉPOSE LE LOGO DE LA SOCIÉTÉ ACTIVE
 * (9EZ-LOGO-SOCIETE-1, D87).
 *
 * **Un seul champ, un seul fichier** : multipart `logo`, comme les photos du
 * terrain (BON-2). Les octets sont lus ICI et passés à `enregistrerLogo`, qui
 * juge format et taille sur les octets réels — jamais `fichier.type` ni le
 * nom, falsifiables sans effort.
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

function versLecran(motif?: string): Response {
  const suffixe =
    motif === undefined ? "" : `?motif=${encodeURIComponent(motif)}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `/parametres/societe${suffixe}` },
  });
}

async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerCapaciteComplete("parametrer_societe");
  if (contexte === null) {
    return versLecran(await motifDuRefus());
  }

  const formulaire = await requete.formData();
  const fichier = formulaire.get("logo");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return versLecran("logo.refus.vide" satisfies RefusLogo);
  }

  const octets = Buffer.from(await fichier.arrayBuffer());
  const resultat = await enregistrerLogo(contexte, octets);
  return versLecran(resultat.ok ? undefined : resultat.motif);
}

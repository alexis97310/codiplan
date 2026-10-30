import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { enregistrerAfficherMontants } from "@/lib/societes/identite";

/**
 * `POST /api/parametres/societe/afficher-montants` — ENREGISTRE LE RÉGLAGE
 * « AFFICHER LES MONTANTS » (9I8-AFFICHAGE-DES-MONTANTS, demande d'Alexis du
 * 28/10/2026, option A).
 *
 * Même modèle que `/api/parametres/societe/mentions-legales` : capacité
 * `parametrer_societe` vérifiée à la porte ET dans
 * `enregistrerAfficherMontants`, refus par motif nommé, jamais par
 * exception. Écran d'origine : `/parametres/societe`.
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
  // LA SENTINELLE DÉCOCHÉE (même idiome que `site.sous_contrat`,
  // `app/(back-office)/sites/[id]/page.tsx`) — une case décochée n'envoie
  // RIEN dans un `<form>`, c'est l'entrée cachée qui porte « 0 ».
  const valeur = formulaire.get("afficher_montants") === "1";
  const resultat = await enregistrerAfficherMontants(contexte, valeur);
  return versLecran(resultat.ok ? undefined : resultat.motif);
}

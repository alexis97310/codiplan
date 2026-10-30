import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { enregistrerRegleArrondi } from "@/lib/societes/identite";
import { schemaRegleArrondi } from "@/lib/tarification/valorisation";

/**
 * `POST /api/parametres/tarifs/regle-facturation` — ENREGISTRE LA RÈGLE
 * D'ARRONDI DU TEMPS FACTURÉ (9I8A1-REPRISE-9I8A, décision d'Alexis du
 * 29/10/2026, confirmée « par société »).
 *
 * Même modèle que `/api/parametres/societe/afficher-montants` : capacité
 * `parametrer_societe` vérifiée à la porte ET dans `enregistrerRegleArrondi`,
 * refus par motif nommé, jamais par exception. Un seul passage, pas de
 * confirmation séparée — contrairement à `/api/parametres/taux-horaire/
 * creer` : ce réglage n'est pas un prix qui s'accumule dans un historique,
 * c'est un commutateur qui se corrige en se reposant. Écran d'origine :
 * `/parametres/tarifs`.
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

function versLecran(motif?: string): Response {
  const suffixe =
    motif === undefined ? "" : `?motif=${encodeURIComponent(motif)}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `/parametres/tarifs${suffixe}` },
  });
}

async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerCapaciteComplete("parametrer_societe");
  if (contexte === null) {
    return versLecran(await motifDuRefus());
  }

  const formulaire = await requete.formData();
  const analyse = schemaRegleArrondi.safeParse({
    plancherMinutes: Number(formulaire.get("plancher_min")),
    palierMinutes: Number(formulaire.get("palier_min")),
    seuilPalierMinutes: Number(formulaire.get("seuil_palier_min")),
  });
  if (!analyse.success) {
    return versLecran("tarifs.regle_facturation.refus_saisie");
  }

  const resultat = await enregistrerRegleArrondi(contexte, analyse.data);
  return versLecran(resultat.ok ? undefined : resultat.motif);
}

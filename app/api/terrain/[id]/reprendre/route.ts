import { type ContexteActif } from "@/lib/auth/contexte";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import { reprendreIntervention } from "@/lib/interventions/depot";
import { perimetreDuPlanning } from "@/lib/interventions/perimetre-technicien";
import { schemaReprise } from "@/lib/interventions/saisie";

/**
 * `POST /api/terrain/{id}/reprendre` — LE TECHNICIEN AFFECTÉ REPREND
 * LUI-MÊME UNE INTERVENTION SUSPENDUE (9L08C-TERRAIN-REPRENDRE-SUSPENSION,
 * décision d'Alexis du 16/11/2026, option 2).
 *
 * Même porte que sa voisine `suspendre` : la capacité `saisir_rapport` prouve
 * le compte TERRAIN ; `reprendreIntervention` revérifie ensuite
 * `suspendre_reprendre_intervention` SUR CETTE intervention (D131) — la MÊME
 * fonction de domaine que la route du bureau (`app/api/interventions/[id]/
 * reprendre`), rien n'est dupliqué côté métier. `peutReprendre` rend le
 * statut que le CRÉNEAU dicte (L2-10), jamais celui d'avant la suspension.
 *
 * **AUCUNE SAISIE** (même remarque que la route bureau) — seul
 * `intervention_id` voyage, déduit de l'URL.
 *
 * **AVEC FILET : jamais de 500** — même garde que `suspendre`/`terminer`,
 * pour la même raison.
 */

function versLaFiche(id: string, cle?: string): Response {
  const suffixe = cle === undefined ? "" : `?motif=${encodeURIComponent(cle)}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `/terrain/${id}${suffixe}` },
  });
}

/** Même mécanisme que `app/api/terrain/[id]/suspendre` — voir son en-tête. */
function veutJson(requete: Request): boolean {
  return requete.headers.get("accept")?.includes("application/json") ?? false;
}

function reponse(
  requete: Request,
  id: string,
  ok: boolean,
  cle?: string,
): Response {
  if (veutJson(requete)) {
    return Response.json({ ok, motif: cle ?? null });
  }
  return versLaFiche(id, cle);
}

async function contexteDuTerrain(): Promise<ContexteActif | null> {
  const contexte = await exigerCapacite("saisir_rapport");
  if (contexte === null) {
    return null;
  }
  return perimetreDuPlanning(contexte).acces === "restreint" ? contexte : null;
}

export async function POST(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return dansUnEchangeAuth(() => traiter(requete, id));
}

async function traiter(requete: Request, id: string): Promise<Response> {
  const contexte = await contexteDuTerrain();
  if (contexte === null) {
    return reponse(requete, id, false, await motifDuRefus());
  }
  try {
    const saisie = schemaReprise.safeParse({ intervention_id: id });
    if (!saisie.success) {
      return reponse(requete, id, false, "intervention.refus.inconnue");
    }
    const resultat = await reprendreIntervention(contexte, saisie.data);
    return reponse(
      requete,
      id,
      resultat.accepte,
      resultat.accepte ? undefined : resultat.cle,
    );
  } catch (erreur) {
    console.error(`terrain reprendre (${id})`, erreur);
    return reponse(requete, id, false, "intervention.refus.erreur_serveur");
  }
}

import { type ContexteActif } from "@/lib/auth/contexte";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import { suspendreIntervention } from "@/lib/interventions/depot";
import { perimetreDuPlanning } from "@/lib/interventions/perimetre-technicien";
import { schemaSuspension } from "@/lib/interventions/saisie";

/**
 * `POST /api/terrain/{id}/suspendre` — « J'ATTENDS UNE PIÈCE »
 * (9K13-TERRAIN-ATTENTE-PIECE, décision d'Alexis du 09/11/2026).
 *
 * Même porte que ses voisines (`compteur`, `rapport`, `terminer`) : la
 * capacité `saisir_rapport` prouve le compte TERRAIN ; `suspendreIntervention`
 * revérifie ensuite `suspendre_reprendre_intervention` SUR CETTE
 * intervention (D131) — la même fonction que la route du bureau
 * (`app/api/interventions/[id]/suspendre`), rien n'est dupliqué côté métier.
 *
 * **RÉFÉRENCE ET DATE TOUJOURS ENSEMBLE, LE MOTIF TOUJOURS UN TEXTE FIXE** —
 * contrairement au dialogue du bureau, qui peut suspendre SANS pièce avec un
 * motif libre, ce geste terrain ne porte qu'un seul sens : une attente de
 * pièce. `schemaSuspension` (RG-INT-06) reste inchangé — seul cet appelant
 * garantit que les deux champs voyagent toujours remplis.
 *
 * **AVEC FILET : jamais de 500** — même garde que `terminer`, pour la même
 * raison (un identifiant mal formé lèverait à la base, sans ce filet).
 */

function versLaFiche(id: string, cle?: string): Response {
  const suffixe = cle === undefined ? "" : `?motif=${encodeURIComponent(cle)}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `/terrain/${id}${suffixe}` },
  });
}

/** Même mécanisme que `app/api/terrain/[id]/rapport` — voir son en-tête. */
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
    const formulaire = await requete.formData();
    const motif = formulaire.get("motif");
    const piece = formulaire.get("piece_attendue_ref");
    const date = formulaire.get("date_dispo_prevue");

    const saisie = schemaSuspension.safeParse({
      intervention_id: id,
      motif: typeof motif === "string" ? motif : "",
      piece_attendue_ref: typeof piece === "string" ? piece : null,
      // Un jour lu en UTC, jamais par un `Date` local — même garde que la
      // route du bureau (`app/api/interventions/[id]/suspendre`) : UTC+11
      // décalerait le jour d'un cran.
      date_dispo_prevue:
        typeof date === "string" ? new Date(`${date}T00:00:00.000Z`) : null,
    });
    if (!saisie.success) {
      // Même distinction que la route du bureau (IN-22, audit du 28/09) :
      // une référence sans sa date (ou l'inverse) n'est pas un motif
      // manquant.
      const pieceEtDate = saisie.error.issues.some(
        (issue) =>
          issue.path.includes("date_dispo_prevue") ||
          issue.path.includes("piece_attendue_ref"),
      );
      return reponse(
        requete,
        id,
        false,
        pieceEtDate
          ? "intervention.refus.piece_et_date"
          : "intervention.refus.motif_manquant",
      );
    }
    const resultat = await suspendreIntervention(contexte, saisie.data);
    return reponse(
      requete,
      id,
      resultat.accepte,
      resultat.accepte ? undefined : resultat.cle,
    );
  } catch (erreur) {
    console.error(`terrain suspendre (${id})`, erreur);
    return reponse(requete, id, false, "intervention.refus.erreur_serveur");
  }
}

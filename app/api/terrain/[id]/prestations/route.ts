import { type ContexteActif } from "@/lib/auth/contexte";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import { estUuid } from "@/lib/identifiant";
import { definirPrestationsRealiseesDepuisFile } from "@/lib/interventions/depot-rapport-terrain";
import { perimetreDuPlanning } from "@/lib/interventions/perimetre-technicien";

/**
 * `POST /api/terrain/{id}/prestations` — LES PRESTATIONS RÉALISÉES (17-BON-2).
 *
 * **UNE SEULE FORME, QUE L'ENVOI SOIT EN LIGNE OU REJOUÉ DEPUIS LA FILE**
 * (D143, décision d'Alexis du 22/10/2026 ; 9F4H6E-PRESTATIONS-DIFFERENCE-EN-
 * LIGNE) — `ajouter_id` et `retirer_id`, répétés, portent une DIFFÉRENCE,
 * jamais un ensemble. `depuis_file` n'est plus lu ICI : il ne sert plus qu'à
 * tracer l'origine de l'envoi côté client (`lib/terrain/envoi-file.ts`).
 *
 * Avant ce ticket, l'envoi EN LIGNE direct soumettait l'ENSEMBLE ENTIER des
 * prestations cochées (`prestation_id`, `definirPrestationsRealisees`, qui
 * remplace tout ce qui n'est pas soumis) : une prestation cochée par le
 * BUREAU pendant que la fiche terrain était ouverte disparaissait au premier
 * geste du technicien, puisque son écran ne la connaissait pas (revue du
 * pilote sur `013857b7`, 22/10/2026). Les deux chemins passent désormais par
 * `definirPrestationsRealiseesDepuisFile`, qui n'efface jamais que ce que
 * CET appareil a explicitement demandé de retirer — voir son docblock dans
 * `lib/interventions/depot-rapport-terrain.ts`.
 */

function versLeTerrain(id: string, cle?: string): Response {
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
  return versLeTerrain(id, cle);
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

  // L'IDENTIFIANT DE L'URL, VALIDÉ AVANT TOUTE REQUÊTE (BAS,
  // 9F4H6D-PRESTATIONS-SANS-PERTE, point 5) — `intervention.id` est
  // `@db.Uuid` ; sans ce refus NOMMÉ, une valeur mal formée atteindrait le
  // `findFirst` de `definirPrestationsRealisees`/`...DepuisFile` et lèverait
  // à la base (« invalid input syntax for type uuid »), une erreur Prisma
  // NON rattrapée jusqu'ici — même refus que « intervention non visible ».
  if (!estUuid(id)) {
    return reponse(requete, id, false, "terrain.prestations.refus");
  }

  const formulaire = await requete.formData();
  const ajouterIds = formulaire
    .getAll("ajouter_id")
    .filter((valeur): valeur is string => typeof valeur === "string");
  const retirerIds = formulaire
    .getAll("retirer_id")
    .filter((valeur): valeur is string => typeof valeur === "string");
  const ecrite = await definirPrestationsRealiseesDepuisFile(
    contexte,
    id,
    ajouterIds,
    retirerIds,
  );
  return ecrite === null
    ? reponse(requete, id, false, "terrain.prestations.refus")
    : reponse(requete, id, true, "terrain.prestations.enregistre");
}

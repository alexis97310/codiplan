import { type ContexteActif } from "@/lib/auth/contexte";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { definirPrestationsRealisees } from "@/lib/interventions/depot-rapport-terrain";
import { perimetreDuPlanning } from "@/lib/interventions/perimetre-technicien";

/**
 * `POST /api/terrain/{id}/prestations` — LES PRESTATIONS RÉALISÉES (17-BON-2).
 *
 * **L'ensemble ENTIER est soumis, jamais une ligne** : voir l'en-tête de
 * `lib/interventions/depot-rapport-terrain.ts`. Une case décochée dans le
 * formulaire n'apparaît pas dans `getAll` — c'est très exactement ce qu'un
 * ensemble défini attend : ce qui n'est plus coché n'est plus réalisé.
 */

function versLeTerrain(id: string, cle?: string): Response {
  const suffixe = cle === undefined ? "" : `?motif=${encodeURIComponent(cle)}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `/terrain/${id}${suffixe}` },
  });
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
    return versLeTerrain(id, "auth.refus");
  }

  const formulaire = await requete.formData();
  const prestationIds = formulaire
    .getAll("prestation_id")
    .filter((valeur): valeur is string => typeof valeur === "string");

  const ecrite = await definirPrestationsRealisees(contexte, id, prestationIds);
  return versLeTerrain(
    id,
    ecrite === null ? "terrain.prestations.refus" : undefined,
  );
}

import { type ContexteActif } from "@/lib/auth/contexte";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import { estUuid } from "@/lib/identifiant";
import {
  definirPrestationsRealisees,
  definirPrestationsRealiseesDepuisFile,
} from "@/lib/interventions/depot-rapport-terrain";
import { perimetreDuPlanning } from "@/lib/interventions/perimetre-technicien";

/**
 * `POST /api/terrain/{id}/prestations` — LES PRESTATIONS RÉALISÉES (17-BON-2).
 *
 * **DEUX FORMES, selon l'origine de l'envoi** (9F4H6A-COQUILLE-ANCIENNE-COPIE,
 * point 2) :
 * - l'envoi EN LIGNE direct (`prestation_id` répété, sans `depuis_file`) —
 *   **l'ensemble ENTIER est soumis, jamais une ligne** : voir l'en-tête de
 *   `lib/interventions/depot-rapport-terrain.ts`. Une case décochée dans le
 *   formulaire n'apparaît pas dans `getAll` — c'est très exactement ce qu'un
 *   ensemble défini attend : ce qui n'est plus coché n'est plus réalisé ;
 * - un REJEU depuis la file hors réseau (`depuis_file=1`, `ajouter_id` et
 *   `retirer_id` répétés) — une DIFFÉRENCE, jamais un ensemble, voir
 *   `definirPrestationsRealiseesDepuisFile`.
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

  if (formulaire.get("depuis_file") === "1") {
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

  const prestationIds = formulaire
    .getAll("prestation_id")
    .filter((valeur): valeur is string => typeof valeur === "string");

  const ecrite = await definirPrestationsRealisees(contexte, id, prestationIds);
  return ecrite === null
    ? reponse(requete, id, false, "terrain.prestations.refus")
    : reponse(requete, id, true, "terrain.prestations.enregistre");
}

import { type ContexteActif } from "@/lib/auth/contexte";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import {
  enregistrerSignature,
  schemaSignature,
} from "@/lib/interventions/depot-rapport-terrain";
import { perimetreDuPlanning } from "@/lib/interventions/perimetre-technicien";

import { champ } from "../../../interventions/actions";

/**
 * `POST /api/terrain/{id}/signature` — AJOUTE une signature (17-BON-2).
 *
 * **Jamais de modification, jamais de suppression** : ce point d'entrée n'a
 * qu'un verbe, `POST`, et `lib/interventions/depot-rapport-terrain.ts` n'en
 * expose aucun autre. Une re-signature ARRIVE ici de nouveau — même route,
 * nouvelle ligne.
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
  const analyse = schemaSignature.safeParse({
    image_base64: formulaire.get("image_base64"),
    signataire_nom: champ(formulaire, "signataire_nom"),
    signataire_qualite: champ(formulaire, "signataire_qualite"),
  });
  if (!analyse.success) {
    const motif =
      champ(formulaire, "signataire_nom") === null
        ? "terrain.signature.nom_manquant"
        : "terrain.signature.vide";
    return versLeTerrain(id, motif);
  }

  const ecrite = await enregistrerSignature(contexte, id, analyse.data);
  return versLeTerrain(
    id,
    ecrite === null ? "terrain.signature.refus" : undefined,
  );
}

import { type ContexteActif } from "@/lib/auth/contexte";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
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

/**
 * LE MOTIF D'UN FORMULAIRE REFUSÉ, SELON L'ISSUE DÉCLARÉE — les trois issues
 * (9DE-TP-CY1) ne manquent pas la même chose : `signee` veut un tracé ET un
 * nom, `client_absent`/`refus_signature` veulent un motif.
 */
function motifDEchec(formulaire: FormData): string {
  const issue = formulaire.get("issue");
  if (issue === "client_absent" || issue === "refus_signature") {
    return "terrain.signature.motif_manquant";
  }
  return champ(formulaire, "signataire_nom") === null
    ? "terrain.signature.nom_manquant"
    : "terrain.signature.vide";
}

async function traiter(requete: Request, id: string): Promise<Response> {
  const contexte = await contexteDuTerrain();
  if (contexte === null) {
    return versLeTerrain(id, await motifDuRefus());
  }

  const formulaire = await requete.formData();
  const issue = formulaire.get("issue");
  const saisie =
    issue === "client_absent" || issue === "refus_signature"
      ? { issue, motif: champ(formulaire, "motif") }
      : {
          issue,
          image_base64: formulaire.get("image_base64"),
          signataire_nom: champ(formulaire, "signataire_nom"),
          signataire_qualite: champ(formulaire, "signataire_qualite"),
        };
  const analyse = schemaSignature.safeParse(saisie);
  if (!analyse.success) {
    return versLeTerrain(id, motifDEchec(formulaire));
  }

  const ecrite = await enregistrerSignature(contexte, id, analyse.data);
  return versLeTerrain(
    id,
    ecrite === null
      ? "terrain.signature.refus"
      : "terrain.signature.enregistre",
  );
}

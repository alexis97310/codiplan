import { z } from "zod";

import { type ContexteActif } from "@/lib/auth/contexte";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import { enregistrerReponses } from "@/lib/checklists/depot";
import { perimetreDuPlanning } from "@/lib/interventions/perimetre-technicien";

/**
 * `POST /api/terrain/{id}/checklist` — LA SAISIE DES RÉPONSES (9K18-
 * CHECKLIST-DOMAINE). Même porte que le rapport et la signature
 * (`app/api/terrain/[id]/rapport`, `.../signature`) : la capacité
 * `saisir_rapport` prouve le DROIT, le périmètre RESTREINT prouve que ce
 * compte est bien un compte de terrain.
 *
 * Le corps porte une DIFFÉRENCE — jamais l'ensemble des points — encodée en
 * JSON dans le champ `reponses` du formulaire, même patron que
 * `pieces_remplacees` sur la route `rapport` : un tableau de
 * `{ checklist_point_id, valeur }`, où `valeur` est confrontée au TYPE DU
 * POINT par `lib/checklists/validation-reponse.ts`, jamais auto-déclarée ici.
 */

const schemaDifference = z
  .array(
    z.object({
      checklist_point_id: z.uuid(),
      valeur: z.unknown(),
    }),
  )
  .max(200);

/** Même mécanisme que `app/api/terrain/[id]/rapport` — voir son en-tête. */
function versLeTerrain(id: string, cle?: string): Response {
  const suffixe = cle === undefined ? "" : `?motif=${encodeURIComponent(cle)}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `/terrain/${id}${suffixe}` },
  });
}

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

  try {
    const formulaire = await requete.formData();
    const brut = formulaire.get("reponses");
    if (typeof brut !== "string") {
      return reponse(
        requete,
        id,
        false,
        "checklist.refus.differences_invalides",
      );
    }
    let analyse: z.infer<typeof schemaDifference>;
    try {
      const verdict = schemaDifference.safeParse(JSON.parse(brut));
      if (!verdict.success) {
        return reponse(
          requete,
          id,
          false,
          "checklist.refus.differences_invalides",
        );
      }
      analyse = verdict.data;
    } catch {
      return reponse(
        requete,
        id,
        false,
        "checklist.refus.differences_invalides",
      );
    }

    const ecrite = await enregistrerReponses(
      contexte,
      id,
      analyse.map((entree) => ({
        checklistPointId: entree.checklist_point_id,
        valeur: entree.valeur,
      })),
    );

    if (ecrite === null) {
      return reponse(requete, id, false, "checklist.refus.refus");
    }
    if ("refuse" in ecrite) {
      return reponse(requete, id, false, ecrite.cle);
    }
    return reponse(requete, id, true, "checklist.enregistree");
  } catch (erreur) {
    console.error(`terrain checklist (${id})`, erreur);
    return reponse(requete, id, false, "intervention.refus.erreur_serveur");
  }
}

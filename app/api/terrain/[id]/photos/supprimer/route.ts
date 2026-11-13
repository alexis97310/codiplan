import { z } from "zod";

import { type ContexteActif } from "@/lib/auth/contexte";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import {
  supprimerPhotoIntervention,
  type MotifRefusPhoto,
} from "@/lib/documents/depot";
import { perimetreDuPlanning } from "@/lib/interventions/perimetre-technicien";

/**
 * `POST /api/terrain/{id}/photos/supprimer` — SUPPRIME UNE PHOTO DE
 * L'INTERVENTION (décision d'Alexis du 13/11/2026, 9L04E-TERRAIN-PHOTOS-
 * EPUREES) — par son auteur, jusqu'à « Terminer ». MÊME DISCIPLINE que
 * `../route.ts` (le dépôt) : la décision entière est déléguée à
 * `supprimerPhotoIntervention` (`lib/documents/depot.ts`), qui relit le
 * périmètre, le statut et l'auteur dans sa propre transaction — rien n'est
 * recontrôlé ici.
 */

const CLES_MOTIF: Readonly<Record<MotifRefusPhoto, string>> = {
  introuvable: "terrain.photos.refus",
  pas_lauteur: "terrain.photos.refus_pas_lauteur",
  intervention_fermee: "terrain.photos.refus_intervention_fermee",
  lien_checklist: "terrain.photos.refus_lien_checklist",
};

function veutJson(requete: Request): boolean {
  return requete.headers.get("accept")?.includes("application/json") ?? false;
}

function versLeTerrain(id: string, cle?: string): Response {
  const suffixe = cle === undefined ? "" : `?motif=${encodeURIComponent(cle)}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `/terrain/${id}${suffixe}` },
  });
}

function reponse(requete: Request, id: string, motif?: string): Response {
  if (veutJson(requete)) {
    return Response.json({ ok: motif === undefined, motif: motif ?? null });
  }
  return versLeTerrain(id, motif);
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
    return reponse(requete, id, await motifDuRefus());
  }
  const formulaire = await requete.formData();
  const analyse = z.uuid().safeParse(formulaire.get("document_id"));
  if (!analyse.success) {
    return reponse(requete, id, "terrain.photos.refus");
  }
  const resultat = await supprimerPhotoIntervention(contexte, id, analyse.data);
  return reponse(
    requete,
    id,
    resultat.accepte ? undefined : CLES_MOTIF[resultat.motif ?? "introuvable"],
  );
}

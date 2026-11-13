import { z } from "zod";

import { type ContexteActif } from "@/lib/auth/contexte";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import {
  modifierLegendePhoto,
  type MotifRefusPhoto,
} from "@/lib/documents/depot";
import { perimetreDuPlanning } from "@/lib/interventions/perimetre-technicien";

/**
 * `POST /api/terrain/{id}/photos/legende` — MODIFIE LA LÉGENDE D'UNE PHOTO
 * DÉJÀ ENVOYÉE (décision d'Alexis du 13/11/2026, « facultative, après
 * l'envoi » — 9L04E-TERRAIN-PHOTOS-EPUREES). Jamais en file hors réseau
 * (contrairement à la suppression) : cette route exige le réseau, comme
 * n'importe quelle autre route terrain hors `photos`/`compteur`/`terminer`.
 */

const CLES_MOTIF: Readonly<Record<MotifRefusPhoto, string>> = {
  introuvable: "terrain.photos.refus",
  pas_lauteur: "terrain.photos.refus_pas_lauteur",
  intervention_fermee: "terrain.photos.refus_intervention_fermee",
  lien_checklist: "terrain.photos.refus_lien_checklist",
};

function reponse(motif?: string): Response {
  return Response.json({ ok: motif === undefined, motif: motif ?? null });
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
    return reponse(await motifDuRefus());
  }
  const formulaire = await requete.formData();
  const analyseId = z.uuid().safeParse(formulaire.get("document_id"));
  if (!analyseId.success) {
    return reponse("terrain.photos.refus");
  }
  const brut = formulaire.get("libelle");
  const analyseLibelle = z
    .string()
    .max(200)
    .safeParse(typeof brut === "string" ? brut : "");
  if (!analyseLibelle.success) {
    return reponse("terrain.photos.refus");
  }
  const resultat = await modifierLegendePhoto(
    contexte,
    id,
    analyseId.data,
    analyseLibelle.data,
  );
  return reponse(
    resultat.accepte ? undefined : CLES_MOTIF[resultat.motif ?? "introuvable"],
  );
}

import { type ContexteActif } from "@/lib/auth/contexte";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { CLASSES_DOCUMENT, type ClasseDocument } from "@/lib/documents/saisie";
import { deposerPhotoIntervention } from "@/lib/documents/depot";
import { enregistrerObjet } from "@/lib/documents/stockage";
import { perimetreDuPlanning } from "@/lib/interventions/perimetre-technicien";

/**
 * `POST /api/terrain/{id}/photos` — DÉPOSE UNE PHOTO SUR UNE INTERVENTION
 * (17-BON-2).
 *
 * **Une seule photo par requête** : un formulaire à fichier unique reste
 * utilisable sur un réseau de brousse (I4) — un envoi multiple qui échoue à
 * moitié laisserait deviner laquelle des photos est passée.
 *
 * Les octets sont lus ICI, jamais fournis par le client sous forme de clé :
 * `lib/documents/stockage.ts` calcule l'empreinte depuis les octets réels,
 * exactement ce que L8-01 exige pour que la déduplication ait un sens.
 */

const TAILLE_MAX_OCTETS = 15 * 1024 * 1024;

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

function classeSaisie(valeur: FormDataEntryValue | null): ClasseDocument {
  return typeof valeur === "string" &&
    (CLASSES_DOCUMENT as readonly string[]).includes(valeur)
    ? (valeur as ClasseDocument)
    : "client";
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
  const fichier = formulaire.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return versLeTerrain(id, "terrain.photos.refus");
  }
  if (!fichier.type.startsWith("image/")) {
    return versLeTerrain(id, "terrain.photos.refus_type");
  }
  if (fichier.size > TAILLE_MAX_OCTETS) {
    return versLeTerrain(id, "terrain.photos.refus");
  }

  const octets = Buffer.from(await fichier.arrayBuffer());
  const objet = await enregistrerObjet(octets, fichier.name);

  const libelleSaisi = formulaire.get("libelle");
  const libelle =
    typeof libelleSaisi === "string" && libelleSaisi.trim().length > 0
      ? libelleSaisi.trim()
      : fichier.name;

  const depot = await deposerPhotoIntervention(contexte, id, {
    classe: classeSaisie(formulaire.get("classe")),
    libelle,
    nom_fichier: fichier.name,
    type_mime: fichier.type,
    objet,
  });

  return versLeTerrain(id, depot === null ? "terrain.photos.refus" : undefined);
}

import { type ContexteActif } from "@/lib/auth/contexte";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import { CLASSES_DOCUMENT, type ClasseDocument } from "@/lib/documents/saisie";
import {
  deposerPhotoIntervention,
  peutDeposerPhotoSurCetteIntervention,
} from "@/lib/documents/depot";
import { formatImageReconnu } from "@/lib/documents/formats-image";
import { perimetreDuPlanning } from "@/lib/interventions/perimetre-technicien";
import { schemaSaisieDifferee } from "@/lib/interventions/saisie-differee";

/**
 * `POST /api/terrain/{id}/photos` — DÉPOSE UNE PHOTO SUR UNE INTERVENTION
 * (17-BON-2 ; plafond et format resserrés par 9EWB-PHOTOS-EN-BASE, la photo
 * étant désormais gardée EN BASE, D96).
 *
 * **Une seule photo par requête** : un formulaire à fichier unique reste
 * utilisable sur un réseau de brousse (I4) — un envoi multiple qui échoue à
 * moitié laisserait deviner laquelle des photos est passée.
 *
 * Les octets sont lus ICI, jamais fournis par le client sous forme de clé :
 * `deposerPhotoIntervention` calcule l'empreinte depuis les octets réels,
 * exactement ce que L8-01 exige pour que la déduplication ait un sens.
 *
 * **Le format se juge sur les octets, jamais sur l'extension ni
 * `fichier.type`** (`formatImageReconnu`) : un SVG renommé `.jpg` franchirait
 * les deux, et un SVG mal filtré est une porte vers l'exécution de script au
 * rendu (la même famille de défaut que l'ancien témoin sur `accept=
 * "image/*"`).
 *
 * **1 Mo, pas 15** : la photo arrive déjà réduite par le téléphone
 * (~1600 px, JPEG ~0,8) ; la base refuse d'ailleurs d'en garder davantage
 * (`document_octets_plafond`).
 */

const TAILLE_MAX_OCTETS = 1024 * 1024;

/**
 * LE COMPOSANT CLIENT DEMANDE JSON pour connaître l'issue sans recharger la
 * page (il affiche son propre état « Envoi… / Photo enregistrée / Échec »).
 * Un formulaire natif — sans JavaScript — n'envoie jamais cet en-tête, et
 * reçoit la redirection `303` comme avant.
 */
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

function classeSaisie(valeur: FormDataEntryValue | null): ClasseDocument {
  return typeof valeur === "string" &&
    (CLASSES_DOCUMENT as readonly string[]).includes(valeur)
    ? (valeur as ClasseDocument)
    : "client";
}

/**
 * `operation_id` est FACULTATIF (9F4H2A-REJEU-SANS-DOUBLON, point 3) — seul,
 * SANS `instant_appareil` : une photo n'est pas une saisie différée datée, et
 * exiger la paire de `schemaSaisieDifferee` (D214) n'aurait aucun sens ici.
 * Absent ou mal formé, traité comme absent — même famille que les routes
 * `compteur` et `terminer` : rater le rejeu n'empêche jamais le dépôt, il le
 * prive seulement cette fois de sa protection contre un second octet.
 */
function operationIdDuFormulaire(formulaire: FormData): string | undefined {
  const valeur = formulaire.get("operation_id");
  if (typeof valeur !== "string") {
    return undefined;
  }
  const analyse = schemaSaisieDifferee.shape.operation_id.safeParse(valeur);
  return analyse.success ? analyse.data : undefined;
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
  const fichier = formulaire.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return reponse(requete, id, "terrain.photos.refus");
  }
  if (fichier.size > TAILLE_MAX_OCTETS) {
    return reponse(requete, id, "terrain.photos.refus_taille");
  }

  const octets = Buffer.from(await fichier.arrayBuffer());
  const format = formatImageReconnu(octets);
  if (format === null) {
    return reponse(requete, id, "terrain.photos.refus_type");
  }

  // R7 (9DX-RETOUCHES-11) — le périmètre se juge AVANT d'écrire quoi que ce
  // soit : `deposerPhotoIntervention` peut refuser (le renfort, D151), et le
  // lire ici évite un aller-retour de lecture pour rien dans ce cas.
  if (!(await peutDeposerPhotoSurCetteIntervention(contexte, id))) {
    return reponse(requete, id, "terrain.photos.refus");
  }

  const libelleSaisi = formulaire.get("libelle");
  const libelle =
    typeof libelleSaisi === "string" && libelleSaisi.trim().length > 0
      ? libelleSaisi.trim()
      : fichier.name;

  const depot = await deposerPhotoIntervention(contexte, id, {
    classe: classeSaisie(formulaire.get("classe")),
    libelle,
    nom_fichier: fichier.name,
    type_mime: format,
    octets,
    operationId: operationIdDuFormulaire(formulaire),
  });

  return reponse(
    requete,
    id,
    depot === null ? "terrain.photos.refus" : undefined,
  );
}

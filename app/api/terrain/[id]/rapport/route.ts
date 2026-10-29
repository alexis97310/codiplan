import { type ContexteActif } from "@/lib/auth/contexte";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import {
  enregistrerRapportTexte,
  schemaPiecesRemplacees,
  type SaisiePieceRemplacee,
} from "@/lib/interventions/depot-rapport-terrain";
import { perimetreDuPlanning } from "@/lib/interventions/perimetre-technicien";

/**
 * `POST /api/terrain/{id}/rapport` — LE COMMENTAIRE ET LA SUITE À DONNER
 * (ticket 17-BON-2).
 *
 * Même porte que le compteur (`app/api/terrain/[id]/compteur`) : la capacité
 * `saisir_rapport` prouve le DROIT, le périmètre RESTREINT prouve que ce
 * compte est bien un compte de terrain — un rôle à accès complet écrirait
 * autrement le rapport d'une intervention qui n'est pas la sienne.
 */

/** Redirige vers l'écran de terrain — 303, pour que le navigateur suive en GET. */
function versLeTerrain(id: string, cle?: string): Response {
  const suffixe = cle === undefined ? "" : `?motif=${encodeURIComponent(cle)}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `/terrain/${id}${suffixe}` },
  });
}

/**
 * L'ENREGISTREMENT AUTOMATIQUE DEMANDE JSON (9F4-TERRAIN-ENREGISTREMENT-AUTO)
 * — le composant client envoie `Accept: application/json` pour connaître
 * l'issue sans recharger la page ; un formulaire natif sans JavaScript ne
 * porte jamais cet en-tête et reçoit la redirection `303` comme avant.
 */
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

/** `''` devient `null` — jamais une chaîne vide, que la base refuserait de distinguer d'un texte non écrit. */
function texteOuNull(valeur: FormDataEntryValue | null): string | null {
  if (typeof valeur !== "string") {
    return null;
  }
  const nettoye = valeur.trim();
  return nettoye.length === 0 ? null : nettoye;
}

/**
 * LES PIÈCES REMPLACÉES, JSON ENCODÉ DANS LE FORMULAIRE (9I7B ; REFUS DU
 * MALFORMÉ, 9I7B2 correctif de revue) — trois issues, jamais deux : ABSENT
 * (le champ ne figure pas dans le formulaire, la section ne change pas,
 * voir `SaisieRapportTexte.pieces_remplacees`) ; PRÉSENT ET VALIDE (JSON
 * bien formé, schéma respecté) ; PRÉSENT ET INVALIDE. Le troisième cas
 * REFUSE tout le rapport — `traiter` ci-dessous n'appelle alors JAMAIS
 * `enregistrerRapportTexte` — plutôt que de répondre « Rapport enregistré »
 * en avalant la pièce malformée en silence (ancien comportement : `??
 * undefined` rendait absent et malformé indiscernables).
 */
type PiecesLues =
  | { readonly presentes: false }
  | {
      readonly presentes: true;
      readonly valides: true;
      readonly pieces: SaisiePieceRemplacee[];
    }
  | { readonly presentes: true; readonly valides: false };

function piecesLues(valeur: FormDataEntryValue | null): PiecesLues {
  if (typeof valeur !== "string" || valeur.length === 0) {
    return { presentes: false };
  }
  try {
    const verdict = schemaPiecesRemplacees.safeParse(JSON.parse(valeur));
    return verdict.success
      ? { presentes: true, valides: true, pieces: verdict.data }
      : { presentes: true, valides: false };
  } catch {
    return { presentes: true, valides: false };
  }
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

  // LE FILET (9DE-TP-CY1) — écrire sur une FIGÉE (annulée, clôturée) sans
  // garde ferait lever le déclencheur `intervention_cycle_de_vie`, non
  // rattrapé : `enregistrerRapportTexte` refuse désormais AVANT d'écrire,
  // mais ce `try` reste la dernière ligne contre tout refus de base imprévu.
  try {
    const formulaire = await requete.formData();
    const pieces = piecesLues(formulaire.get("pieces_remplacees"));
    if (pieces.presentes && !pieces.valides) {
      return reponse(requete, id, false, "terrain.rapport.pieces_invalides");
    }
    const ecrite = await enregistrerRapportTexte(contexte, id, {
      commentaire_technicien: texteOuNull(
        formulaire.get("commentaire_technicien"),
      ),
      suite_a_donner: texteOuNull(formulaire.get("suite_a_donner")),
      pieces_remplacees: pieces.presentes ? pieces.pieces : undefined,
    });

    if (ecrite === null) {
      return reponse(requete, id, false, "terrain.rapport.refus");
    }
    if ("refuse" in ecrite) {
      return reponse(requete, id, false, ecrite.cle);
    }
    return reponse(requete, id, true, "terrain.rapport.enregistre");
  } catch (erreur) {
    console.error(`terrain rapport (${id})`, erreur);
    return reponse(requete, id, false, "intervention.refus.erreur_serveur");
  }
}

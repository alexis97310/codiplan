import { type ContexteActif } from "@/lib/auth/contexte";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import { enregistrerRapportTexte } from "@/lib/interventions/depot-rapport-terrain";
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
    return versLeTerrain(id, await motifDuRefus());
  }

  // LE FILET (9DE-TP-CY1) — écrire sur une FIGÉE (annulée, clôturée) sans
  // garde ferait lever le déclencheur `intervention_cycle_de_vie`, non
  // rattrapé : `enregistrerRapportTexte` refuse désormais AVANT d'écrire,
  // mais ce `try` reste la dernière ligne contre tout refus de base imprévu.
  try {
    const formulaire = await requete.formData();
    const ecrite = await enregistrerRapportTexte(contexte, id, {
      commentaire_technicien: texteOuNull(
        formulaire.get("commentaire_technicien"),
      ),
      suite_a_donner: texteOuNull(formulaire.get("suite_a_donner")),
    });

    if (ecrite === null) {
      return versLeTerrain(id, "terrain.rapport.refus");
    }
    return versLeTerrain(id, "refuse" in ecrite ? ecrite.cle : undefined);
  } catch (erreur) {
    console.error(`terrain rapport (${id})`, erreur);
    return versLeTerrain(id, "intervention.refus.erreur_serveur");
  }
}

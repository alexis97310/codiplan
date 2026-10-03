import { type ContexteActif } from "@/lib/auth/contexte";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import { alerterResponsablesSAV } from "@/lib/avertissements/signature-terrain";
import { maintenant } from "@/lib/calendar/fuseau";
import { fuseauDuTechnicien } from "@/lib/calendar/technicien";
import { avecContexteApplicatif } from "@/lib/db/client";
import { terminerIntervention } from "@/lib/interventions/depot-rapport-terrain";
import { perimetreDuPlanning } from "@/lib/interventions/perimetre-technicien";

/**
 * `POST /api/terrain/{id}/terminer` — EN COURS → TERMINÉE (9DE-TP-CY1, D8 à
 * la lettre : QT-4(a)).
 *
 * Même porte que ses voisines (`compteur`, `rapport`, `signature`,
 * `prestations`, `photos`) : la capacité `saisir_rapport` prouve le DROIT, le
 * périmètre RESTREINT prouve que ce compte est bien un compte de terrain.
 *
 * **AVEC FILET : jamais de 500.** `terminerIntervention` touche trois tables
 * (`segment_travail`, `intervention_signature` en lecture, `intervention`)
 * et peut, en théorie, heurter un refus de base non anticipé ; une panne ici
 * ramène à la fiche avec un motif, jamais une page d'erreur brute.
 */

function versLaFiche(id: string, cle?: string): Response {
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
  _requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return dansUnEchangeAuth(() => traiter(id));
}

async function traiter(id: string): Promise<Response> {
  const contexte = await contexteDuTerrain();
  if (contexte === null) {
    return versLaFiche(id, await motifDuRefus());
  }
  try {
    const instant = maintenant(
      await avecContexteApplicatif(contexte, (tx) =>
        fuseauDuTechnicien(tx, {
          societeId: contexte.societeId,
          utilisateurId: contexte.utilisateurId,
        }),
      ),
    ).instant;

    const resultat = await terminerIntervention(contexte, id, instant);
    if (!resultat.accepte) {
      return versLaFiche(id, resultat.cle);
    }

    if (resultat.issueSignature !== "signee") {
      const etat = await alerterResponsablesSAV(
        contexte,
        id,
        resultat.issueSignature,
        resultat.motifSignature ?? "",
      );
      if (etat.type === "sans_destinataire") {
        return versLaFiche(id, "terrain.terminer.alerte_sans_destinataire");
      }
    }

    return versLaFiche(id);
  } catch (erreur) {
    console.error(`terrain terminer (${id})`, erreur);
    return versLaFiche(id, "intervention.refus.erreur_serveur");
  }
}

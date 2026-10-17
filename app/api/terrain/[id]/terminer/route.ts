import { type ContexteActif } from "@/lib/auth/contexte";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import { alerterResponsablesSAV } from "@/lib/avertissements/signature-terrain";
import { maintenant } from "@/lib/calendar/fuseau";
import { fuseauDuTechnicien } from "@/lib/calendar/technicien";
import { avecContexteApplicatif } from "@/lib/db/client";
import { terminerIntervention } from "@/lib/interventions/depot-rapport-terrain";
import { perimetreDuPlanning } from "@/lib/interventions/perimetre-technicien";
import {
  schemaSaisieDifferee,
  type SaisieDifferee,
} from "@/lib/interventions/saisie-differee";

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

/** Même mécanisme que `app/api/terrain/[id]/rapport` — voir son en-tête. */
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
  return versLaFiche(id, cle);
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
 * `instant_appareil` et `operation_id` sont FACULTATIFS et vont ENSEMBLE
 * (9F4H2) — même garde que `app/api/terrain/[id]/compteur`. Un seul des deux
 * présent, ou l'un des deux mal formé, est traité comme ABSENT plutôt que
 * refusé : rater le rejeu n'empêche jamais de terminer, il prive seulement
 * cette fois-ci de sa protection contre un second courriel.
 */
function differeDuFormulaire(formulaire: FormData): SaisieDifferee | undefined {
  const instantAppareil = formulaire.get("instant_appareil");
  const operationId = formulaire.get("operation_id");
  if (instantAppareil === null || operationId === null) {
    return undefined;
  }
  const analyse = schemaSaisieDifferee.safeParse({
    instant_appareil: instantAppareil,
    operation_id: operationId,
  });
  if (!analyse.success) {
    return undefined;
  }
  return {
    instantAppareil: analyse.data.instant_appareil,
    operationId: analyse.data.operation_id,
  };
}

async function traiter(requete: Request, id: string): Promise<Response> {
  const contexte = await contexteDuTerrain();
  if (contexte === null) {
    return reponse(requete, id, false, await motifDuRefus());
  }
  try {
    const formulaire = await requete.formData();
    const differe = differeDuFormulaire(formulaire);

    const instant = maintenant(
      await avecContexteApplicatif(contexte, (tx) =>
        fuseauDuTechnicien(tx, {
          societeId: contexte.societeId,
          utilisateurId: contexte.utilisateurId,
        }),
      ),
    ).instant;

    const resultat = await terminerIntervention(
      contexte,
      id,
      instant,
      undefined,
      differe,
    );
    if (!resultat.accepte) {
      return reponse(requete, id, false, resultat.cle);
    }

    // UN REJEU RECONNU (9F4H2, décision n° 108 d'Alexis) N'ENVOIE AUCUN
    // SECOND COURRIEL : le premier passage a déjà alerté le SAV, ou a déjà
    // décidé de ne pas le faire — le rejouer ferait le second geste deux
    // fois pour un seul fait.
    if (resultat.rejoue !== true && resultat.issueSignature !== "signee") {
      const etat = await alerterResponsablesSAV(
        contexte,
        id,
        resultat.issueSignature,
        resultat.motifSignature ?? "",
      );
      if (etat.type === "sans_destinataire") {
        return reponse(
          requete,
          id,
          true,
          "terrain.terminer.alerte_sans_destinataire",
        );
      }
    }

    return reponse(requete, id, true);
  } catch (erreur) {
    console.error(`terrain terminer (${id})`, erreur);
    return reponse(requete, id, false, "intervention.refus.erreur_serveur");
  }
}

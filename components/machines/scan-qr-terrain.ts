"use server";

import { headers } from "next/headers";

import { niveau } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import { avecContexteApplicatif } from "@/lib/db/client";
import { resoudreParJeton } from "@/lib/machines/resolution";

import type { ResultatScanQr } from "./scan-qr-resultat";

/** Une intervention dans ces statuts n'a plus rien à ouvrir au terrain. */
const STATUTS_FERMES = ["terminee", "cloturee", "annulee"] as const;

/**
 * LA RÉSOLUTION D'UN SCAN CÔTÉ TERRAIN (9G10-SCANNER-QR-APPLI, D144).
 *
 * **Aucune « vue terrain de la machine » n'existe** (mesuré : `app/(mobile)/
 * terrain/**` ne porte qu'une liste de journée, une fiche d'INTERVENTION et
 * un profil — jamais une fiche de machine). La seule destination possible
 * est donc la fiche d'une intervention EN COURS, affectée à CE technicien,
 * sur la machine résolue.
 *
 * Son absence rend `hors_perimetre`, **sans jamais dire pourquoi** — que la
 * machine soit hors du périmètre réel du technicien, ou qu'elle y soit sans
 * qu'aucune intervention ne l'y attende aujourd'hui, le refus est le même
 * (D35, D50 : un refus a le droit d'être lisible, jamais d'être informatif).
 */
export async function resoudreScanTerrain(
  saisie: string,
): Promise<ResultatScanQr> {
  const session = await obtenirSession(await headers());
  if (
    session === null ||
    session.contexte.societeId === null ||
    session.contexte.role === null
  ) {
    return { suite: "introuvable" };
  }
  const contexte = {
    ...session.contexte,
    societeId: session.contexte.societeId,
    role: session.contexte.role,
  };
  if (niveau(contexte.role, "consulter_parc_complet") !== "restreint") {
    return { suite: "introuvable" };
  }

  const machine = await resoudreParJeton(contexte, saisie);
  if (machine === null) {
    return { suite: "introuvable" };
  }

  const rattachement = await avecContexteApplicatif(contexte, (tx) =>
    tx.interventionMachine.findFirst({
      where: {
        machine_id: machine.id,
        intervention: {
          technicien_id: contexte.utilisateurId,
          statut: { notIn: [...STATUTS_FERMES] },
        },
      },
      select: { intervention_id: true },
      orderBy: { intervention: { date_planifiee: "asc" } },
    }),
  );
  if (rattachement === null) {
    return { suite: "hors_perimetre" };
  }
  return {
    suite: "rediriger",
    url: `/terrain/${rattachement.intervention_id}`,
  };
}

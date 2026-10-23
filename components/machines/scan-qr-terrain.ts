"use server";

import { type PrismaClient } from "@prisma/client";
import { headers } from "next/headers";

import { type ContexteActif } from "@/lib/auth/contexte";
import { niveau } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import { avecContexteApplicatif } from "@/lib/db/client";
import { resoudreParJeton } from "@/lib/machines/resolution";

import type { ResultatScanQr } from "./scan-qr-resultat";

/**
 * LES SEULS STATUTS QU'UN SCAN PEUT OUVRIR AU TERRAIN — même liste que
 * `filtreStatutPlanifiee` (`lib/interventions/depot.ts`, D141 14C) : une
 * `planifiee` est encore préparée par le bureau, invisible du terrain tant
 * qu'« Transmettre » ne l'a pas fait passer en `affectee` ; `a_planifier`
 * n'a par construction aucun technicien affecté. Les trois closes
 * (`terminee`, `cloturee`, `annulee`) n'ont plus rien à ouvrir.
 */
const STATUTS_OUVERTS_AU_TERRAIN = [
  "affectee",
  "en_cours",
  "suspendue",
] as const;

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
 *
 * **Séparée de `resoudreScanTerrain` ci-dessous** pour la raison de L1-02d :
 * `headers()` lève hors d'une requête Next.js, et les scénarios d'isolation
 * empruntent ce chemin contre la base jetable, sous le rôle applicatif
 * restreint — jamais une variante écrite pour eux.
 */
export async function resolutionScanTerrain(
  contexte: ContexteActif,
  saisie: string,
  client?: PrismaClient,
): Promise<ResultatScanQr> {
  if (niveau(contexte.role, "consulter_parc_complet") !== "restreint") {
    return { suite: "introuvable" };
  }

  const machine = await resoudreParJeton(contexte, saisie, client);
  if (machine === null) {
    return { suite: "introuvable" };
  }

  const rattachement = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.interventionMachine.findFirst({
        where: {
          machine_id: machine.id,
          intervention: {
            technicien_id: contexte.utilisateurId,
            statut: { in: [...STATUTS_OUVERTS_AU_TERRAIN] },
          },
        },
        select: { intervention_id: true },
        orderBy: { intervention: { date_planifiee: "asc" } },
      }),
    client,
  );
  if (rattachement === null) {
    return { suite: "hors_perimetre" };
  }
  return {
    suite: "rediriger",
    url: `/terrain/${rattachement.intervention_id}`,
  };
}

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
  return resolutionScanTerrain(contexte, saisie);
}

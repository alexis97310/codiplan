"use server";

import { type PrismaClient } from "@prisma/client";
import { headers } from "next/headers";

import { type ContexteActif } from "@/lib/auth/contexte";
import { peutPleinement } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import { resoudreParJeton } from "@/lib/machines/resolution";

import type { ResultatScanQr } from "./scan-qr-resultat";

/**
 * LA RÉSOLUTION D'UN SCAN CÔTÉ BUREAU (9G10-SCANNER-QR-APPLI, D144) — ouvre
 * directement la fiche machine.
 *
 * Le rôle est revérifié ICI, sous l'action, et non supposé de la page qui
 * l'appelle : une saisie du navigateur porte sa propre valeur, jamais une
 * garantie sur qui l'a envoyée. Même capacité que `/parc` lui-même
 * (`consulter_parc_complet`, niveau COMPLET) — une seconde lecture du même
 * critère divergerait en silence (§9, 01/09).
 *
 * **Séparée de `resoudreScanBureau` ci-dessous** pour la raison de L1-02d :
 * `headers()` lève hors d'une requête Next.js, et les scénarios d'isolation
 * empruntent ce chemin contre la base jetable, sous le rôle applicatif
 * restreint — jamais une variante écrite pour eux.
 */
export async function resolutionScanBureau(
  contexte: ContexteActif,
  saisie: string,
  client?: PrismaClient,
): Promise<ResultatScanQr> {
  if (!peutPleinement(contexte.role, "consulter_parc_complet")) {
    return { suite: "introuvable" };
  }

  const machine = await resoudreParJeton(contexte, saisie, client);
  if (machine === null) {
    return { suite: "introuvable" };
  }
  return { suite: "rediriger", url: `/parc/${machine.id}` };
}

export async function resoudreScanBureau(
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
  return resolutionScanBureau(contexte, saisie);
}

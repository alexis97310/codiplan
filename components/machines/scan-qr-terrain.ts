"use server";

import { headers } from "next/headers";

import { obtenirSession } from "@/lib/auth/session";

import { resolutionScanTerrain } from "./scan-qr-terrain-resolution";
import type { ResultatScanQr } from "./scan-qr-resultat";

/**
 * LA SEULE ACTION SERVEUR DE CE FICHIER (décision d'Alexis du 10/11/2026).
 *
 * `resolutionScanTerrain` (`./scan-qr-terrain-resolution.ts`) prend un
 * `ContexteActif` en paramètre — nécessaire pour les scénarios d'isolation,
 * qui l'appellent contre la base jetable, sous le rôle applicatif restreint,
 * là où `headers()` lèverait hors d'une requête Next.js. Elle a donc dû
 * sortir du fichier `"use server"` : y rester aurait fait d'elle, pour
 * N'IMPORTE QUEL navigateur, un point d'entrée invocable directement avec un
 * `contexte` FORGÉ — `contexte.utilisateurId` gouverne le rattachement
 * interrogé, et un contexte forgé aurait ouvert la fiche de N'IMPORTE QUELLE
 * intervention, de N'IMPORTE QUEL technicien, de N'IMPORTE QUELLE société
 * (I1).
 *
 * Cette fonction-ci lit `headers()` et construit SON PROPRE contexte avant
 * d'appeler `resolutionScanTerrain` : c'est la seule à être exposée au
 * navigateur, et elle ne prend jamais un contexte en argument.
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
  return resolutionScanTerrain(contexte, saisie);
}

import { type PrismaClient } from "@prisma/client";

import { type ContexteActif } from "@/lib/auth/contexte";
import { peutPleinement } from "@/lib/auth/habilitations";
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
 * **HORS DU FICHIER `"use server"` (décision d'Alexis du 10/11/2026).** Une
 * fonction exportée d'un module `"use server"` devient, quel que soit l'écran
 * qui l'appelle vraiment, un point d'entrée que le navigateur peut invoquer
 * directement, avec les arguments de son choix — y compris `contexte`. Prendre
 * le contexte en paramètre n'aurait alors plus rien revérifié : l'appelant
 * aurait pu l'inventer. `resoudreScanBureau` (`./scan-qr-bureau.ts`), seule
 * fonction du fichier `"use server"`, lit `headers()` et construit SON PROPRE
 * contexte avant d'appeler celle-ci.
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

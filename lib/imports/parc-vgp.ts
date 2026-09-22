import { type PrismaClient } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { cleDeRapprochement } from "@/lib/excel/rapprochement";

import {
  cleDuRapport,
  type ParcVerificationsVgp,
  type VerificationConnue,
} from "./vgp";

/**
 * LES VÉRIFICATIONS DÉJÀ ENREGISTRÉES, PAR RÉFÉRENCE DE RAPPORT (VGP-IMPORT).
 *
 * C'est le PARENT du gabarit des observations, et il se lit dans le REGISTRE
 * — `vgp_verification` —, jamais dans les lignes d'un lot : *une observation
 * exige que son PV existe*, et il existe quand il est écrit, c'est-à-dire
 * quand le lot des vérifications a été APPLIQUÉ. Un lot seulement contrôlé
 * n'a rien écrit, et ses lignes ne sont pas des parents.
 *
 * **Tous les PV d'une référence sont gardés, avec la série de leur machine**
 * (la clé de D6, la même que `indexerLesMachinesParSerie`) : une référence
 * couvre un parc entier — 44 lignes mesurées sous `315503594.1.R` —, et c'est
 * le n° de série de la ligne d'observation qui départage. Retirer les
 * références ambiguës de l'index, comme le fait `indexerLeParcEquipements`,
 * dirait « inconnue » d'une référence qui existe 44 fois.
 */
export async function indexerLesVerificationsVgp(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<ParcVerificationsVgp> {
  const verifications = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.vgpVerification.findMany({
        where: { reference_rapport: { not: null } },
        select: {
          id: true,
          reference_rapport: true,
          machine_id: true,
          machine: { select: { numero_serie: true, reference_interne: true } },
        },
      }),
    client,
  );

  const parRapport = new Map<string, VerificationConnue[]>();
  for (const v of verifications) {
    if (v.reference_rapport === null) continue;
    const cle = cleDuRapport(v.reference_rapport);
    const connues = parRapport.get(cle) ?? [];
    connues.push({
      id: v.id,
      machineId: v.machine_id,
      serie: cleDeRapprochement({
        numeroSerie: v.machine.numero_serie,
        reference: v.machine.reference_interne ?? undefined,
        rang: 0,
      }).cle,
    });
    parRapport.set(cle, connues);
  }
  return { parRapport };
}

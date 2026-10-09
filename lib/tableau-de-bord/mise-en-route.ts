import type { PrismaClient } from "@prisma/client";

import type { ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { famillesADeterminer } from "@/lib/vgp/registre";

import { techniciensAccesAOuvrir } from "./lectures";

/**
 * « MISE EN ROUTE », LES HUIT ÉTAPES (PU-1, spécification §4 U7 et §4.9 ;
 * 9EG-TP-UX6-TABLEAU-DE-BORD-2) — administrateur de société seulement.
 *
 * Les HUIT critères sont des CHOIX DU PILOTE, validés par Alexis le
 * 05/10/2026 (décision 29) : « rien n'existe, applique-les tels quels ».
 *
 * `societe_id` est filtré EXPLICITEMENT, en plus de la politique RLS — même
 * discipline que `lib/audit/journal.ts` : une politique qui protège déjà ne
 * dispense pas la requête de porter son propre critère.
 */
export type FaitsMiseEnRoute = {
  readonly agenceAvecHoraires: boolean;
  readonly tauxHoraire: boolean;
  readonly trajetsEtForfaits: boolean;
  readonly familleMateriel: boolean;
  readonly famillesADeterminerCompte: number;
  readonly equipePosee: boolean;
  readonly accesAOuvrirCompte: number;
  readonly clientsSitesMachines: boolean;
  readonly planningTransmis: boolean;
};

/** Les statuts qui disent qu'un planning a déjà été TRANSMIS (D141). */
const STATUTS_PLANNING_TRANSMIS = [
  "affectee",
  "en_cours",
  "suspendue",
  "terminee",
  "cloturee",
] as const;

export async function faitsMiseEnRoute(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<FaitsMiseEnRoute> {
  const societeId = contexte.societeId as string;
  const [compteurs, familles, accesAOuvrir] = await Promise.all([
    avecContexteApplicatif(
      contexte,
      (tx) =>
        Promise.all([
          tx.agence.count({
            where: {
              societe_id: societeId,
              actif: true,
              calendrier: { plages: { some: {} } },
            },
          }),
          tx.tauxHoraire.count({ where: { societe_id: societeId } }),
          tx.forfait.count({ where: { societe_id: societeId } }),
          tx.tempsTrajetZone.count({ where: { societe_id: societeId } }),
          tx.familleMateriel.count({ where: { societe_id: societeId } }),
          tx.technicien.count({
            where: { societe_id: societeId, actif: true },
          }),
          tx.client.count({ where: { societe_id: societeId } }),
          tx.site.count({ where: { societe_id: societeId } }),
          tx.machine.count({ where: { societe_id: societeId } }),
          tx.intervention.count({
            where: {
              societe_id: societeId,
              statut: { in: [...STATUTS_PLANNING_TRANSMIS] },
            },
          }),
        ]),
      client,
    ),
    famillesADeterminer(contexte),
    techniciensAccesAOuvrir(contexte, client),
  ]);

  const [
    agenceCompte,
    tauxCompte,
    forfaitCompte,
    trajetCompte,
    familleCompte,
    technicienCompte,
    clientCompte,
    siteCompte,
    machineCompte,
    planningCompte,
  ] = compteurs;

  return {
    agenceAvecHoraires: agenceCompte > 0,
    tauxHoraire: tauxCompte > 0,
    trajetsEtForfaits: forfaitCompte > 0 && trajetCompte > 0,
    familleMateriel: familleCompte > 0,
    famillesADeterminerCompte: familles.length,
    equipePosee: technicienCompte > 0,
    accesAOuvrirCompte: accesAOuvrir.length,
    clientsSitesMachines:
      clientCompte > 0 && siteCompte > 0 && machineCompte > 0,
    planningTransmis: planningCompte > 0,
  };
}

import {
  type PrismaClient,
  type StatutDemande,
  type StatutIntervention,
} from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { type LigneHistoriqueEtat } from "@/lib/interventions/durees-par-etat";

/**
 * LA LECTURE PORTAIL DE L'HISTORIQUE DES ÉTATS
 * (9J08B-PORTAIL-TEMPS-PAR-ETAT, CLI-2.4).
 *
 * Deux fonctions dédiées, chacune avec SON PROPRE `select` fermé — même
 * discipline que `lib/portail/interventions.ts` (9J05) pour les commentaires :
 * ni l'une ni l'autre ne réutilise `historiqueStatutDeLIntervention`
 * (`lib/interventions/depot.ts`, back-office), pour qu'un futur champ ajouté
 * à CETTE fonction-là n'atteigne jamais le portail par réutilisation.
 *
 * Aucune politique RLS neuve : les deux tables lues
 * (`intervention_statut_historique`, `demande_statut_historique`) portent
 * déjà la forme « filiation » (D103, 9J08A) — une fille n'est visible que si
 * son parent l'est, et le parent (`intervention`/`demande`) porte lui-même la
 * forme « parc » (client, périmètre de sites). La sous-requête de filiation
 * s'exécute sous le même rôle restreint : l'héritage est automatique, sans
 * second filtre écrit ici (même principe que D92, `docs/arbitrages.md:3022`).
 */

/**
 * LA LISTE CLOSE des colonnes que ce module s'autorise à sélectionner sur
 * `intervention_statut_historique` — `tests/unit/portail/historique-etats-
 * colonnes-fermees.test.ts` lit ces clés RÉELLES, jamais une copie tenue à la
 * main.
 */
export const SELECTION_HISTORIQUE_INTERVENTION_CLIENT = {
  statut_avant: true,
  statut_apres: true,
  change_le: true,
} as const;

/**
 * Même liste, plus `demande_id` — nécessaire pour regrouper la lecture en LOT
 * (la liste des demandes du portail n'a pas de page par id, voir la
 * passation) sans poser une requête par demande.
 */
export const SELECTION_HISTORIQUE_DEMANDE_CLIENT = {
  demande_id: true,
  statut_avant: true,
  statut_apres: true,
  change_le: true,
} as const;

/**
 * L'historique d'UNE intervention, sous le contexte du compte portail — à
 * n'appeler qu'une fois la fiche déjà confirmée visible (`ficheInterventionDuParc`,
 * 9J07) : un tableau vide couvre ici aussi bien « aucun historique » qu'« hors
 * périmètre », la fiche ayant déjà tranché cette seconde question.
 */
export async function historiqueInterventionDuClient(
  contexte: ContexteSession,
  interventionId: string,
  client?: PrismaClient,
): Promise<readonly LigneHistoriqueEtat<StatutIntervention>[]> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const lignes = await tx.interventionStatutHistorique.findMany({
        where: { intervention_id: interventionId },
        select: SELECTION_HISTORIQUE_INTERVENTION_CLIENT,
        orderBy: { change_le: "asc" },
      });
      return lignes.map((ligne) => ({
        statutAvant: ligne.statut_avant,
        statutApres: ligne.statut_apres,
        changeLe: ligne.change_le,
      }));
    },
    client,
  );
}

/**
 * L'historique de PLUSIEURS demandes en un seul aller, sous le contexte du
 * compte portail — la liste des demandes (`/portail/demandes`, 9J04) n'a
 * qu'un écran, jamais de fiche par id ; chaque ligne a donc besoin de SON
 * historique au même moment, d'où ce lot plutôt qu'une fonction par id
 * (même idiome que `annuaireDesPersonnes`, `lib/interventions/depot.ts`).
 *
 * `demandeIds` est déjà le résultat d'une lecture filtrée par le contexte
 * (`demandesOuvertes`/`demandesTraitees`) : aucun id hors périmètre n'y
 * entre, mais la politique de filiation mord de toute façon si l'appelant se
 * trompait.
 */
export async function historiquesDemandesDuClient(
  contexte: ContexteSession,
  demandeIds: readonly string[],
  client?: PrismaClient,
): Promise<ReadonlyMap<string, readonly LigneHistoriqueEtat<StatutDemande>[]>> {
  if (demandeIds.length === 0) {
    return new Map();
  }
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const lignes = await tx.demandeStatutHistorique.findMany({
        where: { demande_id: { in: [...demandeIds] } },
        select: SELECTION_HISTORIQUE_DEMANDE_CLIENT,
        orderBy: { change_le: "asc" },
      });
      const parDemande = new Map<
        string,
        LigneHistoriqueEtat<StatutDemande>[]
      >();
      for (const ligne of lignes) {
        const liste = parDemande.get(ligne.demande_id) ?? [];
        liste.push({
          statutAvant: ligne.statut_avant,
          statutApres: ligne.statut_apres,
          changeLe: ligne.change_le,
        });
        parDemande.set(ligne.demande_id, liste);
      }
      return parDemande;
    },
    client,
  );
}

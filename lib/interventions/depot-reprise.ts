import { type Prisma } from "@prisma/client";

import { uuidv7 } from "@/lib/db/uuid";
import {
  type LigneHistorique,
  STATUT_FACTURATION_REPRISE,
  STATUT_REPRISE,
  TYPE_INTERVENTION_REPRISE,
} from "@/lib/imports/reprise";

/**
 * LE CHEMIN D'ÉCRITURE D'UNE INTERVENTION REPRISE D'ARCHIVE (REPRISE-HISTORIQUE ; D127).
 *
 * ## Pourquoi ce n'est pas `creerIntervention`
 *
 * `creerIntervention` (`depot.ts`) écrit une intervention qui NAÎT — statut
 * dicté par le créneau, forfait de déplacement déduit de la zone, contrôle
 * d'ouverture de l'agence, client actif exigé. **Une intervention reprise est
 * un fait passé** : elle naît `cloturee`, sans créneau, sans forfait, et une
 * intervention de 2019 chez un client aujourd'hui inactif a bien eu lieu.
 * *Faire passer l'archive par la porte du planning lui appliquerait des règles
 * qui parlent du futur.* Ce module est la porte de l'archive, et il n'en
 * est pas d'autre : le gardien des chemins (R3-12) l'atteint par
 * `lib/imports/application.ts`.
 *
 * ## Ce qui est écrit, colonne par colonne — et ce qui reste NUL, avec sa raison
 *
 * - `statut = cloturee`, `cloturee_le` = le jour du document (minuit UTC,
 *   comme `date_planifiee` : l'archive ne connaît que le jour) ;
 * - `statut_facturation = facturee` — POSÉ, pour que le déclencheur
 *   `intervention_facturation_a_la_cloture`, qui n'agit que sur `NULL`, ne
 *   range pas l'archive dans la file « à facturer » (motif dans `reprise.ts`) ;
 * - `type = curatif` — une valeur, choisie une fois (motif dans `reprise.ts`) ;
 * - `montant_ht` et `devise_code` — l'entier et sa devise, ou les deux nuls ;
 * - **`temps_mesure_min`, `temps_valide_min`, `temps_valide_par`,
 *   `temps_valide_le` : NULS.** L'archive ne porte pas le temps, et le
 *   déclencheur du cycle de vie ne juge qu'un `UPDATE` — l'insertion close
 *   passe, mesuré ;
 * - `forfait_deplacement_id`, `creneau_*`, `technicien_id` : NULS — un forfait
 *   est un prix (§8), un créneau un fait que l'archive ne porte pas, et le
 *   technicien est un TEXTE gardé dans la ligne du lot, jamais un compte ;
 * - `priorite` et `mode_valorisation` : leurs DÉFAUTS de schéma — aucune
 *   valeur n'est inventée pour une colonne que l'archive ne renseigne pas.
 *
 * ## Une machine, ou aucune — jamais créée
 *
 * `intervention_machine` reçoit une ligne quand le rapprochement a rendu un
 * rang 1 ou 2, aucune sinon. `createMany` plutôt qu'une écriture imbriquée,
 * pour la raison mesurée dans `creerIntervention` : la clé composite
 * `(societe_id, intervention_id)` refuse qu'on nomme la société dans une
 * relation.
 */
export async function creerInterventionsRepriseEnLot(
  tx: Prisma.TransactionClient,
  societeId: string,
  lignes: readonly { readonly id: string; readonly saisie: LigneHistorique }[],
): Promise<void> {
  if (lignes.length === 0) return;
  await tx.intervention.createMany({
    data: lignes.map(({ id, saisie }) => ({
      id,
      societe_id: societeId,
      client_id: saisie.client_id,
      site_id: saisie.site_id,
      agence_id: saisie.agence_id,
      type: TYPE_INTERVENTION_REPRISE,
      statut: STATUT_REPRISE,
      statut_facturation: STATUT_FACTURATION_REPRISE,
      date_planifiee: saisie.date,
      cloturee_le: saisie.date,
      montant_ht: saisie.montant_ht,
      devise_code: saisie.devise_code,
    })),
  });
  const rattachees = lignes.filter((l) => l.saisie.machine_id !== null);
  if (rattachees.length === 0) return;
  await tx.interventionMachine.createMany({
    data: rattachees.map(({ id, saisie }) => ({
      id: uuidv7(),
      societe_id: societeId,
      intervention_id: id,
      machine_id: saisie.machine_id as string,
    })),
  });
}

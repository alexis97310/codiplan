import type { Prisma, StatutMachine } from "@prisma/client";

import { type ContexteActif } from "@/lib/auth/contexte";
import { peutPleinement } from "@/lib/auth/habilitations";
import { perimetreParcDuTechnicien } from "@/lib/interventions/perimetre-technicien";

import {
  etatMachineEstProposable,
  type StatutMachineChoisissable,
  type StatutMachineFormulaire,
} from "./saisie";

/**
 * LA GARDE DU STATUT MACHINE, PARTAGÉE PAR LES TROIS CHEMINS QUI L'ÉCRIVENT
 * (9I8F1-REPRISE-9I8F, D227) — la fiche machine (`changerStatutMachine`,
 * `lib/machines/depot.ts`), le dépôt d'une demande (`deposerDemande`,
 * `lib/demandes/depot.ts`) et la création d'une intervention
 * (`creerIntervention`, `lib/interventions/depot.ts`).
 *
 * MODULE SÉPARÉ, PLUTÔT QU'AJOUTÉ À `lib/machines/depot.ts` — celui-ci
 * importe déjà `STATUTS_INTERVENTION_FERMES` depuis `lib/interventions/
 * depot.ts` ; l'importer en retour depuis `lib/interventions/depot.ts`
 * fermerait le cycle (c'est la raison déjà écrite dans la note de tête de
 * `creerIntervention` pour ne pas appeler `changerStatutMachineDans`). Ce
 * fichier n'importe NI L'UN NI L'AUTRE : les trois peuvent l'importer sans
 * cycle.
 */

/** Les deux sorties du parc (RG-PAR-05) — `fusionnee` a sa propre règle, ci-dessous. */
export const SORTIES_DU_PARC = new Set<StatutMachine>([
  "remplacee",
  "ferraillee",
]);

export type MotifRefusEtatMachine = "fusionnee" | "sortie_sans_confirmation";

export type DecisionDepuisLaFiche =
  | { readonly action: "ecrire"; readonly statut: StatutMachineChoisissable }
  | { readonly action: "refuser"; readonly motif: MotifRefusEtatMachine };

export type DecisionDepuisUnFormulaire =
  | { readonly action: "ecrire"; readonly statut: StatutMachineFormulaire }
  | { readonly action: "ignorer" };

/**
 * L'ÉCRAN AUTONOME (fiche machine) — une action EXPLICITE : toute valeur
 * invalide est un refus nommé, jamais un silence. Une machine `fusionnee` ne
 * change JAMAIS de statut. Les sorties du parc et le retour d'une machine
 * sortie vers un statut actif exigent `confirmationSortieDuParc` — sans
 * elle, refus nommé.
 */
export function decisionDepuisLaFiche(
  statutActuel: StatutMachine,
  statutDemande: StatutMachineChoisissable,
  confirmationSortieDuParc: boolean,
): DecisionDepuisLaFiche {
  if (statutActuel === "fusionnee") {
    return { action: "refuser", motif: "fusionnee" };
  }
  const franchitUneSortie =
    SORTIES_DU_PARC.has(statutDemande) !== SORTIES_DU_PARC.has(statutActuel);
  if (franchitUneSortie && !confirmationSortieDuParc) {
    return { action: "refuser", motif: "sortie_sans_confirmation" };
  }
  return { action: "ecrire", statut: statutDemande };
}

/**
 * UN FORMULAIRE DE CRÉATION (demande, intervention) — le champ n'est qu'une
 * annexe à un autre geste : une valeur qui ne correspond pas à l'état ACTUEL
 * de la machine est IGNORÉE, jamais un refus de toute la création, et jamais
 * une réactivation d'une machine sortie ou fusionnée (ni l'une ni l'autre
 * n'apparaît dans `STATUTS_MACHINE_FORMULAIRE`).
 */
export function decisionDepuisUnFormulaireDeCreation(
  statutActuel: StatutMachine,
  statutDemande: StatutMachineFormulaire | null,
): DecisionDepuisUnFormulaire {
  if (statutDemande === null) {
    return { action: "ignorer" };
  }
  return etatMachineEstProposable(statutActuel)
    ? { action: "ecrire", statut: statutDemande }
    : { action: "ignorer" };
}

/**
 * CAPACITÉ ET PÉRIMÈTRE (point 2, 9I8F1-REPRISE-9I8F) — l'état de machine
 * posté avec une création n'est appliqué que si l'appelant a `gerer_machine`
 * EN PLEIN, et que la machine désignée est dans son périmètre QT-2 — même
 * garde que `changerStatutMachine`. La création elle-même reste permise par
 * `creer_demande` (ou son équivalent intervention) : cette fonction ne
 * décide jamais de la création, seulement de l'écriture annexe du statut.
 */
async function autoriseAEcrireLEtatMachine(
  tx: Prisma.TransactionClient,
  contexte: ContexteActif,
  machineId: string,
): Promise<boolean> {
  if (!peutPleinement(contexte.role, "gerer_machine")) {
    return false;
  }
  const restriction = await perimetreParcDuTechnicien(tx, contexte);
  if (restriction === undefined) {
    return true;
  }
  const dansLePerimetre = await tx.machine.findFirst({
    where: { id: machineId, ...restriction },
    select: { id: true },
  });
  return dansLePerimetre !== null;
}

export type ResultatEtatMachineFormulaire =
  | { readonly action: "ecrire"; readonly statut: StatutMachineFormulaire }
  | { readonly action: "ignorer" }
  | { readonly action: "refuser" };

/**
 * LA GARDE COMPLÈTE D'UN FORMULAIRE DE CRÉATION — capacité et périmètre
 * (point 2), puis la valeur (point 1, règle 2), DANS CET ORDRE : un champ
 * renseigné par quelqu'un sans `gerer_machine` ou hors périmètre est un
 * refus nommé ; une valeur qui ne correspond pas à l'état actuel, une fois
 * la capacité acquise, est un silence.
 */
export async function resoudreEtatMachineDuFormulaire(
  tx: Prisma.TransactionClient,
  contexte: ContexteActif,
  machineId: string,
  etatDemande: StatutMachineFormulaire | null,
): Promise<ResultatEtatMachineFormulaire> {
  if (etatDemande === null) {
    return { action: "ignorer" };
  }
  const autorise = await autoriseAEcrireLEtatMachine(tx, contexte, machineId);
  if (!autorise) {
    return { action: "refuser" };
  }
  const machine = await tx.machine.findFirst({
    where: { id: machineId },
    select: { statut: true },
  });
  if (machine === null) {
    return { action: "ignorer" };
  }
  return decisionDepuisUnFormulaireDeCreation(machine.statut, etatDemande);
}

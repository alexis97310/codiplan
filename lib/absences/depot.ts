import { type PrismaClient } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";

import {
  absenceCouvrant,
  interventionsADeplanifier,
  type AbsenceDeclaree,
} from "./periode";
import type { CreationAbsence, DecisionAbsence } from "./saisie";

/**
 * LES ABSENCES, SOUS LE CONTEXTE CLOISONNÉ (L3-04, RG-PLA-06).
 *
 * ## Il ne compare AUCUNE société
 *
 * Tout passe par `avecContexteApplicatif`, donc sous les politiques : la forme
 * d'`absence` est « interne » (D94), et rien n'est recomparé au-dessus. *Une
 * comparaison écrite ici serait une seconde lecture d'un critère que la
 * politique porte déjà, et c'est celle qui vieillit sans rougir.*
 *
 * ## LA VALIDATION EST L'ACTE QUI DÉPLANIFIE
 *
 * RG-PLA-06 : *« Une absence validée bloque le créneau ; les interventions
 * posées repassent en file à planifier avec alerte. »* Les deux moitiés sont
 * **dans la même transaction** : une absence validée dont les interventions
 * seraient restées posées laisserait le planning affirmer qu'une personne
 * absente travaille, et personne ne saurait laquelle des deux moitiés a
 * échoué.
 *
 * **Ce qui est rendu à la file, c'est la DATE et le CRÉNEAU — jamais le
 * technicien.** *Une intervention qui perd son affectation perd l'information
 * qui permet de la reposer au même endroit*, et le planificateur devrait
 * retrouver qui s'en occupait. Elle reste affectée, elle n'est plus datée :
 * c'est exactement ce que « repasse en file à planifier » veut dire.
 */

export type ResultatAbsence<T> =
  | { readonly accepte: true; readonly fiche: T }
  | { readonly accepte: false; readonly cle: string };

/** Une absence telle qu'un écran l'affiche. */
export type LigneAbsence = {
  readonly id: string;
  readonly utilisateur_id: string;
  readonly du: Date;
  readonly au: Date;
  readonly statut: string;
  readonly motif: string;
  readonly precision: string | null;
};

const CHAMPS: {
  readonly [K in keyof LigneAbsence]: true;
} = {
  id: true,
  utilisateur_id: true,
  du: true,
  au: true,
  statut: true,
  motif: true,
  precision: true,
};

/**
 * DÉCLARER une absence — elle naît `demandee`, et rien d'autre.
 *
 * *La laisser naître validée donnerait à qui la saisit le pouvoir de
 * déplanifier le planning d'autrui en un appel.* Le statut n'est pas dans la
 * saisie ; il ne peut donc pas être forcé depuis l'extérieur.
 */
export async function declarerAbsence(
  contexte: ContexteSession,
  saisie: CreationAbsence,
  client?: PrismaClient,
): Promise<ResultatAbsence<LigneAbsence>> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const posee = await tx.absence.create({
        data: {
          societe_id: contexte.societeId as string,
          utilisateur_id: saisie.utilisateur_id,
          du: saisie.du,
          au: saisie.au,
          motif: saisie.motif,
          precision: saisie.precision,
        },
        select: CHAMPS,
      });
      return { accepte: true, fiche: posee };
    },
    client,
  );
}

/** Ce qu'une décision produit — et ce qu'elle a déplanifié. */
export type ResultatDecision = {
  readonly absence: LigneAbsence;
  /**
   * LES INTERVENTIONS RENDUES À LA FILE.
   *
   * **Rendues, et non comptées** : *« 3 interventions déplanifiées » ne dit pas
   * lesquelles*, et c'est précisément ce que le planificateur doit voir pour
   * les reposer. Un décompte serait une mesure qu'on ne peut pas vérifier
   * (§9, 06/09).
   */
  readonly deplanifiees: readonly string[];
};

/**
 * VALIDER OU REFUSER une absence — et déplanifier, dans la MÊME transaction.
 *
 * **Un refus ne replanifie rien**, et c'est écrit plutôt que tu : les
 * interventions rendues à la file par une validation ne savent plus où elles
 * étaient. *Ressusciter un créneau depuis le journal d'audit serait une seconde
 * source d'un fait que la table ne porte plus* — et le planificateur, lui, a le
 * journal sous les yeux (I8) et le choix de reposer où il veut.
 */
export async function deciderAbsence(
  contexte: ContexteSession,
  saisie: DecisionAbsence,
  client?: PrismaClient,
): Promise<ResultatAbsence<ResultatDecision>> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const absence = await tx.absence.findFirst({
        where: { id: saisie.absence_id },
        select: CHAMPS,
      });
      if (absence === null) {
        return { accepte: false, cle: "absence.refus.inconnue" };
      }
      if (absence.statut !== "demandee") {
        // *Une absence déjà tranchée ne se retranche pas.* Revalider une
        // absence validée redéplanifierait ce qui l'a déjà été, et refuser
        // après coup ne rendrait pas leurs créneaux aux interventions.
        return { accepte: false, cle: "absence.refus.deja_tranchee" };
      }

      const misAJour = await tx.absence.update({
        where: { id: saisie.absence_id },
        data: { statut: saisie.decision },
        select: CHAMPS,
      });

      if (saisie.decision !== "validee") {
        return {
          accepte: true,
          fiche: { absence: misAJour, deplanifiees: [] },
        };
      }

      // La borne SQL sert l'index ; *le jour exact et le statut sont tranchés
      // par la RÈGLE*, et par elle seule (§9, 01/09).
      const posees = await tx.intervention.findMany({
        where: {
          technicien_id: absence.utilisateur_id,
          date_planifiee: { gte: absence.du, lte: absence.au },
        },
        select: {
          id: true,
          technicien_id: true,
          date_planifiee: true,
          statut: true,
        },
      });
      const aRendre = interventionsADeplanifier(posees, {
        ...misAJour,
      } as AbsenceDeclaree);

      if (aRendre.length > 0) {
        await tx.intervention.updateMany({
          where: { id: { in: [...aRendre] } },
          data: {
            // LA DATE ET LE CRÉNEAU PARTENT, LE TECHNICIEN RESTE. Voir l'entête.
            date_planifiee: null,
            creneau_debut: null,
            creneau_fin: null,
            statut: "a_planifier",
          },
        });
      }

      return {
        accepte: true,
        fiche: { absence: misAJour, deplanifiees: aRendre },
      };
    },
    client,
  );
}

/**
 * LES ABSENCES D'UNE PÉRIODE — ce qu'un écran de planning a besoin de savoir.
 *
 * Rend les TROIS statuts : *une demande en attente est une information de
 * planification* — on ne pose pas volontiers un rendez-vous sur une semaine
 * qu'on s'apprête à valider. C'est l'écran qui distingue, jamais cette lecture.
 */
export async function absencesDeLaPeriode(
  contexte: ContexteSession,
  du: Date,
  au: Date,
  client?: PrismaClient,
): Promise<readonly LigneAbsence[]> {
  return avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.absence.findMany({
        where: { du: { lte: au }, au: { gte: du } },
        select: CHAMPS,
        // L'ordre est TOTAL, et c'est la leçon de L3-03 appliquée le jour même :
        // sans le dernier rang, deux absences du même jour se rangeraient par
        // la place physique des lignes.
        orderBy: [{ du: "asc" }, { utilisateur_id: "asc" }, { id: "asc" }],
      }),
    client,
  );
}

/** Ce que `periode.ts` expose, réexporté pour que l'écran n'ait qu'une porte. */
export { absenceCouvrant };

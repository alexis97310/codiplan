import { type PrismaClient } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";

import {
  absenceCouvrant,
  interventionsADeplanifier,
  type AbsenceDeclaree,
} from "./periode";
import { rupturesDeService, type VerdictRupture } from "./rupture-de-service";
import type { CreationAbsence, LeveeBlocage } from "./saisie";

/**
 * LES BLOCAGES D'AGENDA, SOUS LE CONTEXTE CLOISONNÉ (L3-04, R3-14, RG-PLA-06).
 *
 * ## Il ne compare AUCUNE société
 *
 * Tout passe par `avecContexteApplicatif`, donc sous les politiques : la forme
 * d'`absence` est « interne » (D94), et rien n'est recomparé au-dessus. *Une
 * comparaison écrite ici serait une seconde lecture d'un critère que la
 * politique porte déjà, et c'est celle qui vieillit sans rougir.*
 *
 * ## LA POSE EST L'ACTE QUI DÉPLANIFIE — il n'y a plus de second geste
 *
 * RG-PLA-06 : *« Une absence validée bloque le créneau ; les interventions
 * posées repassent en file à planifier avec alerte. »* Tant qu'un statut
 * existait, c'était la VALIDATION qui déplanifiait. **R3-14 a retiré le circuit
 * d'approbation — CODIPLAN n'est pas un outil RH —, et la pose est donc le seul
 * acte** : une ligne existe, l'agenda est bloqué, les interventions repartent.
 *
 * Les deux moitiés sont **dans la même transaction** : un blocage dont les
 * interventions seraient restées posées laisserait le planning affirmer qu'une
 * personne indisponible travaille, et personne ne saurait laquelle des deux
 * moitiés a échoué.
 *
 * **Ce qui est rendu à la file, c'est la DATE et le CRÉNEAU — jamais le
 * technicien.** *Une intervention qui perd son affectation perd l'information
 * qui permet de la reposer au même endroit*, et le planificateur devrait
 * retrouver qui s'en occupait. Elle reste affectée, elle n'est plus datée :
 * c'est exactement ce que « repasse en file à planifier » veut dire.
 *
 * ## L'ORDRE DES DEUX ÉCRITURES EST INDIFFÉRENT, ET C'EST MESURÉ
 *
 * Les interventions sont déplanifiées **avant** que le blocage soit écrit. La
 * raison qu'on écrirait spontanément — *« sinon le verrou refuserait la
 * déplanification elle-même »* — est **FAUSSE**, et elle a été mise en échec
 * plutôt que relue : `intervention_pas_sur_blocage_agenda` ne se lève que si
 * `date_planifiee IS NOT NULL`, or la déplanification écrit précisément `NULL`.
 * *Mesuré le 14/09/2026 sur PostgreSQL 16.13* : blocage écrit d'abord, puis
 * `UPDATE … SET date_planifiee = NULL` — **aucune erreur**.
 *
 * Cet ordre-ci est donc un choix de lisibilité, et non une contrainte : il met
 * côte à côte la lecture des interventions et leur réécriture. *Une explication
 * causale qui n'a pas été mise en échec n'est pas une cause* (§9, 08/09), et le
 * jour où le verrou jugerait aussi les lignes qu'on ne réécrit pas, c'est cette
 * phrase-ci qu'il faudrait relire — pas une prudence qu'on aurait prise sans
 * savoir pourquoi.
 */

export type ResultatAbsence<T> =
  | { readonly accepte: true; readonly fiche: T }
  | { readonly accepte: false; readonly cle: string };

/**
 * Un blocage tel qu'un écran l'affiche — une personne et une période.
 *
 * *Il n'y a rien d'autre à afficher*, et c'est le sujet de R3-14 : ni nature,
 * ni motif, ni champ libre, ni état.
 */
export type LigneAbsence = {
  readonly id: string;
  readonly utilisateur_id: string;
  readonly du: Date;
  readonly au: Date;
};

const CHAMPS: {
  readonly [K in keyof LigneAbsence]: true;
} = {
  id: true,
  utilisateur_id: true,
  du: true,
  au: true,
};

/** Ce qu'une pose produit — et ce qu'elle a déplanifié. */
export type ResultatBlocage = {
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
  /**
   * L'ALERTE DE RUPTURE DE SERVICE, agence par agence (L3-04a, D106).
   *
   * **Elle voyage AVEC ce qui l'a déclenchée**, et ce n'est pas du confort : la
   * calculer plus tard demanderait de relire les interventions déplanifiées et
   * l'effectif de leurs agences — *deux lectures d'un même critère, dont l'une
   * sous un autre contexte* (§9, 01/09). Elle est décidée ici, dans la
   * transaction qui a rendu les interventions, ou elle n'est pas fiable.
   */
  readonly ruptures: readonly VerdictRupture[];
};

/**
 * POSER un blocage d'agenda — et déplanifier, dans la MÊME transaction.
 *
 * **Il n'y a pas de second geste**, et c'est ce que R3-14 a tranché : le
 * blocage est immédiat. *Qui pose la ligne l'arrête ; qui se trompe la lève* —
 * et la lever ne rend pas leurs créneaux aux interventions déjà rendues à la
 * file, ce que `leverLeBlocage` écrit plutôt qu'il ne le tait.
 */
export async function declarerAbsence(
  contexte: ContexteSession,
  saisie: CreationAbsence,
  client?: PrismaClient,
): Promise<ResultatAbsence<ResultatBlocage>> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      // ── LA DÉPLANIFICATION D'ABORD, et l'ordre est INDIFFÉRENT — MESURÉ.
      // Voir l'entête : la raison qu'on écrirait spontanément est fausse, et
      // elle a été mise en échec plutôt que relue.
      //
      // La borne SQL sert l'index ; *le jour exact est tranché par la RÈGLE*,
      // et par elle seule (§9, 01/09).
      const posees = await tx.intervention.findMany({
        where: {
          technicien_id: saisie.utilisateur_id,
          date_planifiee: { gte: saisie.du, lte: saisie.au },
        },
        select: {
          id: true,
          technicien_id: true,
          date_planifiee: true,
          statut: true,
          // L'AGENCE DE L'INTERVENTION, jamais celle de l'absent (D106, D112) :
          // ce qui se rompt est le service rendu QUELQUE PART, et « quelque
          // part » est l'endroit où l'intervention devait avoir lieu.
          agence_id: true,
        },
      });
      const aRendre = interventionsADeplanifier(posees, {
        id: "",
        utilisateur_id: saisie.utilisateur_id,
        du: saisie.du,
        au: saisie.au,
      } satisfies AbsenceDeclaree);

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

      const posee = await tx.absence.create({
        data: {
          societe_id: contexte.societeId as string,
          utilisateur_id: saisie.utilisateur_id,
          du: saisie.du,
          au: saisie.au,
        },
        select: CHAMPS,
      });

      // ── L'ALERTE, décidée SOUS LE MÊME CONTEXTE que la déplanification ──
      //
      // L'effectif est compté sur les SEULES agences touchées : une requête
      // sur toutes les agences de la société rendrait des lignes qu'aucun
      // verdict ne lirait, et le décompte serait une mesure sans objet.
      //
      // `actif: true` est la clause de D106 — *un technicien qui a quitté
      // l'entreprise ne se supprime pas, il cesse d'être proposé.* Et l'absent
      // y est COMPRIS : être indisponible quinze jours ne rend pas inactif, et
      // le seuil « un seul technicien actif » cesserait sinon de vouloir dire
      // ce qu'il dit.
      const rendues = posees
        .filter((posee) => aRendre.includes(posee.id))
        .map((posee) => ({ id: posee.id, agenceId: posee.agence_id }));

      const agencesTouchees = [...new Set(rendues.map((r) => r.agenceId))];
      // CHAQUE AGENCE TOUCHÉE PART À ZÉRO, et c'est ce qui empêche une faute
      // silencieuse : `groupBy` ne rend AUCUNE ligne pour une agence sans
      // technicien actif. Sans cette amorce, une agence qui n'a plus personne
      // tomberait sous « effectif inconnu » — c'est-à-dire sous le verdict qui
      // n'alerte PAS —, alors qu'elle est la rupture la plus complète qui
      // soit. *L'absence d'une ligne est une mesure, pas une absence de
      // mesure, quand on sait quelles clés on a demandées.*
      const effectifs = new Map<string, number>(
        agencesTouchees.map((agenceId) => [agenceId, 0]),
      );
      if (agencesTouchees.length > 0) {
        const comptes = await tx.technicien.groupBy({
          by: ["agence_id"],
          where: { agence_id: { in: agencesTouchees }, actif: true },
          _count: { _all: true },
        });
        for (const compte of comptes) {
          effectifs.set(compte.agence_id, compte._count._all);
        }
      }

      return {
        accepte: true,
        fiche: {
          absence: posee,
          deplanifiees: aRendre,
          // « effectif inconnu » est INATTEIGNABLE par ce chemin, toutes les
          // agences touchées étant amorcées ci-dessus. Le troisième verdict
          // existe pour l'appelant qui, lui, pourrait ne pas savoir — et parce
          // qu'un verdict à deux valeurs ferait lire « cette agence a du
          // monde » là où il faut lire « je n'ai pas regardé ».
          ruptures: rupturesDeService(rendues, effectifs),
        },
      };
    },
    client,
  );
}

/**
 * LEVER un blocage — il se supprime, il ne se « refuse » pas.
 *
 * **Ce qu'il ne fait pas est écrit plutôt que tu** : lever un blocage ne rend
 * PAS leurs créneaux aux interventions déjà rendues à la file. *Ressusciter un
 * créneau depuis le journal d'audit serait une seconde source d'un fait que la
 * table ne porte plus* — et le planificateur, lui, a le journal sous les yeux
 * (I8) et le choix de reposer où il veut.
 *
 * Un blocage d'une autre société est « introuvable » et rien de plus : les
 * distinguer ferait un oracle (D35, D50).
 */
export async function leverLeBlocage(
  contexte: ContexteSession,
  saisie: LeveeBlocage,
  client?: PrismaClient,
): Promise<ResultatAbsence<LigneAbsence>> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const blocage = await tx.absence.findFirst({
        where: { id: saisie.absence_id },
        select: CHAMPS,
      });
      if (blocage === null) {
        return { accepte: false, cle: "absence.refus.inconnue" };
      }
      await tx.absence.delete({ where: { id: saisie.absence_id } });
      return { accepte: true, fiche: blocage };
    },
    client,
  );
}

/**
 * LES BLOCAGES D'UNE PÉRIODE — ce qu'un écran de planning a besoin de savoir.
 *
 * Il n'y a plus d'état à distinguer : *tout ce qui est rendu bloque.*
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
        // sans le dernier rang, deux blocages du même jour se rangeraient par
        // la place physique des lignes.
        orderBy: [{ du: "asc" }, { utilisateur_id: "asc" }, { id: "asc" }],
      }),
    client,
  );
}

/** Ce que `periode.ts` expose, réexporté pour que l'écran n'ait qu'une porte. */
export { absenceCouvrant };

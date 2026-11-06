import { randomUUID } from "node:crypto";

import {
  type EvenementNotification,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";

import { type Capacite, niveau } from "@/lib/auth/habilitations";
import {
  type ContexteSession,
  exigerContexteActif,
  exigerSocieteActive,
} from "@/lib/auth/contexte";
import { lireFuseau, maintenant } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";

/**
 * LA NOTIFICATION (9J09-NOTIFICATIONS-SCHEMA ; D229).
 *
 * Forme « interne » (D229, même régime que D94/D100) : société ET
 * `app.client_id` absent. **Aucune comparaison de société n'est écrite ici** :
 * l'écriture et la lecture passent par `avecContexteApplicatif`, donc sous le
 * contexte cloisonné, et c'est la politique qui prononce — un compte de
 * portail ne peut ni lire ni écrire ici, quel que soit son client.
 *
 * ## `capacite_requise` n'est pas filtrée par rôle en dur
 *
 * `listerNotifications` ne tient aucune liste de rôles écrite à la main : elle
 * appelle `niveau(role, capacite)` (`lib/auth/habilitations.ts`), la même
 * fonction que la porte. Une capacité qui change de rôles un jour n'a donc
 * qu'un seul endroit à changer.
 *
 * ## L'état de lecture est PAR PERSONNE (9J10A-NOTIFICATION-LUE-PAR-PERSONNE)
 *
 * `notification.lue_le` existe toujours en base (I6) mais n'est plus ni lue
 * ni écrite ici : l'état « lu » vit dans `notification_lecture`, une ligne
 * par couple (notification, utilisateur) — voir sa migration pour la forme
 * RLS. Une notification COLLECTIVE (`destinataire_id` NULL) lue par une
 * personne reste donc non lue pour les autres.
 */

/**
 * La cible d'une notification — l'intervention, la demande OU la suite à
 * donner (9J19-SUITE-A-DONNER-NOTIFICATIONS), jamais deux.
 */
export type CibleNotification =
  | { readonly cible: "intervention"; readonly intervention_id: string }
  | { readonly cible: "demande"; readonly demande_id: string }
  | { readonly cible: "suite_a_donner"; readonly suite_a_donner_id: string };

function colonnesDeCible(cible: CibleNotification): {
  readonly intervention_id: string | null;
  readonly demande_id: string | null;
  readonly suite_a_donner_id: string | null;
} {
  switch (cible.cible) {
    case "intervention":
      return {
        intervention_id: cible.intervention_id,
        demande_id: null,
        suite_a_donner_id: null,
      };
    case "demande":
      return {
        intervention_id: null,
        demande_id: cible.demande_id,
        suite_a_donner_id: null,
      };
    case "suite_a_donner":
      return {
        intervention_id: null,
        demande_id: null,
        suite_a_donner_id: cible.suite_a_donner_id,
      };
  }
}

/**
 * Pose une notification.
 *
 * `capaciteRequise` est typée `Capacite` — l'ensemble même de
 * `lib/auth/habilitations.ts` — et non une chaîne libre : c'est le COMPILATEUR
 * qui tient « doit correspondre à une entrée de CAPACITES », à chaque appel,
 * plutôt qu'une validation rejouée à l'exécution.
 *
 * `destinataireId` absent ou `undefined` : la notification vise tous les
 * comptes qui tiennent cette capacité sur la société.
 */
export async function poserNotification(
  contexte: ContexteSession,
  evenement: EvenementNotification,
  cible: CibleNotification,
  capaciteRequise: Capacite,
  destinataireId?: string,
  client?: PrismaClient,
): Promise<string> {
  const societeId = exigerSocieteActive(contexte);
  const id = randomUUID();

  await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.notification.create({
        data: {
          id,
          societe_id: societeId,
          ...colonnesDeCible(cible),
          evenement,
          capacite_requise: capaciteRequise,
          destinataire_id: destinataireId ?? null,
        },
      }),
    client,
  );

  return id;
}

/** Une notification telle que la liste la montre. */
export type NotificationEnListe = {
  readonly id: string;
  readonly evenement: string;
  readonly interventionId: string | null;
  readonly demandeId: string | null;
  readonly creeLe: Date;
  readonly lueLe: Date | null;
};

/** Le PLAFOND de la liste — même discipline que `lib/imports/depot.ts`. */
export const PLAFOND_LISTE = 50;

/**
 * Les notifications que CE compte peut voir : celles qui lui sont NOMMÉMENT
 * destinées, ou celles sans destinataire (« tous ceux qui ont la capacité »),
 * et dont son rôle tient encore la capacité requise AUJOURD'HUI.
 *
 * **Le filtre de capacité se fait en mémoire, après la lecture cloisonnée** —
 * jamais par un `where` sur `capacite_requise` qui redirait la matrice des
 * rôles une seconde fois (§9, 01/09) : `niveau()` est la seule source, la
 * porte en use déjà.
 *
 * `lueLe` vient de `notification_lecture`, filtrée à SA propre ligne
 * (9J10A-NOTIFICATION-LUE-PAR-PERSONNE) — jamais de `notification.lue_le`,
 * qui ne porte plus qu'un état par notification, pas un par personne.
 */
export async function listerNotifications(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<readonly NotificationEnListe[]> {
  const { role, utilisateurId } = exigerContexteActif(contexte);

  const { lignes, lectures } = await avecContexteApplicatif(
    contexte,
    async (tx) => {
      const lignes = await tx.notification.findMany({
        where: {
          OR: [{ destinataire_id: null }, { destinataire_id: utilisateurId }],
        },
        orderBy: { cree_le: "desc" },
        take: PLAFOND_LISTE,
      });
      const lectures = await tx.notificationLecture.findMany({
        where: {
          utilisateur_id: utilisateurId,
          notification_id: { in: lignes.map((ligne) => ligne.id) },
        },
        select: { notification_id: true, lue_le: true },
      });
      return { lignes, lectures };
    },
    client,
  );

  const lueLeParNotification = new Map(
    lectures.map((lecture) => [lecture.notification_id, lecture.lue_le]),
  );

  return lignes
    .filter(
      (ligne) => niveau(role, ligne.capacite_requise as Capacite) !== "aucun",
    )
    .map((ligne) => ({
      id: ligne.id,
      evenement: ligne.evenement,
      interventionId: ligne.intervention_id,
      demandeId: ligne.demande_id,
      creeLe: ligne.cree_le,
      lueLe: lueLeParNotification.get(ligne.id) ?? null,
    }));
}

/**
 * L'instant, daté dans le fuseau de la SOCIÉTÉ active (L0-08) — jamais
 * `new Date()` : *c'est l'impossibilité d'écrire une heure sans avoir dit
 * laquelle*, même pour un simple horodatage (même garde que
 * `lib/imports/application.ts#instantDate`).
 */
async function instantDate(
  tx: Prisma.TransactionClient,
  societeId: string,
): Promise<Date> {
  const societe = await tx.societe.findUniqueOrThrow({
    where: { id: societeId },
    select: { fuseau_horaire: true },
  });
  return maintenant(lireFuseau(societe.fuseau_horaire)).instant;
}

/**
 * Marque une notification lue, à la première lecture seulement, POUR
 * L'ACTEUR SEUL (9J10A-NOTIFICATION-LUE-PAR-PERSONNE, décision d'Alexis du
 * 05/11/2026) : « lu par personne » — une notification COLLECTIVE lue par une
 * personne reste non lue pour les autres.
 *
 * Pose une ligne dans `notification_lecture`, jamais dans
 * `notification.lue_le` (conservée, I6, mais plus lue ni écrite). La clé
 * unique sur le couple (notification, utilisateur) tient la date de la
 * PREMIÈRE lecture sans `UPDATE` : `skipDuplicates` absorbe un second appel.
 *
 * N'écrit RIEN, et sans erreur bavarde, si la notification n'est pas visible
 * pour cet acteur — introuvable (forgée, ou d'une autre société, la politique
 * RLS de `notification` la cache déjà), destinée nommément à quelqu'un
 * d'autre, ou hors de la capacité que son rôle tient aujourd'hui. **C'est ce
 * qui ferme M2** : sans ce contrôle, un compte connaissant l'identifiant de
 * la notification PERSONNELLE d'un collègue pourrait y poser sa propre
 * lecture — la politique RLS de `notification_lecture` l'empêcherait déjà
 * d'écrire la lecture AU NOM du collègue, mais pas d'écrire la SIENNE sur une
 * notification qui ne lui est pas destinée.
 */
export async function marquerLue(
  contexte: ContexteSession,
  id: string,
  client?: PrismaClient,
): Promise<void> {
  const societeId = exigerSocieteActive(contexte);
  const { role, utilisateurId } = exigerContexteActif(contexte);

  await avecContexteApplicatif(
    contexte,
    async (tx) => {
      const notification = await tx.notification.findUnique({
        where: { id },
        select: { destinataire_id: true, capacite_requise: true },
      });
      if (notification === null) {
        return;
      }
      const visible =
        (notification.destinataire_id === null ||
          notification.destinataire_id === utilisateurId) &&
        niveau(role, notification.capacite_requise as Capacite) !== "aucun";
      if (!visible) {
        return;
      }

      const lueLe = await instantDate(tx, societeId);
      await tx.notificationLecture.createMany({
        data: [
          {
            id: randomUUID(),
            societe_id: societeId,
            notification_id: id,
            utilisateur_id: utilisateurId,
            lue_le: lueLe,
          },
        ],
        skipDuplicates: true,
      });
    },
    client,
  );
}

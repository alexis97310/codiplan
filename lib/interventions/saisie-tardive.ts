import { type Prisma, type PrismaClient, type TypeSaisieApresCloture } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";

export type { TypeSaisieApresCloture };

/**
 * UNE SAISIE TERRAIN ARRIVÉE APRÈS LA CLÔTURE (9L14-FIGE-A-LA-CLOTURE,
 * décision d'Alexis du 10/11/2026, option 1, précisant I5) — « gardée à
 * part », jamais appliquée.
 *
 * Appelée UNIQUEMENT depuis l'intérieur d'une transaction déjà ouverte sous
 * le contexte cloisonné (`tx`, le même que l'appelant) — jamais une
 * transaction à elle : la ligne gardée et la notification qui l'annonce
 * doivent naître AVEC le refus qu'elles documentent, jamais après coup si le
 * reste de l'appel échoue pour une autre raison.
 *
 * **N'appelle PAS `poserNotification`** (`lib/notifications/depot.ts`) :
 * cette fonction ouvre SA PROPRE transaction quand aucun client n'est
 * fourni, et son paramètre `client` est celui d'un SCÉNARIO D'ISOLATION
 * (connexion dédiée sous le rôle applicatif), jamais le `tx` d'un appelant
 * déjà engagé dans une transaction — les deux types ne sont, à dessein, pas
 * interchangeables (`Prisma.TransactionClient` n'a ni `$connect` ni
 * `$disconnect`). La ligne de `notification` est donc posée ICI, à la main,
 * sous le MÊME `tx` — même forme que `colonnesDeCible({cible:
 * "intervention", ...})` construit, réduite au seul cas utile.
 *
 * `capacite_requise` est `consulter_clients_sites` — une capacité que l'ADV
 * tient en COMPLET, sans `restreint` pour le technicien : seul le bureau
 * voit cette alerte, jamais le terrain qui l'a provoquée.
 */
export async function garderSaisieTardive(
  contexte: ContexteSession,
  tx: Prisma.TransactionClient,
  params: {
    readonly societeId: string;
    readonly interventionId: string;
    readonly type: TypeSaisieApresCloture;
    readonly contenu: Prisma.InputJsonValue;
  },
): Promise<void> {
  await tx.saisieApresCloture.create({
    data: {
      id: uuidv7(),
      societe_id: params.societeId,
      intervention_id: params.interventionId,
      type: params.type,
      contenu: params.contenu,
      auteur_id: contexte.utilisateurId,
    },
  });

  await tx.notification.create({
    data: {
      id: uuidv7(),
      societe_id: params.societeId,
      intervention_id: params.interventionId,
      demande_id: null,
      suite_a_donner_id: null,
      evenement: "saisie_apres_cloture",
      capacite_requise: "consulter_clients_sites",
      destinataire_id: null,
    },
  });
}

/** Une saisie gardée, telle que la fiche bureau la lit — en LECTURE SEULE. */
export type SaisieApresClotureAffichee = {
  readonly id: string;
  readonly type: TypeSaisieApresCloture;
  readonly auteurId: string;
  readonly creeLe: Date;
};

/**
 * LES SAISIES GARDÉES D'UNE INTERVENTION, POUR LA FICHE BUREAU
 * (9L14-FIGE-A-LA-CLOTURE) — triées de la plus ancienne à la plus récente,
 * comme `pausesDeLIntervention` (`lib/interventions/depot.ts`), même
 * patron. `null` si l'intervention n'est pas visible sous ce contexte.
 */
export async function saisiesApresClotureDeLIntervention(
  contexte: ContexteSession,
  interventionId: string,
  client?: PrismaClient,
): Promise<readonly SaisieApresClotureAffichee[] | null> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const intervention = await tx.intervention.findFirst({
        where: { id: interventionId },
        select: { id: true },
      });
      if (intervention === null) {
        return null;
      }
      const lignes = await tx.saisieApresCloture.findMany({
        where: { intervention_id: interventionId },
        select: { id: true, type: true, auteur_id: true, cree_le: true },
        orderBy: { cree_le: "asc" },
      });
      return lignes.map((ligne) => ({
        id: ligne.id,
        type: ligne.type,
        auteurId: ligne.auteur_id,
        creeLe: ligne.cree_le,
      }));
    },
    client,
  );
}

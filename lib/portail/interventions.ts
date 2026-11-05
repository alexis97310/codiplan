import { type PrismaClient, type StatutIntervention } from "@prisma/client";

import { avecContexteApplicatif } from "@/lib/db/client";
import { type ContexteSession } from "@/lib/auth/contexte";

/**
 * LES COMMENTAIRES VISIBLES CÔTÉ PORTAIL (9J05-PORTAIL-COMMENTAIRES-GARDE).
 *
 * `Intervention.note_interne` (`prisma/schema.prisma`) est réservé au
 * back-office ; `commentaire_technicien` et `suite_a_donner` sont les deux
 * champs que le client doit, lui, pouvoir lire. `lireFicheIntervention`
 * (`lib/interventions/depot.ts`) sélectionne les TROIS dans le MÊME appel
 * Prisma — juste pour le back-office, qui a droit aux trois, mais un futur
 * écran portail qui la réutiliserait « pour gagner du temps » ferait fuiter
 * la note interne par construction.
 *
 * Ce module compose donc SON PROPRE `select`, fermé, et n'appelle ni ne
 * réutilise aucune fonction qui sélectionne `note_interne` — même discipline
 * que `lib/interventions/montants-visibles.ts` pour les montants.
 *
 * Lu sous la forme « parc » (D84) : aucune politique neuve, le cloisonnement
 * est celui que `intervention` porte déjà — société, client, périmètre de
 * sites.
 */

/**
 * LA LISTE CLOSE des colonnes que ce module s'autorise à sélectionner.
 * `tests/unit/portail/commentaires-colonnes-fermees.test.ts` lit ces clés
 * RÉELLES, jamais une copie tenue à la main.
 */
export const SELECTION_COMMENTAIRES_CLIENT = {
  id: true,
  statut: true,
  commentaire_technicien: true,
  suite_a_donner: true,
} as const;

/** Les commentaires d'une intervention tels que le portail les montre. */
export type CommentairesClient = {
  readonly id: string;
  readonly statut: StatutIntervention;
  readonly commentaireTechnicien: string | null;
  readonly suiteADonner: string | null;
};

/**
 * Les commentaires d'une intervention, sous le contexte du compte portail.
 *
 * `null` si l'intervention n'existe pas OU si elle est hors du périmètre de
 * ce compte — la politique RLS ne distingue pas les deux cas, et ce module
 * ne les distingue pas non plus (D35, D50).
 */
export async function commentairesVisiblesClient(
  contexte: ContexteSession,
  interventionId: string,
  client?: PrismaClient,
): Promise<CommentairesClient | null> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const ligne = await tx.intervention.findFirst({
        where: { id: interventionId },
        select: SELECTION_COMMENTAIRES_CLIENT,
      });
      if (ligne === null) {
        return null;
      }
      return {
        id: ligne.id,
        statut: ligne.statut,
        commentaireTechnicien: ligne.commentaire_technicien,
        suiteADonner: ligne.suite_a_donner,
      };
    },
    client,
  );
}

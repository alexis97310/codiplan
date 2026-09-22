import { type PrismaClient } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { type Devise, lireDevise } from "@/lib/money";

/**
 * LA DEVISE DE LA SOCIÉTÉ ACTIVE — ce qu'un gabarit qui porte un MONTANT doit
 * savoir avant de le lire (REPRISE-HISTORIQUE ; I2, I3).
 *
 * *Ce n'est pas un parc, et il n'a pas de clé* : c'est le seul FAIT de la
 * société qu'un gabarit consulte. Il est lu ici plutôt que dans le gabarit,
 * pour la même raison que les autres index — *un gabarit est une fonction du
 * parc, jamais une lecture de base* (L1-09b) —, et il voyage dans
 * `ParcsDImport` à côté d'eux.
 *
 * **La forme est celle de `lib/money`**, `Devise`, lue par `lireDevise` : c'est
 * elle qui porte les décimales (I3), et `uniteParDevise` est *le seul point du
 * dépôt où la puissance de dix se calcule*. Le gabarit ne recopie ni l'une ni
 * l'autre — il refuse un montant qui ne tombe pas sur l'unité la plus fine, et
 * refuse la colonne entière, libellée en XPF, à une société qui ne tient pas
 * ses comptes en XPF : *convertir serait une conversion ligne à ligne* (I2).
 */
export async function lireLaDeviseDeLaSociete(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<Devise> {
  const societe = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.societe.findFirstOrThrow({
        select: {
          devise: { select: { code: true, decimales: true, symbole: true } },
        },
      }),
    client,
  );
  return lireDevise(societe.devise);
}

/**
 * LA DEVISE QU'AUCUNE BASE N'A LUE — pour les parcs VIDES qui ne servent qu'à
 * ÉNUMÉRER les types (`TYPES_PUBLIES`).
 *
 * Elle n'a pas de décimales, et elle ne fait pas semblant d'en avoir : *une
 * absence d'information ne s'affiche jamais comme une réponse* (doctrine §3),
 * et un zéro écrit ici serait un nombre de décimales en dur — ce que le
 * gardien de I3 refuse à bon droit. Toute lecture LÈVE : les gabarits
 * construits sur ces parcs ne jugent aucune ligne, et si l'un le faisait, on
 * le saurait à la première cellule plutôt qu'à la première facture fausse.
 */
export function deviseNonLue(): Devise {
  return new Proxy({} as Devise, {
    get(_, propriete) {
      throw new Error(
        `Devise non lue : ces parcs vides n'énumèrent que les types, ils ne ` +
          `jugent aucune ligne (propriété « ${String(propriete)} » demandée).`,
      );
    },
  });
}

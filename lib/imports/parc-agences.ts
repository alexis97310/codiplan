import { type PrismaClient } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";

/**
 * LES AGENCES, INDEXÉES PAR LEUR CODE (L1-09c ; D101).
 *
 * **Par le code, et par lui SEUL.** `agence` porte `@@unique([societe_id,
 * code])` : le code est une clé parce qu'un index unique le dit. *Le libellé ne
 * l'est pas, et lui donner ce statut ferait dépendre le rattachement d'un site
 * d'une chaîne que rien n'empêche d'être en double* — un site rattaché à la
 * mauvaise agence fausse le temps de trajet (D56), le calendrier de référence
 * (I7) et la majoration (RG-TAR).
 *
 * **Il n'y a donc AUCUNE ambiguïté possible ici**, et c'est la base qui le
 * garantit — non pas ce module. *C'est la différence avec le parc des clients,
 * où deux raisons sociales identiques sont permises et rendent une ligne
 * indécidable.*
 *
 * **Les agences INACTIVES sont indexées comme les autres.** Une agence
 * désactivée occupe toujours son code, et l'ignorer ferait qu'un fichier qui la
 * nomme reçoive « parent introuvable » — *un refus qui envoie corriger le
 * fichier alors que le problème est ailleurs.*
 */
export type ParcAgences = {
  /** Le code d'agence → son identifiant. */
  readonly parCode: ReadonlyMap<string, string>;
};

export async function indexerLesAgences(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<ParcAgences> {
  const agences = await avecContexteApplicatif(
    contexte,
    (tx) => tx.agence.findMany({ select: { id: true, code: true } }),
    client,
  );

  // La casse est perdue — `ducos` et `DUCOS` désignent la même agence. *La
  // tolérance porte sur la GRAPHIE d'une clé, jamais sur la clé* (L1-08f), et
  // un code est écrit à la main dans un tableur.
  return {
    parCode: new Map(
      agences.map((agence) => [agence.code.trim().toUpperCase(), agence.id]),
    ),
  };
}

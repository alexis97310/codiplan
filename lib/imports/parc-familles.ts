import { type PrismaClient } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";

/**
 * LES FAMILLES DE MATÉRIEL, INDEXÉES PAR LEUR CODE (L1-09d ; D101).
 *
 * **Par le code, et par lui SEUL** — le même motif que les agences, et pour la
 * même raison mesurée au schéma : `famille_materiel` porte
 * `@@unique([societe_id, code])`, le libellé n'a aucune unicité. *Ce qui rend
 * une clé utilisable n'est pas sa forme, c'est ce que la base garantit d'elle.*
 *
 * **Ce module et `parc-agences.ts` se ressemblent, et ils ne sont pas
 * fusionnés.** Ils ne partagent qu'une forme — « un code unique par société » —,
 * pas un critère : *la famille et l'agence n'ont rien à voir, et une fonction
 * générique « indexer par code » ferait croire qu'un jour les deux changeront
 * ensemble.* La ressemblance est un fait du schéma d'aujourd'hui, pas une règle.
 */
export type ParcFamilles = {
  readonly parCode: ReadonlyMap<string, string>;
};

export async function indexerLesFamilles(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<ParcFamilles> {
  const familles = await avecContexteApplicatif(
    contexte,
    (tx) => tx.familleMateriel.findMany({ select: { id: true, code: true } }),
    client,
  );

  return {
    parCode: new Map(
      familles.map((famille) => [
        famille.code.trim().toUpperCase(),
        famille.id,
      ]),
    ),
  };
}

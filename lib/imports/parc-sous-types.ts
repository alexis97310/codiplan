import { type PrismaClient } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";

/**
 * LES SOUS-TYPES DE MATÉRIEL, INDEXÉS PAR LEUR FAMILLE PUIS LEUR CODE (D238,
 * ticket 9K17A-MATERIEL-SOUS-TYPE).
 *
 * **Par (famille, code), jamais par le code seul** — à la différence de
 * `parc-familles.ts` : `sous_type_materiel` porte
 * `@@unique([societe_id, famille_id, code])`, pas `@@unique([societe_id,
 * code])`. Deux familles peuvent réutiliser le même code pour deux sous-types
 * différents ; un index par code seul confondrait les deux.
 *
 * **L'état `actif` voyage avec l'identifiant** : un import qui désigne un
 * sous-type DÉSACTIVÉ doit le refuser nommément (I6 : jamais une création
 * silencieuse sous un parent retiré du choix), ce qu'un index qui ne porterait
 * que l'identifiant ne permettrait pas de dire.
 */
export type ParcSousTypes = {
  readonly parFamilleEtCode: ReadonlyMap<
    string,
    { readonly id: string; readonly actif: boolean }
  >;
};

/** La clé de `parFamilleEtCode` — composée une seule fois, ici. */
export function cleSousType(familleId: string, code: string): string {
  return `${familleId}::${code.trim().toUpperCase()}`;
}

export async function indexerLesSousTypes(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<ParcSousTypes> {
  const sousTypes = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.sousTypeMateriel.findMany({
        select: { id: true, code: true, famille_id: true, actif: true },
      }),
    client,
  );

  return {
    parFamilleEtCode: new Map(
      sousTypes.map((sousType) => [
        cleSousType(sousType.famille_id, sousType.code),
        { id: sousType.id, actif: sousType.actif },
      ]),
    ),
  };
}

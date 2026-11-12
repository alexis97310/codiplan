import type { TypeIntervention } from "@/lib/interventions/saisie";

/**
 * LA RÈGLE DE PROPOSITION D'UNE PRESTATION, PAR TYPE D'INTERVENTION (9K29,
 * D243) — module PUR, SANS PRISMA, exactement comme `TYPES_AVEC_PIECES_
 * REMPLACEES` / `aSectionPiecesRemplacees` de `lib/interventions/saisie.ts` :
 * la coquille hors réseau (`components/terrain/consultation-hors-reseau.tsx`)
 * en a besoin côté CLIENT, où un import du dépôt rejoindrait le paquet
 * client avec lui (§9, jamais une seconde règle qui diverge en silence).
 *
 * **VIDE = proposée pour TOUS les types** (décision d'Alexis du 11/11/2026,
 * D243) : une prestation dont `types` est vide n'a jamais été limitée.
 *
 * **Une prestation déjà déclarée RÉALISÉE reste affichée**, même si elle ne
 * serait plus proposée pour le type de cette intervention — jamais une
 * réalisation qui disparaît de l'écran après coup. C'est pour cette raison que
 * `idsDejaRealises` est un paramètre à part, et non une colonne du catalogue :
 * ce qui a déjà été coché ne dépend d'aucune règle de proposition, seulement
 * de ce qu'une intervention PORTE déjà.
 */
export function prestationsProposees<
  T extends { readonly id: string; readonly types: readonly TypeIntervention[] },
>(
  catalogue: readonly T[],
  type: TypeIntervention,
  idsDejaRealises: ReadonlySet<string>,
): readonly T[] {
  return catalogue.filter(
    (prestation) =>
      prestation.types.length === 0 ||
      prestation.types.includes(type) ||
      idsDejaRealises.has(prestation.id),
  );
}

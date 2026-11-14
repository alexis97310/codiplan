/**
 * LA RÈGLE DE PROPOSITION D'UNE PRESTATION, PAR FAMILLE DE MATÉRIEL (9L04J,
 * D259) — module PUR, SANS PRISMA, même discipline et même raison que
 * `regle-type.ts` (9K29) : la coquille hors réseau (`components/terrain/
 * consultation-hors-reseau.tsx`) en a besoin côté CLIENT.
 *
 * **VIDE = GÉNÉRALE, proposée sur TOUTE machine** (décision d'Alexis du
 * 13/11/2026) : une prestation dont `familles` est vide n'a jamais été
 * limitée à un matériel — même sens que `types` vide dans `regle-type.ts`.
 *
 * **Se compose avec `prestationsProposees`, jamais à sa place** : le filtre
 * par matériel s'applique EN PLUS du filtre par type d'intervention (9K29),
 * les deux critères devant être satisfaits à la fois pour qu'une prestation
 * se propose.
 *
 * **Une prestation déjà déclarée RÉALISÉE reste affichée**, même raison et
 * même paramètre `idsDejaRealises` que `prestationsProposees` — une
 * réalisation ne disparaît jamais de l'écran après coup.
 *
 * **Aucune machine connue sur l'intervention (`familleMachineId === null`)**
 * : seules les prestations GÉNÉRALES (`familles` vide) restent proposées,
 * exactement comme une prestation dont le type ne correspondrait à aucune
 * machine inconnue — l'absence de machine ne privilégie aucune famille.
 */
export function prestationsPourFamille<
  T extends {
    readonly id: string;
    readonly familles: readonly string[];
  },
>(
  catalogue: readonly T[],
  familleMachineId: string | null,
  idsDejaRealises: ReadonlySet<string>,
): readonly T[] {
  return catalogue.filter(
    (prestation) =>
      prestation.familles.length === 0 ||
      (familleMachineId !== null &&
        prestation.familles.includes(familleMachineId)) ||
      idsDejaRealises.has(prestation.id),
  );
}

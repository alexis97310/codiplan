import { comparerJours, type JourLocal } from "@/lib/calendar/fuseau";

import type { StatutIntervention } from "./saisie";

/**
 * « EN RETARD » — une LECTURE, jamais un statut stocké (bug 8 de l'audit
 * d'ergonomie du 27/09/2026 ; §6 et CA-5).
 *
 * Une intervention `planifiee` ou `affectee` dont la date est passée sans
 * qu'aucun travail n'ait commencé. **`statutALaCreation`
 * (`cycle-de-vie.ts`) ne suffit pas à le dire** : une intervention REPRISE
 * (L2-10) retombe `planifiee` même après un premier segment de travail — le
 * statut seul ne distingue pas « jamais commencée » de « suspendue en cours
 * de route ». Ce que distingue le travail réel, c'est `SegmentTravail`
 * (`prisma/schema.prisma`) : `aDesSegments` en porte la seule question qui
 * compte ici, « au moins un segment existe-t-il ? ».
 *
 * **`aujourdhuiLocal` est un paramètre, jamais calculé ici.** Le jour civil
 * « aujourd'hui » dépend du fuseau de l'AGENCE de l'intervention (I7), et
 * cette fonction reste pure : c'est à l'appelant de lire `maintenant(fuseau)`
 * (`lib/calendar/fuseau.ts`) et de n'en garder que le jour.
 *
 * **`datePlanifiee` se compare en jour civil, jamais en instant.** C'est une
 * colonne `@db.Date` : la lire par ses accesseurs UTC (`getUTCFullYear`, …)
 * est la seule lecture juste, exactement comme `dateCivile` et
 * `instantDuJour` le font déjà — la faire passer par `versLocal` la
 * décalerait d'un jour sous UTC+11. *Leçon payée : `CURRENT_DATE` (l'horloge
 * UTC du serveur) est encore la VEILLE à Nouméa entre 0 h et 11 h locales —
 * le jour « aujourd'hui » ne se lit jamais sans nommer où.*
 */
export type LigneEnRetard = {
  readonly statut: StatutIntervention;
  readonly datePlanifiee: Date | null;
  readonly aDesSegments: boolean;
};

/** Le jour civil d'une colonne `@db.Date` — lu en UTC, jamais dans un fuseau. */
function jourCivilDeDatePlanifiee(datePlanifiee: Date): JourLocal {
  return {
    annee: datePlanifiee.getUTCFullYear(),
    mois: datePlanifiee.getUTCMonth() + 1,
    jour: datePlanifiee.getUTCDate(),
  };
}

/**
 * Cette ligne est-elle en retard, au jour civil `aujourdhuiLocal` ?
 *
 * `planifiee` ou `affectee`, une date posée strictement avant aujourd'hui, et
 * aucun segment de travail — les trois ensemble, jamais un seul.
 */
export function enRetard(
  ligne: LigneEnRetard,
  aujourdhuiLocal: JourLocal,
): boolean {
  if (ligne.statut !== "planifiee" && ligne.statut !== "affectee") {
    return false;
  }
  if (ligne.datePlanifiee === null || ligne.aDesSegments) {
    return false;
  }
  return (
    comparerJours(
      jourCivilDeDatePlanifiee(ligne.datePlanifiee),
      aujourdhuiLocal,
    ) < 0
  );
}

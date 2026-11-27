import { comparerJours, type JourLocal } from "@/lib/calendar/fuseau";

/**
 * « EN RETARD » POUR UN PRÊT (9L60-PRET-1-MODELE) — une LECTURE, jamais un
 * statut stocké, même raisonnement que `lib/interventions/retard.ts#enRetard`
 * (bug 8 de l'audit d'ergonomie du 27/09/2026).
 *
 * `date_retour_prevue` est une colonne `@db.Date` : elle se compare en jour
 * civil, jamais en instant, et se lit par ses accesseurs UTC — la faire
 * passer par `versLocal` la décalerait d'un jour sous UTC+11 (leçon payée,
 * voir `lib/interventions/retard.ts`).
 *
 * `aujourdhuiLocal` est un PARAMÈTRE, jamais calculé ici : le jour civil
 * « aujourd'hui » dépend du fuseau de la SOCIÉTÉ (I7), et cette fonction
 * reste pure — c'est à l'appelant de lire `maintenant(fuseau)`
 * (`lib/calendar/fuseau.ts`) et de n'en garder que le jour.
 */
export type LignePretPourRetard = {
  readonly dateRetourPrevue: Date;
  readonly dateRetourReelle: Date | null;
};

/** Le jour civil d'une colonne `@db.Date` — lu en UTC, jamais dans un fuseau. */
export function jourCivilDeDateRetourPrevue(date: Date): JourLocal {
  return {
    annee: date.getUTCFullYear(),
    mois: date.getUTCMonth() + 1,
    jour: date.getUTCDate(),
  };
}

/**
 * Ce prêt est-il en retard, au jour civil `aujourdhuiLocal` ? Un prêt déjà
 * retourné n'est jamais en retard — le retard dit « rien ne revient encore »,
 * pas « le retour a eu lieu après la date prévue ».
 */
export function pretEnRetard(
  ligne: LignePretPourRetard,
  aujourdhuiLocal: JourLocal,
): boolean {
  if (ligne.dateRetourReelle !== null) {
    return false;
  }
  return (
    comparerJours(
      jourCivilDeDateRetourPrevue(ligne.dateRetourPrevue),
      aujourdhuiLocal,
    ) < 0
  );
}

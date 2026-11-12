/**
 * L'INSTANT où un rattachement EN ATTENTE est accepté (9L04, D249).
 *
 * MÊME raisonnement que `lib/db/uuid.ts` (I10) : `accepte_le` est un INSTANT
 * d'audit, jamais une date calendaire — il ne se lit dans aucun fuseau, ne
 * s'affiche dans aucun écran, et aucune règle ne compare son jour local à
 * celui d'une agence. `tests/unit/calendar/sans-date-courante-implicite.test.ts`
 * interdit `new Date()` ailleurs dans le code applicatif ; cette fonction en
 * est le point de passage unique pour `accepterRattachementClient` et pour
 * la création d'un rattachement ACCEPTÉ D'EMBLÉE (identité nouvelle,
 * `lib/auth/lien-d-acces.ts`), exemptée nommément au gardien.
 */
export function instantAcceptation(): Date {
  return new Date();
}

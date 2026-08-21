/**
 * `lib/money` — les primitives monétaires (ticket L0-07, invariants I2 et I3).
 *
 * Ce qui vit ici : la représentation d'un montant, son arithmétique, son
 * arrondi et son formatage. Ce qui n'y vit pas : la **conversion**, qui est le
 * seul geste capable de mélanger deux devises et qui réside dans
 * `lib/reporting/consolidation.ts` — seule zone du dépôt autorisée à convertir
 * (CLAUDE.md §6, I2, D19).
 *
 * `marquerConsolide` n'est volontairement pas réexportée ici : elle s'importe
 * depuis `@/lib/money/consolide`, et seul `lib/reporting` a le droit de la
 * nommer.
 */
export {
  lireDevise,
  schemaDevise,
  suffixeDevise,
  uniteParDevise,
  type CodeDevise,
  type Devise,
} from "./devise";
export { arrondirAuPlusProche } from "./arrondi";
export {
  additionner,
  comparer,
  estEgal,
  estNegatif,
  montant,
  multiplier,
  opposer,
  soustraire,
  zero,
  ErreurDeviseIncompatible,
  ErreurMontantNonEntier,
  type Montant,
} from "./montant";
export { agreger, type MontantAgrege } from "./agregat";
export type { MontantConsolide } from "./consolide";
export { formatMoney, formatMoneyConsolide } from "./format";

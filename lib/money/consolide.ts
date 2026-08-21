import type { CodeDevise } from "./devise";

/**
 * Un montant **consolidé** : le résultat d'une conversion de devise.
 *
 * **Pourquoi un type distinct de `Montant`.** Un chiffre converti n'est pas de
 * l'argent : c'est une estimation, valable à une date de parité et pour une
 * lecture d'ensemble. Il ne doit ni rentrer dans un calcul métier — on ne
 * facture pas une conversion —, ni être présenté comme un montant réel. Le
 * discriminant `nature` rend `MontantConsolide` structurellement inassignable à
 * `Montant` : `additionner` le refuse à la compilation, et `formatMoney` aussi.
 *
 * **`dateParite` voyage avec le chiffre.** Un montant consolidé sans sa date de
 * parité n'est pas reproductible : c'est précisément ce que D20 cherche à
 * éviter en imposant la date de clôture de la période analysée. La date reste
 * donc attachée au résultat, et non au seul appel qui l'a produit.
 */
export type MontantConsolide<C extends CodeDevise = CodeDevise> = {
  readonly nature: "consolide";
  readonly valeur: bigint;
  /** Devise de restitution — celle dans laquelle le chiffre est présenté. */
  readonly devise: C;
  /** Date de la parité appliquée, au format ISO `AAAA-MM-JJ`. */
  readonly dateParite: string;
};

/**
 * Fabrique un montant consolidé. **Réservé à `lib/reporting`** : un chiffre ne
 * devient « consolidé » qu'au terme d'une conversion, et la conversion n'a lieu
 * que là (I2, D19). Le gardien
 * `tests/unit/money/conversion-reservee.test.ts` échoue si un fichier hors de
 * `lib/reporting/` la nomme. Elle n'est délibérément pas réexportée par
 * `lib/money/index.ts`.
 */
export function marquerConsolide<C extends CodeDevise>(
  valeur: bigint,
  devise: C,
  dateParite: string,
): MontantConsolide<C> {
  return { nature: "consolide", valeur, devise, dateParite };
}

import type { CodeDevise } from "./devise";
import { ErreurDeviseIncompatible, type Montant } from "./montant";

/**
 * Un montant **agrégé** : la somme de plusieurs montants d'une même société,
 * donc d'une même devise.
 *
 * **À quoi sert un type de plus.** L'arbitrage D19 exige que la conversion
 * « refuse d'être appelée sur un montant unitaire ». Le refuser à l'exécution
 * supposerait de deviner, à l'arrivée, si le chiffre reçu était une ligne ou un
 * total — ce qu'aucune inspection ne dira. On le refuse donc à la compilation :
 * `convertForConsolidation` n'accepte qu'un `MontantAgrege`, et un
 * `MontantAgrege` ne s'obtient que par `agreger`.
 *
 * `lignes` compte les montants sommés. Il ne conditionne rien — une période
 * qui ne contient qu'une intervention reste un agrégat légitime — mais il rend
 * l'agrégat lisible dans un rapport et dans un message d'erreur.
 */
export type MontantAgrege<C extends CodeDevise = CodeDevise> = {
  readonly nature: "agrege";
  readonly valeur: bigint;
  readonly devise: C;
  /** Nombre de montants entrés dans la somme. */
  readonly lignes: number;
};

const ZERO = BigInt(0);

/**
 * Somme des montants d'une même devise. La devise est passée explicitement :
 * une liste vide est un agrégat légitime — un mois sans intervention — et elle
 * a quand même une devise.
 */
export function agreger<C extends CodeDevise>(
  montants: readonly Montant<NoInfer<C>>[],
  devise: C,
): MontantAgrege<C> {
  let total = ZERO;
  for (const montantCourant of montants) {
    if (montantCourant.devise !== devise) {
      throw new ErreurDeviseIncompatible(
        "agrégation",
        devise,
        montantCourant.devise,
      );
    }
    total += montantCourant.valeur;
  }
  return {
    nature: "agrege",
    valeur: total,
    devise,
    lignes: montants.length,
  };
}
